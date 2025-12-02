// public/js/operator-logic.js

const ticketModal = document.getElementById('ticketDetailModal');
let currentFilter = 'all'; // Varsayılan filtre: Tümü

// --- SAYFA YÜKLENDİĞİNDE ÇALIŞACAKLAR ---
document.addEventListener("DOMContentLoaded", () => {
    // İlk yüklemede tabloyu doldur
    if (typeof refreshPoolTable === 'function') {
        refreshPoolTable(); 
    }
});

// --- FİLTRELEME FONKSİYONU ---
// EJS dosyasındaki onclick="filterPool('beklemede', this)" tarafından çağrılır
function filterPool(filterType, btn) {
    // 1. Görsel olarak aktif butonu değiştir
    const buttons = document.querySelectorAll('.filter-bar .filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    
    if (btn) {
        btn.classList.add('active');
    }

    // 2. Filtre durumunu güncelle
    currentFilter = filterType;

    // 3. Tabloyu bu yeni filtreye göre yenile
    refreshPoolTable();
}

// --- MODAL İŞLEMLERİ ---
function openTicketModal(ticket) {
    if(!ticketModal) return;
    
    // Değerleri doldur (Input ve Textarea)
    document.getElementById('view_adsoyad').value = ticket.ad + ' ' + ticket.soyad;
    document.getElementById('view_tarih').value = new Date(ticket.tarih).toLocaleString('tr-TR');
    document.getElementById('view_birim').value = ticket.birim;
    document.getElementById('view_baslik').value = ticket.sorun_basligi;
    document.getElementById('view_detay').value = ticket.detay;
    document.getElementById('view_sicil').value = ticket.sicil || '-';
    document.getElementById('view_cihaz').value = ticket.cihaz_adi || 'IP Bilgisi Yok';

    // Durum rozetini ayarla
    const statusSpan = document.getElementById('view_durum');
    statusSpan.textContent = ticket.durum.toUpperCase();
    
    // Eski sınıfları temizle ve yenisini ekle
    statusSpan.classList.remove('status-beklemede', 'status-atandi', 'status-cozuldu');
    statusSpan.classList.add('status-' + ticket.durum);

    // Modalı göster (CSS flex ortalama ayarı ile)
    ticketModal.classList.add('show');
}

function closeTicketModal() {
    if(ticketModal) ticketModal.classList.remove('show');
}

// Dışarı tıklayınca modal kapatma
window.onclick = function(event) {
    if (event.target == ticketModal) closeTicketModal();
    
    // Admin düzenleme modalı varsa onu da kapat
    const adminModal = document.getElementById('editUserModal');
    if (adminModal && event.target == adminModal) adminModal.classList.remove('show');
}

// --- HAVUZ TABLOSUNU YENİLEME (Filtre Destekli) ---
async function refreshPoolTable() {
    const tableContainer = document.querySelector('#admin .operator-table tbody');
    if (!tableContainer) return;

    try {
        // Cache önlemek için ?t=Date.now() ekledik
        const [poolRes, techRes] = await Promise.all([
            fetch('/api/pool?t=' + Date.now()),
            fetch('/api/technicians?t=' + Date.now())
        ]);

        let tickets = await poolRes.json();
        const technicians = await techRes.json();

        // --- FİLTRELEME MANTIĞI ---
        if (currentFilter === 'beklemede') {
            // Sadece beklemede olanlar
            tickets = tickets.filter(t => t.durum === 'beklemede');
        } else if (currentFilter === 'atandi') {
            // Atananlar (Atanmış veya Çözülmüş olanlar)
            tickets = tickets.filter(t => t.durum === 'atandi' || t.durum === 'cozuldu');
        }
        // 'all' ise filtreleme yapma, hepsini göster.

        // Tabloyu temizle
        tableContainer.innerHTML = '';

        // Eğer filtre sonucu boşsa mesaj göster
        if (tickets.length === 0) {
            const colSpan = (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin') ? 7 : 6;
            let msg = 'Kayıt bulunamadı.';
            
            if(currentFilter === 'beklemede') msg = 'Şu an bekleyen arıza yok, harika!';
            else if(currentFilter === 'atandi') msg = 'Henüz atanan bir arıza bulunmuyor.';
            
            tableContainer.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" style="text-align:center; padding: 40px; color: var(--text-sub);">
                        <span class="material-icons-round" style="font-size: 48px; display:block; margin-bottom:10px; opacity:0.5;">inbox</span>
                        ${msg}
                    </td>
                </tr>`;
            return;
        }

        // Satırları Oluştur
        tickets.forEach(t => {
            const tr = document.createElement('tr');

            // 1. Talep Eden
            let htmlContent = `
                <td style="padding-left: 24px;">
                    <div class="user-meta">
                        <div class="user-avatar-small">${t.ad.charAt(0)}${t.soyad.charAt(0)}</div>
                        <div class="meta-text"><div>${t.ad} ${t.soyad}</div><div>${t.birim}</div></div>
                    </div>
                </td>
            `;

            // 2. Arıza Özeti
            const kisaDetay = t.detay.length > 40 ? t.detay.substring(0, 40) + '...' : t.detay;
            const tarihStr = new Date(t.tarih).toLocaleString('tr-TR');
            htmlContent += `
                <td>
                    <div class="issue-title">${t.sorun_basligi}</div>
                    <div class="issue-desc">${kisaDetay}</div>
                    <div style="font-size:0.75rem; color:#5f6368; margin-top:4px;">${tarihStr}</div>
                </td>`;

            // 3. Durum
            htmlContent += `<td><span class="status-badge status-${t.durum}">${t.durum.toUpperCase()}</span></td>`;

            // 4. İncele Butonu
            const ticketJson = JSON.stringify(t).replace(/"/g, '&quot;');
            htmlContent += `
                <td>
                    <button class="btn-action" style="width:auto; padding:8px; background:transparent; border:1px solid var(--border); color:var(--primary);" onclick="openTicketModal(${ticketJson})" title="Detayları Gör">
                        <span class="material-icons-round">visibility</span>
                    </button>
                </td>
            `;

            // 5. Teknisyen Ata (Dropdown veya İsim)
            let assignContent = '';
            if (t.durum !== 'cozuldu') {
                let optionsHtml = `<option value="" disabled selected>Teknisyen Seç</option>`;
                technicians.forEach(tech => {
                    const isSelected = t.teknisyen_id === tech.id ? 'selected' : '';
                    optionsHtml += `<option value="${tech.id}" ${isSelected}>${tech.ad} ${tech.soyad}</option>`;
                });

                assignContent = `
                    <form action="/assign-ticket" method="POST" class="assign-wrapper">
                        <input type="hidden" name="ticket_id" value="${t.id}">
                        <select name="teknisyen_id" class="tech-select" required>${optionsHtml}</select>
                        <button type="submit" class="btn-assign" title="Ata">
                            <span class="material-icons-round" style="font-size:18px;">arrow_forward</span>
                        </button>
                    </form>
                `;
            } else {
                const techName = t.tech_ad ? `${t.tech_ad} ${t.tech_soyad}` : 'Tamamlandı';
                assignContent = `
                    <div style="display:flex; align-items:center; gap:6px; color:var(--text-main); font-size:0.9rem; font-weight:600; background:#e6f4ea; padding:6px 10px; border-radius:20px; width:fit-content; border:1px solid #ceead6;">
                        <span class="material-icons-round" style="font-size:16px; color:var(--success);">verified</span> 
                        <span style="color:#137333;">${techName}</span>
                    </div>
                `;
            }
            htmlContent += `<td>${assignContent}</td>`;

            // 6. İşlem (Onayla Butonu)
            let actionContent = '';
            if (t.durum === 'atandi' || t.durum === 'beklemede') {
                actionContent = `
                    <form action="/resolve-ticket" method="POST">
                        <input type="hidden" name="ticket_id" value="${t.id}">
                        <button type="submit" class="btn-action" style="background-color: #fff; border: 1px solid var(--success); color: var(--success); padding: 5px 10px;" title="Arızayı Çözüldü Olarak İşaretle">
                            <span class="material-icons-round" style="font-size: 16px; vertical-align: middle;">check_circle</span>
                            <span style="vertical-align: middle; font-size: 13px; font-weight: 600;">Onayla</span>
                        </button>
                    </form>`;
            } else if (t.durum === 'cozuldu') {
                actionContent = `
                    <span style="color: var(--success); font-size: 13px; font-weight: 600;">
                    <span class="material-icons-round" style="font-size: 16px; vertical-align: bottom;">done_all</span>
                    </span>`;
            } else {
                actionContent = `<span style="color: var(--text-sub); font-size: 12px;">-</span>`;
            }
            htmlContent += `<td>${actionContent}</td>`;

            // 7. Sil (Sadece Admin)
            if (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin') {
                htmlContent += `
                    <td style="text-align:center;">
                        <form action="/delete-ticket" method="POST" onsubmit="return confirm('Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?');">
                            <input type="hidden" name="ticket_id" value="${t.id}">
                            <button type="submit" class="btn-delete" title="Kaydı Sil">
                                <span class="material-icons-round">delete</span>
                            </button>
                        </form>
                    </td>`;
            }

            tr.innerHTML = htmlContent;
            tableContainer.appendChild(tr);
        });
        
        // Tablo dolunca hafif bir animasyon
        tableContainer.style.opacity = "0.5";
        setTimeout(() => { tableContainer.style.opacity = "1"; }, 300);
        
    } catch (error) { 
        console.error("Havuz yenilenirken hata:", error); 
    }
}