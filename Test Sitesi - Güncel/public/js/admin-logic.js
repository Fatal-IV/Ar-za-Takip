// public/js/admin-logic.js

const modal = document.getElementById('editUserModal');

// Modalı Aç ve Verileri Doldur
function openEditModal(user) {
    if(!modal) return;

    // Verileri inputlara aktar
    document.getElementById('edit_id').value = user.id;
    document.getElementById('edit_ad').value = user.ad;
    document.getElementById('edit_soyad').value = user.soyad;
    document.getElementById('edit_sicil').value = user.sicil;
    document.getElementById('edit_telefon').value = user.telefon;
    document.getElementById('edit_birim').value = user.birim;
    document.getElementById('edit_rol').value = user.rol;
    
    // Şifre alanını temizle
    document.querySelector('input[name="yeni_sifre"]').value = "";

    // Modalı göster
    modal.classList.add('show');
}

// Modalı Kapat
function closeEditModal() {
    if(modal) modal.classList.remove('show');
}

// Dışarı tıklayınca kapat
window.onclick = function(event) {
    if (event.target == modal) {
        closeEditModal();
    }
}

// public/js/admin-logic.js EN ALTINA EKLE

// --- TABLO ARAMA / FİLTRELEME FONKSİYONU ---
function filterUsersTable() {
    // 1. Girdiyi al ve büyük harfe çevir (Büyük/küçük harf duyarlılığını kaldırmak için)
    const input = document.getElementById("userSearchInput");
    const filter = input.value.toLocaleUpperCase('tr-TR'); // Türkçe karakter desteği
    
    // 2. Tabloyu ve satırları bul
    const table = document.getElementById("usersTable");
    const tr = table.getElementsByTagName("tr");

    // 3. Satırları gez (Başlık satırını (0) atla)
    for (let i = 1; i < tr.length; i++) {
        // İlk sütunu (Personel bilgisi: Ad, Soyad, Sicil) al
        const td = tr[i].getElementsByTagName("td")[0];
        
        if (td) {
            // Sütundaki metni al
            const txtValue = td.textContent || td.innerText;
            
            // Aranan kelime bu metnin içinde var mı?
            if (txtValue.toLocaleUpperCase('tr-TR').indexOf(filter) > -1) {
                tr[i].style.display = ""; // Varsa göster
            } else {
                tr[i].style.display = "none"; // Yoksa gizle
            }
        }       
    }
}

// --- AJAX İLE KULLANICI SİLME ---
async function deleteUser(id, btnElement, userName) {
    // 1. Onay iste
    if (!confirm(`DİKKAT: ${userName} isimli kullanıcıyı silmek istediğinize emin misiniz?`)) {
        return;
    }

    // 2. Butonu pasif yap (Çift tıklamayı önlemek için)
    btnElement.disabled = true;
    const originalContent = btnElement.innerHTML;
    btnElement.innerHTML = '<span class="material-icons-round action-spin">sync</span>'; // Dönme efekti ekleyebiliriz css varsa, yoksa kum saati

    try {
        // 3. Sunucuya istek gönder
        const response = await fetch('/admin/delete-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: id })
        });

        const result = await response.json();

        if (result.success) {
            // 4. BAŞARILI: Satırı tablodan sil
            // Butonun bulunduğu satırı (tr) bul
            const row = btnElement.closest('tr');
            
            // Hafif bir solma efekti verelim
            row.style.transition = 'all 0.5s ease';
            row.style.opacity = '0';
            row.style.transform = 'translateX(20px)';
            
            // Animasyon bitince HTML'den tamamen kaldır
            setTimeout(() => {
                row.remove();
                // İstersen burada "Kullanıcı silindi" diye Toast gösterebilirsin
            }, 500);

        } else {
            // BAŞARISIZ: Hata mesajı göster
            alert('Hata: ' + result.message);
            // Butonu eski haline getir
            btnElement.disabled = false;
            btnElement.innerHTML = originalContent;
        }

    } catch (error) {
        console.error('Silme hatası:', error);
        alert('Bir bağlantı hatası oluştu.');
        btnElement.disabled = false;
        btnElement.innerHTML = originalContent;
    }
}