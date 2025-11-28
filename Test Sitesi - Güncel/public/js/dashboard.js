// public/js/dashboard.js

const socket = io();
let currentTaskFilter = 'all'; // Tümü (all), Arıza Kaydı (db), Hızlı Giriş (json)

// --- PANEL NAVİGASYONU ---
function showPanel(panelId, btnElement) {
    document.querySelectorAll('.panel-section').forEach(el => el.classList.remove('active'));
    
    const targetPanel = document.getElementById(panelId);
    if(targetPanel) targetPanel.classList.add('active');

    if (btnElement) {
        document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${panelId}'`)) {
                btn.classList.add('active');
            }
        });
    }
    
    localStorage.setItem('activePanel', panelId);
    const mainContent = document.querySelector('.main-content');
    if(mainContent) mainContent.scrollTop = 0;
}

// --- SAYFA YÜKLENİNCE ---
document.addEventListener("DOMContentLoaded", () => {
    const lastPanel = localStorage.getItem('activePanel');
    if(lastPanel && document.getElementById(lastPanel)) showPanel(lastPanel);
    else showPanel('home');

    refreshTaskTable(); // İlk açılışta tabloyu doldur
});

// --- SOCKET.IO BİLDİRİMLERİ ---
socket.on('refresh_dashboard', () => {
    if (typeof refreshTaskTable === 'function') refreshTaskTable();
    if (typeof refreshPoolTable === 'function') refreshPoolTable();
    if (typeof refreshTechnicianList === 'function') refreshTechnicianList();
});

