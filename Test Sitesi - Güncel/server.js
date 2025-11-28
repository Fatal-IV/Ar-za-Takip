const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');
const path = require('path');
const os = require('os');
const fs = require('fs'); // Dosya sistemi modülü

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- AYARLAR ---
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'gizli_anahtar', resave: false, saveUninitialized: true }));

// --- YARDIMCI FONKSİYONLAR ---

// 1. Veritabanı Sorgusu (Promise Wrapper) - Global Kullanım İçin
const queryDB = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// 2. Sicil Temizleme
function cleanSicil(sicil) {
    if (!sicil) return "";
    return sicil.toUpperCase().replace('AB', '').trim();
}

// 3. JSON Dosya İşlemleri
const JSON_FILE = path.join(__dirname, 'field-ops.json');

function getFieldOps() {
    try {
        if (!fs.existsSync(JSON_FILE)) fs.writeFileSync(JSON_FILE, '[]');
        const data = fs.readFileSync(JSON_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveFieldOp(record) {
    const data = getFieldOps();
    data.push(record);
    fs.writeFileSync(JSON_FILE, JSON.stringify(data, null, 2));
}

// 4. Görevleri Birleştirme (DB + JSON) - Merkezi Mantık
// Hem Dashboard açılışında hem de API isteğinde burası çalışır.
const getCombinedTasks = async (user) => {
    let sql = "";
    let params = [];

    // Rol Kontrolü
        if (user.rol === 'admin') {
            sql = `SELECT tickets.*, users.ad, users.soyad, users.birim, users.sicil, 
                techs.ad as tech_ad, techs.soyad as tech_soyad
                FROM tickets 
                JOIN users ON tickets.user_id = users.id 
                LEFT JOIN users as techs ON tickets.teknisyen_id = techs.id
                WHERE tickets.durum = 'atandi' OR tickets.durum = 'cozuldu'`;
    } else if (user.rol === 'teknisyen') {
            sql = `SELECT tickets.*, users.ad, users.soyad, users.birim, users.sicil 
                FROM tickets JOIN users ON tickets.user_id = users.id 
                WHERE teknisyen_id = ?`;
        params = [user.id];
    } else {
        return [];
    }

    try {
        // DB Verilerini Çek
        const dbRows = await queryDB(sql, params);
        
        // DB Verilerini Formatla
        const formattedDbTasks = dbRows.map(r => ({
            id: r.id,
            source: 'db',
            talep_eden_ad: r.ad + ' ' + r.soyad,
            hizmet_birimi: r.birim,
            hizmet_kati: '-', 
            sorun_basligi: r.sorun_basligi,
            detay: r.detay,
            durum: r.durum,
            tarih: r.tarih,
            tech_ad: r.tech_ad,
            tech_soyad: r.tech_soyad,
            teknisyen_id: r.teknisyen_id
        }));

        // JSON Verilerini Çek ve Filtrele
        const allJsonOps = getFieldOps();
        let filteredJsonOps = [];

        if (user.rol === 'admin') {
            filteredJsonOps = allJsonOps;
        } else if (user.rol === 'teknisyen') {
            // ID karşılaştırmasında tür dönüşümüne (==) dikkat ediyoruz
            filteredJsonOps = allJsonOps.filter(op => op.teknisyen_id == user.id);
        }

        // Birleştir ve Sırala (En yeniden eskiye)
        const combined = [...formattedDbTasks, ...filteredJsonOps];
        combined.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

        return combined;
    } catch (err) {
        console.error("Görev birleştirme hatası:", err);
        return [];
    }
};

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    socket.on('new_ticket', () => io.emit('refresh_dashboard'));
    socket.on('assign_ticket', () => io.emit('refresh_dashboard'));
});

// --- ROTALAR ---

// Giriş
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const sicil = cleanSicil(req.body.sicil);
    const sifre = req.body.sifre;

    db.get("SELECT * FROM users WHERE sicil = ?", [sicil], async (err, user) => {
        if (err || !user) return res.render('login', { error: 'Hatalı sicil veya şifre.' });
        
        const match = await bcrypt.compare(sifre, user.sifre);
        if (match) {
            req.session.user = user;
            return res.redirect('/dashboard');
        }
        res.render('login', { error: 'Hatalı sicil veya şifre.' });
    });
});

// Kayıt
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
    let { ad, soyad, telefon, kat, birim, sifre, sicil } = req.body;
    const formatName = (name) => name.charAt(0).toUpperCase() + name.slice(1).toLocaleLowerCase('tr-TR');
    
    ad = formatName(ad);
    soyad = formatName(soyad);
    sicil = cleanSicil(sicil);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        const hashedPassword = await bcrypt.hash(sifre, 10);
        db.run(`INSERT INTO users (sicil, ad, soyad, telefon, kat, birim, sifre, cihaz_bilgisi, rol) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'kullanici')`,
            [sicil, ad, soyad, telefon, kat, birim, hashedPassword, ip],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.render('register', { error: null, toast: { type: 'error', message: 'Bu sicil numarası zaten kayıtlı!' } });
                    }
                    return res.render('register', { error: 'Teknik hata.', toast: null });
                }
                res.redirect('/');
            }
        );
    } catch (e) { res.render('register', { error: 'Sistem hatası.', toast: null }); }
});

