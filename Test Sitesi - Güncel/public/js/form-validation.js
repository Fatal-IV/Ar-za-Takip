/**
 * form-validation.js
 * Form alanları için otomatik düzenleme ve doğrulama işlemleri
 */

document.addEventListener("DOMContentLoaded", () => {
    
    // Düzenlenecek input isimleri
    const targetInputs = ['ad', 'soyad'];

    // Türkçe karakter uyumlu Title Case fonksiyonu
    const toTitleCase = (str) => {
        if (!str) return "";
        // Birden fazla boşluğu tek boşluğa indir ve kelimelere ayır
        return str.trim().split(/\s+/).map(word => {
            // İlk harfi büyüt (tr-TR), gerisini küçült
            return word.charAt(0).toLocaleUpperCase('tr-TR') + 
                   word.slice(1).toLocaleLowerCase('tr-TR');
        }).join(' ');
    };

    // Hedeflenen inputlara "blur" (odaktan çıkma) dinleyicisi ekle
    targetInputs.forEach(name => {
        const inputElement = document.querySelector(`input[name="${name}"]`);
        
        if (inputElement) {
            inputElement.addEventListener('blur', (e) => {
                const originalValue = e.target.value;
                const formattedValue = toTitleCase(originalValue);

                // Sadece değişiklik varsa değeri güncelle (Performans için)
                if (originalValue !== formattedValue) {
                    e.target.value = formattedValue;
                }
            });
        }
    });
});