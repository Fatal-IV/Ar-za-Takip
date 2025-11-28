/**
 * register-logic.js
 * Kat ve Birim seçimlerini dinamik olarak yönetir.
 */

document.addEventListener("DOMContentLoaded", () => {
    
    // Kullanıcının ilettiği veri seti
    const dataMap = {
        "1": ["24. İdare Mahkemesi", "25. İdare Mahkemesi"],
        "2": ["21. İdare Mahkemesi", "22. İdare Mahkemesi"],
        "3": ["19. İdare Mahkemesi", "20. İdare Mahkemesi"],
        "4": ["17. İdare Mahkemesi", "18. İdare Mahkemesi"],
        "5": ["15. İdare Mahkemesi", "16. İdare Mahkemesi"],
        "6": ["13. İdare Mahkemesi", "14. İdare Mahkemesi"],
        "7": ["11. İdare Mahkemesi", "12. İdare Mahkemesi"],
        "8": ["9. İdare Mahkemesi", "10. İdare Mahkemesi"],
        "9": ["7. İdare Mahkemesi", "8. İdare Mahkemesi"],
        "10": ["5. İdare Mahkemesi", "6. İdare Mahkemesi"],
        "11": ["3. İdare Mahkemesi", "4. İdare Mahkemesi"],
        "12": ["1. İdare Mahkemesi", "2. İdare Mahkemesi"],
        "13": ["27. İdare Mahkemesi", "23. İdare Mahkemesi"],
        "14": ["26. İdare Mahkemesi", "5. Vergi Dava Dairesi"],
        "15": ["15. İdari Dava Dairesi"],
        "16": ["14. İdari Dava Dairesi"],
        "17": ["Başkanlık", "Medya/İletişim", "İdari İşler - Adalet Komisyon"]
    };

    const katSelect = document.getElementById('katSelect');
    const birimSelect = document.getElementById('birimSelect');

    // 1. Kat Seçim Kutusunu Doldur
    // Object.keys ile verideki anahtarları (1, 2, 3...) alıp döngüye sokuyoruz
    Object.keys(dataMap).forEach(kat => {
        const option = document.createElement('option');
        option.value = kat;
        option.textContent = `${kat}. Kat`; // Görünür metin
        katSelect.appendChild(option);
    });

    // 2. Kat Değiştiğinde Birimleri Güncelle
    katSelect.addEventListener('change', function() {
        const secilenKat = this.value;
        
        // Önce birim kutusunu temizle
        birimSelect.innerHTML = '<option value="" disabled selected>Birim Seçiniz</option>';
        
        if (secilenKat && dataMap[secilenKat]) {
            // Birim kutusunu aktif et
            birimSelect.disabled = false;

            // O kata ait birimleri ekle
            dataMap[secilenKat].forEach(birim => {
                const option = document.createElement('option');
                option.value = birim;
                option.textContent = birim;
                birimSelect.appendChild(option);
            });
        } else {
            birimSelect.disabled = true;
        }
    });
});