// --- FİLTRELEME FONKSİYONU (YENİ) ---
function filterTaskTable(filterType, btn) {
    // Buton aktiflik durumu
    const buttons = document.querySelectorAll('#tech-tasks .filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentTaskFilter = filterType;
    refreshTaskTable();
}

// --- İŞ LİSTESİ TABLOSUNU YENİLEME ---
async function refreshTaskTable() {
    const tableBody = document.querySelector('#tech-tasks tbody');
    if (!tableBody) return; 

    try {
        const response = await fetch('/api/tasks?t=' + Date.now());
        let tasks = await response.json();

        // FİLTRELEME MANTIĞI
        if (currentTaskFilter === 'db') {
            tasks = tasks.filter(t => t.source !== 'json');
        } else if (currentTaskFilter === 'json') {
            tasks = tasks.filter(t => t.source === 'json');
        }

        tableBody.innerHTML = '';

        if (tasks.length === 0) {
            const colCount = (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin') ? 6 : 5;
            let msg = 'Kayıt bulunamadı.';
            if(currentTaskFilter === 'db') msg = 'Aktif arıza kaydı bulunmuyor.';
            if(currentTaskFilter === 'json') msg = 'Hızlı saha girişi kaydı bulunmuyor.';
            
            tableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; padding:30px; color:var(--text-sub);">${msg}</td></tr>`;
            return;
        }

        tasks.forEach(t => {
            const tr = document.createElement('tr');
            
            // 1. İKON MANTIĞI: JSON ise Şimşek, DB ise Baş Harfler
            let avatarHtml = '';
            
            if (t.source === 'json') {
                // HIZLI İŞ İÇİN ÖZEL İKON
                avatarHtml = `
                    <div class="user-avatar-small" style="background: rgba(234, 134, 0, 0.2); color: #ea8600; border: 1px solid rgba(234, 134, 0, 0.4);" title="Hızlı Saha Girişi">
                        <span class="material-icons-round" style="font-size:18px;">bolt</span>
                    </div>`;
            } else {
                // STANDART KAYIT İÇİN BAŞ HARFLER
                const initials = t.talep_eden_ad.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
                avatarHtml = `
                    <div class="user-avatar-small" style="background:#5f6368;" title="Arıza Bildirimi">
                        ${initials}
                    </div>`;
            }

            // 1. Kullanıcı Bilgisi Sütunu
            let htmlContent = `
                <td style="padding-left:24px;">
                    <div class="user-meta">
                        ${avatarHtml}
                        <div class="meta-text">
                            <div>${t.talep_eden_ad}</div>
                            <div>${t.hizmet_birimi}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="issue-title">${t.sorun_basligi}</div>
                    <div class="issue-desc" style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.detay}</div>
                </td>
            `;

            // 2. Admin ise Teknisyen Bilgisi
            if (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin') {
                const techName = t.tech_ad ? `${t.tech_ad} ${t.tech_soyad}` : '-';
                htmlContent += `<td style="color:var(--accent-blue); font-size:0.9rem;">${techName}</td>`;
            }

            // 3. Durum
            htmlContent += `<td><span class="status-badge status-${t.durum}">${t.durum.toUpperCase()}</span></td>`;

            // 4. İncele Butonu
            const ticketJson = JSON.stringify(t).replace(/"/g, '&quot;');
            htmlContent += `
                <td>
                    <button class="btn-action icon-only" style="background:transparent; border:1px solid var(--border-color); color:var(--accent-blue);" onclick="openTaskDetailModal(${ticketJson})" title="Detayları Gör">
                        <span class="material-icons-round">visibility</span>
                    </button>
                </td>
            `;

            // 5. Aksiyon (Sadece DB kaynaklı ve bitmemiş işler için)
            let actionContent = '';
            if (t.durum === 'cozuldu') {
                actionContent = `<span class="material-icons-round" style="color:var(--success);">done_all</span>`;
            } else {
                if (typeof currentUserRole !== 'undefined' && (currentUserRole === 'admin' || currentUserRole === 'operator')) {
                     actionContent = `
                        <form action="/resolve-ticket" method="POST" style="display:inline;">
                            <input type="hidden" name="ticket_id" value="${t.id}">
                            <button type="submit" class="btn-action" style="padding:6px 12px; font-size:0.8rem; width:auto; border-radius:6px; background:var(--bg-card); border:1px solid var(--success); color:var(--success);">
                                <span class="material-icons-round" style="font-size:16px;">check</span> Çözüldü
                            </button>
                        </form>`;
                } else {
                    actionContent = `<span style="font-size:12px; color:var(--text-sub); display:flex; align-items:center; gap:5px;"><span class="material-icons-round" style="font-size:16px;">pending</span>İşlemde</span>`;
                }
            }
            htmlContent += `<td>${actionContent}</td>`;
            
            tr.innerHTML = htmlContent;
            tableBody.appendChild(tr);
        });
        
        tableBody.style.opacity = "0.5";
        setTimeout(() => { tableBody.style.opacity = "1"; }, 300);
    } catch (error) { console.error("Hata:", error); }
}

// --- DETAY PENCERESİ ---
const taskModal = document.getElementById('taskDetailModal');

function openTaskDetailModal(task) {
    if(!taskModal) return;

    document.getElementById('task_adsoyad').value = task.talep_eden_ad;
    document.getElementById('task_birim').value = task.hizmet_birimi;
    document.getElementById('task_baslik').value = task.sorun_basligi;
    document.getElementById('task_tarih').value = new Date(task.tarih).toLocaleString('tr-TR');
    document.getElementById('task_detay').value = task.detay;
    document.getElementById('task_sicil').value = task.sicil || '-'; 
    document.getElementById('task_cihaz').value = task.cihaz_adi || 'Bilinmiyor'

    let yerBilgisi = task.hizmet_birimi;
    if (task.hizmet_kati && task.hizmet_kati !== '-') {
        yerBilgisi = `${task.hizmet_kati}. Kat / ${task.hizmet_birimi}`;
    }
    document.getElementById('task_hizmet_yeri').value = yerBilgisi;

    const statusSpan = document.getElementById('task_durum');
    statusSpan.textContent = task.durum.toUpperCase();
    statusSpan.className = 'status-badge status-' + task.durum; 

    taskModal.classList.add('show');
}

function closeTaskDetailModal() {
    if(taskModal) taskModal.classList.remove('show');
}

window.addEventListener('click', (e) => {
    if (e.target == taskModal) closeTaskDetailModal();
});