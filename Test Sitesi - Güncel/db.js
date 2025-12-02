const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ariza_sistemi.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Veritabanı bağlantı hatası:', err.message);
    else console.log('SQLite veritabanına bağlanıldı.');
});

db.serialize(() => {
    // Kullanıcılar Tablosu
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sicil TEXT UNIQUE,
        ad TEXT,
        soyad TEXT,
        telefon TEXT,
        kat TEXT,
        birim TEXT,
        sifre TEXT,
        cihaz_bilgisi TEXT,
        rol TEXT DEFAULT 'kullanici'
    )`);

    // Arıza Kayıtları Tablosu
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        teknisyen_id INTEGER,
        sorun_basligi TEXT,
        detay TEXT,
        durum TEXT DEFAULT 'beklemede',
        cihaz_adi TEXT,
        tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // --- YENİ ZİMMET SİSTEMİ (SADELEŞTİRİLMİŞ) ---

    // 1. Ürün Tanımları (Sadece listeden seçmek için)
    // Örn: HP 85A, Canon Drum vb. (Adet bilgisi YOK)
    db.run(`CREATE TABLE IF NOT EXISTS stock_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tur TEXT,
        ad TEXT
    )`);

    // 2. Dağıtım Kayıtları (Kim ne aldı?)
    db.run(`CREATE TABLE IF NOT EXISTS stock_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        urun_tipi TEXT,      -- Toner, Drum vb.
        model TEXT,          -- HP 85A vb.
        teslim_alan TEXT,    -- Ahmet Hakim, Kalem vb.
        adet INTEGER,        -- Verilen miktar
        aciklama TEXT,
        islem_yapan TEXT,
        tarih DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- HIZLI İŞ KAYDI TABLOSU (İZOLE SİSTEM) ---
    // Bu tablo ana arıza havuzundan bağımsızdır.
    db.run(`CREATE TABLE IF NOT EXISTS quick_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tech_id INTEGER,         -- İşi yapan teknisyen ID
        tech_adsoyad TEXT,       -- İşi yapanın adı (Performans için)
        baslik TEXT,             -- Yapılan işin özeti
        aciklama TEXT,           -- Detaylar
        yapilan_yer TEXT,        -- Hangi birim/oda/kişi
        tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tech_id) REFERENCES users(id)
    )`);
});

module.exports = db;