// DASHBOARD (Ana Sayfa)
app.get('/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    const user = req.session.user;
    let data = { 
        user: user, 
        myTickets: [], 
        allTickets: [], 
        techTickets: [], 
        technicians: [], 
        allUsers: [],
        stockLogs: [], 
        stockDefinitions: [] 
    };

    try {
        // 1. Kendi Talepleri
        if (user.rol === 'kullanici' || user.rol === 'admin') {
            data.myTickets = await queryDB("SELECT * FROM tickets WHERE user_id = ? ORDER BY tarih DESC", [user.id]);
        }

        // 2. Operatör Havuzu (Sadece DB)
        if (user.rol === 'operator' || user.rol === 'admin') {
            data.allTickets = await queryDB(`
                SELECT tickets.*, users.ad, users.soyad, users.birim, users.sicil,
                techs.ad as tech_ad, techs.soyad as tech_soyad
                FROM tickets 
                JOIN users ON tickets.user_id = users.id 
                LEFT JOIN users as techs ON tickets.teknisyen_id = techs.id
                ORDER BY CASE WHEN tickets.durum = 'beklemede' THEN 1 ELSE 2 END, tickets.tarih DESC
            `);
            data.technicians = await queryDB("SELECT * FROM users WHERE rol = 'teknisyen'");
            
            // Stok Verileri
            data.stockLogs = await queryDB("SELECT * FROM stock_logs ORDER BY tarih DESC");
            data.stockDefinitions = await queryDB("SELECT * FROM stock_definitions ORDER BY tur, ad");
        }

        // 3. Teknisyen Saha İşleri (DB + JSON BİRLEŞİK) - GÜNCELLENDİ
        if (user.rol === 'teknisyen' || user.rol === 'admin') {
            // Artık burada yardımcı fonksiyonu kullanıyoruz, böylece sayfa ilk açılışta da veriler geliyor
            data.techTickets = await getCombinedTasks(user);
            
            if (user.rol === 'admin') {
                data.allUsers = await queryDB("SELECT * FROM users ORDER BY ad ASC");
            }
        }

        res.render('dashboard', data);
    } catch (error) {
        console.log(error);
        res.send("Veritabanı hatası");
    }
});

// Arıza Oluştur
app.post('/create-ticket', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { baslik, detay } = req.body;
    const userId = req.session.user.id;
    const kayitEdilecekCihaz = `${os.hostname()} (${req.ip})`;

    db.run(`INSERT INTO tickets (user_id, sorun_basligi, detay, durum, cihaz_adi) VALUES (?, ?, ?, 'beklemede', ?)`,
        [userId, baslik, detay, kayitEdilecekCihaz],
        () => {
            io.emit('refresh_dashboard'); 
            res.redirect('/dashboard');
        }
    );
});

// Hızlı İş Girişi (JSON'a Kayıt)
app.post('/create-resolved-ticket', (req, res) => {
    if (!req.session.user || !['teknisyen', 'admin'].includes(req.session.user.rol)) return res.sendStatus(403);
    
    const { manuel_ad, kat, birim, baslik, detay } = req.body;
    const teknisyenUser = req.session.user;

    const newRecord = {
        id: 'json_' + Date.now(),
        source: 'json',
        teknisyen_id: teknisyenUser.id,
        tech_ad: teknisyenUser.ad,
        tech_soyad: teknisyenUser.soyad,
        talep_eden_ad: manuel_ad, 
        hizmet_kati: kat,
        hizmet_birimi: birim,
        sorun_basligi: baslik,
        detay: detay,
        durum: 'cozuldu',
        tarih: new Date().toISOString()
    };

    saveFieldOp(newRecord);
    io.emit('refresh_dashboard');
    res.redirect('/dashboard');
});

// Arıza Atama
app.post('/assign-ticket', (req, res) => {
    const { ticket_id, teknisyen_id } = req.body;
    db.run("UPDATE tickets SET teknisyen_id = ?, durum = 'atandi' WHERE id = ?", [teknisyen_id, ticket_id], () => {
        io.emit('refresh_dashboard');
        res.redirect('/dashboard');
    });
});

// Arıza Çözme
app.post('/resolve-ticket', (req, res) => {
    if(!req.session.user) return res.redirect('/');
    if (req.session.user.rol !== 'operator' && req.session.user.rol !== 'admin') return res.sendStatus(403);

    db.run("UPDATE tickets SET durum = 'cozuldu' WHERE id = ?", [req.body.ticket_id], () => {
        io.emit('refresh_dashboard');
        res.redirect('/dashboard');
    });
});

