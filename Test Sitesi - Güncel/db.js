const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ariza_sistemi.db');

db.serialize(() => {
    // Kullanıcılar Tablosu
    // 'sicil TEXT UNIQUE' sayesinde aynı sicil ile ikinci kayıt yapılamaz.
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sicil TEXT UNIQUE,
        ad TEXT,
        soyad TEXT,
        telefon TEXT,
        kat TEXT,
        birim TEXT,
        sifre TEXT,
        rol TEXT DEFAULT 'kullanici',
        cihaz_bilgisi TEXT
    )`);

    // Arızalar Tablosu
    // Server.js'de gönderilen 'cihaz_adi' sütunu buraya eklendi.
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        sorun_basligi TEXT,
        detay TEXT,
        durum TEXT DEFAULT 'beklemede',
        teknisyen_id INTEGER,
        cihaz_adi TEXT, 
        tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // db.js içine eklenecek (diğer CREATE TABLE kodlarının altına)

// Stok / Zimmet Kayıtları Tablosu
    db.run(`CREATE TABLE IF NOT EXISTS stock_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        urun_tipi TEXT,      -- Örn: Toner, Drum, Fuser
        model TEXT,          -- Örn: HP 85A, Canon CRG...
        teslim_alan TEXT,    -- Örn: 12. İdare Kalem, Ahmet Bey...
        adet INTEGER DEFAULT 1,
        aciklama TEXT,
        islem_yapan TEXT,    -- Kaydı giren operatörün adı
        tarih DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

// Dinamik Tanımlamalar Tablosu
    db.run(`CREATE TABLE IF NOT EXISTS stock_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tur TEXT,    -- Örn: Toner, Drum
        ad TEXT      -- Örn: Kyocera, Xerox (Sonradan eklenenler)
    )`);
});

module.exports = db;