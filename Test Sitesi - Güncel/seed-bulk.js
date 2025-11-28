const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Veritabanı bağlantısı
const db = new sqlite3.Database('./ariza_sistemi.db');

// --- AYARLAR ---
const TOTAL_BOTS = 300; // Kaç adet bot eklensin?
const DEFAULT_PASS = '123456'; // Hepsinin şifresi aynı olsun

// --- RASTGELE VERİ HAVUZU ---
const adlar = [
    "Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "Hasan", "İbrahim", "Yusuf", "Osman", "Murat",
    "Ömer", "Ramazan", "Halil", "Süleyman", "Abdullah", "Mahmut", "Salih", "Kemal", "Recep", "Fatih",
    "Ayşe", "Fatma", "Emine", "Hatice", "Zeynep", "Elif", "Meryem", "Şerife", "Zehra", "Sultan",
    "Hanife", "Merve", "Havva", "Zeliha", "Esra", "Fadime", "Özlem", "Hacer", "Yasemin", "Hülya"
];

const soyadlar = [
    "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
    "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
    "Polat", "Korkmaz", "Özcan", "Çakır", "Erdoğan", "Yavuz", "Can", "Acar", "Şen", "Aktaş"
];

const birimler = [
    "1. İdare Mahkemesi", "2. İdare Mahkemesi", "3. İdare Mahkemesi", 
    "1. Vergi Mahkemesi", "2. Vergi Mahkemesi", 
    "Bilgi İşlem", "Medya İletişim", "İdari İşler", "Adalet Komisyonu", 
    "Bölge İdare Mahkemesi", "Ön Büro", "Tarama Birimi"
];

const roller = ['kullanici', 'kullanici', 'kullanici', 'kullanici', 'operator', 'teknisyen']; // Ağırlıklı olarak kullanıcı olsun

// --- YARDIMCI FONKSİYONLAR ---
function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhone() {
    return '05' + Math.floor(100000000 + Math.random() * 900000000); // Rastgele 5xx...
}

// --- ANA İŞLEM ---
async function bulkSeed() {
    console.log(`🚀 ${TOTAL_BOTS} adet rastgele kullanıcı oluşturuluyor...`);
    
    // Şifreyi 1 kere hash'le (Performans için döngü dışında)
    const hashedPassword = await bcrypt.hash(DEFAULT_PASS, 10);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION"); // İşlemi hızlandırmak için Transaction başlat

        const stmt = db.prepare(`
            INSERT INTO users (sicil, ad, soyad, telefon, kat, birim, sifre, rol, cihaz_bilgisi) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'TOPLU_BOT_OLUSTURMA')
        `);

        let addedCount = 0;

        for (let i = 1; i <= TOTAL_BOTS; i++) {
            const ad = randomPick(adlar);
            const soyad = randomPick(soyadlar);
            const birim = randomPick(birimler);
            const rol = randomPick(roller);
            
            // Sicil No: TEST + Sıra Numarası (Örn: TEST101)
            // Çakışmayı önlemek için sayı kullanıyoruz
            const sicil = `TEST${1000 + i}`; 
            const kat = Math.floor(Math.random() * 10) + 1; // 1-10 arası kat

            stmt.run(
                sicil, ad, soyad, generatePhone(), kat, birim, hashedPassword, rol,
                (err) => {
                    if (!err) addedCount++;
                }
            );
        }

        stmt.finalize();

        db.run("COMMIT", (err) => {
            if (err) console.error("Hata:", err.message);
            else {
                console.log(`\n✅ İşlem Başarılı!`);
                console.log(`Toplam ${TOTAL_BOTS} adet kullanıcı veritabanına eklendi.`);
                console.log(`Hepsinin şifresi: ${DEFAULT_PASS}`);
                console.log(`Örnek Sicil Numaraları: TEST1001, TEST1002...`);
            }
        });
    });
}

bulkSeed();