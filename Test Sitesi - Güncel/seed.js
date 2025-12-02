const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Veritabanına bağlan
const db = new sqlite3.Database('./ariza_sistemi.db');

// Eklenecek Bot Hesaplar (Şifreleri: 123456)
const bots = [
    {
        sicil: 'ADMIN01',
        ad: 'Süper',
        soyad: 'Admin',
        telefon: '0500 000 0000',
        birim: 'Bilgi İşlem',
        rol: 'admin'
    },
    {
        sicil: 'OPR01',
        ad: 'Ayşe',
        soyad: 'Operatör',
        telefon: '0500 111 1111',
        birim: 'Çağrı Merkezi',
        rol: 'operator'
    },
    {
        sicil: 'TEK01',
        ad: 'Mehmet',
        soyad: 'Teknisyen',
        telefon: '0500 222 2222',
        birim: 'Saha Ekibi',
        rol: 'teknisyen'
    },
    {
        sicil: 'TEK02',
        ad: 'Can',
        soyad: 'Teknisyen',
        telefon: '0500 333 3333',
        birim: 'Ağ Uzmanı',
        rol: 'teknisyen'
    },
    {
        sicil: 'USR01',
        ad: 'Ahmet',
        soyad: 'Kullanıcı',
        telefon: '0500 444 4444',
        kat: '3',
        birim: '11. İdare Mahkemesi',
        rol: 'kullanici'
    }
];

// Botları Ekleme Fonksiyonu
async function seedBots() {
    console.log("Bot hesaplar ekleniyor...");
    
    // Şifre: "123456" (Hashlenmiş hali)
    const hashedPassword = await bcrypt.hash('123456', 10);

    db.serialize(() => {
        const stmt = db.prepare(`
            INSERT INTO users (sicil, ad, soyad, telefon, kat, birim, sifre, rol, cihaz_bilgisi) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BOT_HESAP')
        `);

        bots.forEach(bot => {
            // Kat bilgisi yoksa boş bırak
            const kat = bot.kat || '-';

            stmt.run(
                bot.sicil, 
                bot.ad, 
                bot.soyad, 
                bot.telefon, 
                kat, 
                bot.birim, 
                hashedPassword, // Şifrelenmiş şifre
                bot.rol,
                (err) => {
                    if (err) {
                        if(err.message.includes('UNIQUE constraint')) {
                            console.log(`[ATLANDI] ${bot.ad} ${bot.soyad} (${bot.sicil}) zaten var.`);
                        } else {
                            console.error("Hata:", err.message);
                        }
                    } else {
                        console.log(`[EKLENDİ] ${bot.rol.toUpperCase()}: ${bot.ad} ${bot.soyad} (${bot.sicil})`);
                    }
                }
            );
        });

        stmt.finalize(() => {
            console.log("\n--- İşlem Tamamlandı ---");
            console.log("Tüm bot hesapların şifresi: 123456");
        });
    });
}

seedBots();