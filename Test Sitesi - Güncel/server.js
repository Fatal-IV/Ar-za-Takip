const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');
const path = require('path');
const os = require('os');
// fs modülü kaldırıldı (Artık JSON işlemi yok)

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

// 3. Görevleri Getirme (Sadece DB) - Güncellendi
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

        // Sırala (En yeniden eskiye)
        formattedDbTasks.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

        return formattedDbTasks;
    } catch (err) {
        console.error("Görev getirme hatası:", err);
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

        // 3. Teknisyen Saha İşleri (SADECE DB)
        if (user.rol === 'teknisyen' || user.rol === 'admin') {
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


// --- STOK/ZİMMET YÖNETİMİ ROTALARI (GÜNCEL) ---
// 1. Verileri Getir (API)
app.get('/api/stocks', async (req, res) => {
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.json({});
    
    try {
        // Tanımlı ürün listesi (Dropdown için)
        const definitions = await queryDB("SELECT * FROM stock_definitions ORDER BY tur, ad");
        // Geçmiş kayıtlar (Son 50 işlem)
        const logs = await queryDB("SELECT * FROM stock_logs ORDER BY tarih DESC LIMIT 50");
        
        res.json({ definitions, logs });
    } catch (e) {
        res.json({ definitions: [], logs: [] });
    }
});

// 2. Yeni Ürün Tanımı Ekle (Listeye ekler)
app.post('/stock/def/add', (req, res) => {
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.sendStatus(403);
    const { tur, ad } = req.body;
    db.run("INSERT INTO stock_definitions (tur, ad) VALUES (?, ?)", [tur, ad], () => res.redirect('/dashboard'));
});

// 3. Ürün Tanımını Sil
app.post('/stock/def/delete', (req, res) => {
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.sendStatus(403);
    db.run("DELETE FROM stock_definitions WHERE id = ?", [req.body.id], () => res.redirect('/dashboard'));
});

// 4. Ürün Ver / Kaydet (ANA İŞLEM)
app.post('/stock/add', (req, res) => { // Route ismini değiştirmedim, formlar bozulmasın diye
    if (!req.session.user || !['admin', 'operator'].includes(req.session.user.rol)) return res.sendStatus(403);

    const { model_select, alici_unvan, alici_ad, adet, aciklama } = req.body;
    
    // Model bilgisi string olarak geliyor: "Toner|HP 85A"
    const [tur, model] = model_select.split('|'); 
    const teslim_alan = `${alici_unvan} - ${alici_ad}`;
    const islem_yapan = req.session.user.ad + ' ' + req.session.user.soyad;

    db.run(`INSERT INTO stock_logs (urun_tipi, model, teslim_alan, adet, aciklama, islem_yapan) VALUES (?, ?, ?, ?, ?, ?)`,
        [tur, model, teslim_alan, adet, aciklama, islem_yapan],
        () => res.redirect('/dashboard')
    );
});

// 5. Hatalı Kaydı Sil (Admin)
app.post('/stock/delete', (req, res) => {
    if (!req.session.user || req.session.user.rol !== 'admin') return res.sendStatus(403);
    db.run("DELETE FROM stock_logs WHERE id = ?", [req.body.id], () => res.redirect('/dashboard'));
});

// --- ADMIN KULLANICI İŞLEMLERİ ---
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

// API: İş Listesi (Sadece DB)
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

// --- HIZLI İŞ KAYDI (QUICK TASK) ROTALARI ---

// 1. Verileri Getir (Listeleme)
app.get('/api/quick-tasks', async (req, res) => {
    // Giriş yapılmamışsa boş döndür
    if (!req.session.user) return res.json({ tasks: [], techs: [] });

    const role = req.session.user.rol;
    const userId = req.session.user.id;
    let tasks = [];
    let techs = [];

    try {
        if (role === 'teknisyen') {
            // Teknisyen sadece kendi yaptıklarını görür
            tasks = await queryDB("SELECT * FROM quick_tasks WHERE tech_id = ? ORDER BY tarih DESC", [userId]);
        } else if (['admin', 'operator'].includes(role)) {
            // Admin ve Operatör hepsini görür
            tasks = await queryDB("SELECT * FROM quick_tasks ORDER BY tarih DESC");
            // Filtreleme için teknisyen listesini de gönderelim
            techs = await queryDB("SELECT id, ad, soyad FROM users WHERE rol IN ('teknisyen', 'admin')");
        }
        res.json({ tasks, techs, currentUserRole: role });
    } catch (e) {
        console.error("Veri çekme hatası:", e);
        res.json({ tasks: [], techs: [] });
    }
});

// 2. Yeni Hızlı İş Ekle (Kayıt)
app.post('/quick-task/add', (req, res) => {
    if (!req.session.user) return res.sendStatus(403);

    const { baslik, aciklama, yapilan_yer } = req.body;
    const tech_id = req.session.user.id;
    // Ad Soyad bilgisini session'dan alıp birleştiriyoruz
    const tech_adsoyad = req.session.user.ad + ' ' + req.session.user.soyad;

    db.run(
        "INSERT INTO quick_tasks (tech_id, tech_adsoyad, baslik, aciklama, yapilan_yer) VALUES (?, ?, ?, ?, ?)",
        [tech_id, tech_adsoyad, baslik, aciklama, yapilan_yer],
        (err) => {
            if(err) {
                console.error("Ekleme hatası:", err);
            }
            res.redirect('/dashboard');
        }
    );
});

// 3. İş Silme
app.post('/quick-task/delete', async (req, res) => {
    if (!req.session.user) return res.sendStatus(403);
    
    const taskId = req.body.id;
    
    // Güvenlik: Sadece admin veya kaydı yapan silebilir
    const task = await queryDB("SELECT tech_id FROM quick_tasks WHERE id = ?", [taskId]);
    
    if(task && task.length > 0) {
        if (req.session.user.rol === 'admin' || task[0].tech_id === req.session.user.id) {
            db.run("DELETE FROM quick_tasks WHERE id = ?", [taskId], () => res.redirect('/dashboard'));
        } else {
            res.status(403).send("Yetkisiz işlem.");
        }
    } else {
        res.redirect('/dashboard');
    }
});

// --- HIZLI İŞ KAYDI (QUICK TASK) ROTALARI ---

// 1. Verileri Getir (Rol bazlı filtreleme ile)
app.get('/api/quick-tasks', async (req, res) => {
    if (!req.session.user) return res.json({ tasks: [], techs: [] });

    const role = req.session.user.rol;
    const userId = req.session.user.id;
    let tasks = [];
    let techs = [];

    try {
        if (role === 'teknisyen') {
            // Teknisyen sadece kendi yaptıklarını görür
            tasks = await queryDB("SELECT * FROM quick_tasks WHERE tech_id = ? ORDER BY tarih DESC", [userId]);
        } else if (['admin', 'operator'].includes(role)) {
            // Admin ve Operatör hepsini görür
            tasks = await queryDB("SELECT * FROM quick_tasks ORDER BY tarih DESC");
            // Filtreleme için teknisyen listesini de gönderelim
            techs = await queryDB("SELECT id, ad, soyad FROM users WHERE rol IN ('teknisyen', 'admin')");
        }
        res.json({ tasks, techs, currentUserRole: role });
    } catch (e) {
        console.error(e);
        res.json({ tasks: [], techs: [] });
    }
});

// 2. Yeni Hızlı İş Ekle
app.post('/quick-task/add', (req, res) => {
    if (!req.session.user) return res.sendStatus(403);

    const { baslik, aciklama, yapilan_yer } = req.body;
    const tech_id = req.session.user.id;
    const tech_adsoyad = req.session.user.ad + ' ' + req.session.user.soyad;

    db.run(
        "INSERT INTO quick_tasks (tech_id, tech_adsoyad, baslik, aciklama, yapilan_yer) VALUES (?, ?, ?, ?, ?)",
        [tech_id, tech_adsoyad, baslik, aciklama, yapilan_yer],
        (err) => {
            if(err) console.error(err);
            res.redirect('/dashboard');
        }
    );
});

// 3. İş Silme (Sadece Admin veya Kendi kaydı ise)
app.post('/quick-task/delete', async (req, res) => {
    if (!req.session.user) return res.sendStatus(403);
    
    const taskId = req.body.id;
    
    // Güvenlik kontrolü: Silmeye çalışan kişi admin mi yoksa kaydın sahibi mi?
    const task = await queryDB("SELECT tech_id FROM quick_tasks WHERE id = ?", [taskId]);
    
    if(task && task.length > 0) {
        if (req.session.user.rol === 'admin' || task[0].tech_id === req.session.user.id) {
            db.run("DELETE FROM quick_tasks WHERE id = ?", [taskId], () => res.redirect('/dashboard'));
        } else {
            res.status(403).send("Bu kaydı silmeye yetkiniz yok.");
        }
    } else {
        res.redirect('/dashboard');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

server.listen(3000, () => console.log('Sistem 3000 portunda çalışıyor.'));