// Silme
app.post('/delete-ticket', (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') return res.sendStatus(403);
    db.run("DELETE FROM tickets WHERE id = ?", [req.body.ticket_id], () => {
        io.emit('refresh_dashboard');
        res.redirect('/dashboard');
    });
});

// --- STOK YÖNETİMİ ROTALARI (MEVCUT DOSYANIZDAN KORUNDU) ---
app.post('/stock/add', (req, res) => {
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.sendStatus(403);
    const { urun_tipi, model, teslim_alan, adet, aciklama } = req.body;
    const islem_yapan = req.session.user.ad + ' ' + req.session.user.soyad;
    db.run(`INSERT INTO stock_logs (urun_tipi, model, teslim_alan, adet, aciklama, islem_yapan) VALUES (?, ?, ?, ?, ?, ?)`,
        [urun_tipi, model, teslim_alan, adet, aciklama, islem_yapan], () => res.redirect('/dashboard'));
});

app.post('/stock/delete', (req, res) => {
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.sendStatus(403);
    db.run("DELETE FROM stock_logs WHERE id = ?", [req.body.id], () => res.redirect('/dashboard'));
});

app.post('/stock/update', (req, res) => {
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.sendStatus(403);
    const { id, urun_tipi, model, teslim_alan, adet, aciklama } = req.body;
    db.run(`UPDATE stock_logs SET urun_tipi=?, model=?, teslim_alan=?, adet=?, aciklama=? WHERE id=?`,
        [urun_tipi, model, teslim_alan, adet, aciklama, id], () => res.redirect('/dashboard'));
});

// --- STOK TANIMLARI (MEVCUT DOSYANIZDAN KORUNDU) ---
app.post('/stock/def/add', (req, res) => {
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.sendStatus(403);
    db.run("INSERT INTO stock_definitions (tur, ad) VALUES (?, ?)", [req.body.tur, req.body.ad], () => res.redirect('/dashboard'));
});

app.post('/stock/def/delete', (req, res) => {
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.sendStatus(403);
    db.run("DELETE FROM stock_definitions WHERE id = ?", [req.body.id], () => res.redirect('/dashboard'));
});

// --- ADMIN KULLANICI İŞLEMLERİ (MEVCUT DOSYANIZDAN KORUNDU) ---
app.post('/admin/update-user', async (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') return res.sendStatus(403);
    const { id, ad, soyad, sicil, telefon, birim, rol, yeni_sifre } = req.body;

    if (yeni_sifre && yeni_sifre.trim() !== "") {
        const hash = await bcrypt.hash(yeni_sifre, 10);
        db.run(`UPDATE users SET ad=?, soyad=?, sicil=?, telefon=?, birim=?, rol=?, sifre=? WHERE id=?`,
            [ad, soyad, sicil, telefon, birim, rol, hash, id], () => { io.emit('refresh_dashboard'); res.redirect('/dashboard'); });
    } else {
        db.run(`UPDATE users SET ad=?, soyad=?, sicil=?, telefon=?, birim=?, rol=? WHERE id=?`,
            [ad, soyad, sicil, telefon, birim, rol, id], () => { io.emit('refresh_dashboard'); res.redirect('/dashboard'); });
    }
});

app.post('/admin/delete-user', (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') return res.json({ success: false });
    if (req.body.id == req.session.user.id) return res.json({ success: false });

    db.run("DELETE FROM users WHERE id = ?", [req.body.id], (err) => {
        if (!err) io.emit('refresh_dashboard');
        res.json({ success: !err });
    });
});

// API Routes
app.get('/api/technicians', (req, res) => {
    if (!req.session.user) return res.json([]);
    queryDB("SELECT id, ad, soyad FROM users WHERE rol = 'teknisyen'").then(rows => res.json(rows)).catch(() => res.json([]));
});

// API: İş Listesi (DB + JSON Birleşik)
// Artık getCombinedTasks fonksiyonunu kullanıyor.
app.get('/api/tasks', async (req, res) => {
    if (!req.session.user) return res.json([]);
    try {
        const combinedTasks = await getCombinedTasks(req.session.user);
        res.json(combinedTasks);
    } catch (e) {
        res.json([]);
    }
});

// API: Havuz (Sadece DB - Operatör İçin)
app.get('/api/pool', async (req, res) => {
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.json([]);
    try {
        const rows = await queryDB(`
            SELECT tickets.*, users.ad, users.soyad, users.birim, users.sicil,
            techs.ad as tech_ad, techs.soyad as tech_soyad
            FROM tickets 
            JOIN users ON tickets.user_id = users.id 
            LEFT JOIN users as techs ON tickets.teknisyen_id = techs.id
            ORDER BY CASE WHEN tickets.durum = 'beklemede' THEN 1 ELSE 2 END, tickets.tarih DESC
        `);
        res.json(rows);
    } catch (e) { res.json([]); }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

server.listen(3000, () => console.log('Sistem 3000 portunda çalışıyor.'));