// public/js/quick-task-logic.js

let allQuickTasks = [];

document.addEventListener("DOMContentLoaded", () => {
    // Eğer panel varsa verileri çek
    if(document.getElementById('quick-task-panel')) {
        refreshQuickTasks();
    }
});

// Verileri Çek ve Listele
async function refreshQuickTasks() {
    try {
        const response = await fetch('/api/quick-tasks');
        const data = await response.json();
        
        allQuickTasks = data.tasks;
        const currentUserRole = data.currentUserRole;

        // 1. Teknisyen Filtresini Doldur (Sadece Admin/Operator)
        const filterWrapper = document.getElementById('techFilterWrapper');
        const filterSelect = document.getElementById('techFilterSelect');
        
        if (['admin', 'operator'].includes(currentUserRole) && data.techs.length > 0) {
            filterWrapper.style.display = 'block';
            // Mevcut seçimi koru
            const currentSelection = filterSelect.value;
            
            filterSelect.innerHTML = '<option value="all">Tüm Teknisyenler</option>';
            data.techs.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech.id; // Filtreleme ID üzerinden yapılacak
                option.textContent = `${tech.ad} ${tech.soyad}`;
                filterSelect.appendChild(option);
            });

            if(currentSelection) filterSelect.value = currentSelection;
        }

        // 2. Tabloyu Render Et
        renderQuickTaskTable(allQuickTasks);

    } catch (error) {
        console.error("Hızlı iş verileri çekilemedi:", error);
    }
}

// Filtreleme Fonksiyonu
function filterQuickTasks() {
    const filterSelect = document.getElementById('techFilterSelect');
    const selectedTechId = filterSelect.value; // 'all' veya '1', '5' gibi ID

    if (selectedTechId === 'all') {
        renderQuickTaskTable(allQuickTasks);
    } else {
        // ID'ye göre filtrele (tech_id integer olduğu için tip dönüşümüne dikkat)
        const filtered = allQuickTasks.filter(t => t.tech_id == selectedTechId);
        renderQuickTaskTable(filtered);
    }
}

// Tabloyu Çizdirme
function renderQuickTaskTable(tasks) {
    const tbody = document.querySelector('#quickTaskTable tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '';

    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-sub);">Kayıt bulunamadı.</td></tr>';
        return;
    }

    tasks.forEach(t => {
        const tr = document.createElement('tr');
        const date = new Date(t.tarih).toLocaleDateString('tr-TR');
        const time = new Date(t.tarih).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});

        tr.innerHTML = `
            <td style="padding-left:20px; font-size:0.85rem; color:var(--text-sub);">
                <div>${date}</div>
                <div style="font-size:0.75rem;">${time}</div>
            </td>
            <td style="font-weight:600; color:var(--text-main); font-size:0.9rem;">
                ${t.tech_adsoyad}
            </td>
            <td>
                <div style="font-weight:500; color:var(--text-main);">${t.baslik}</div>
                <div style="font-size:0.8rem; color:var(--accent-blue);">${t.yapilan_yer}</div>
            </td>
            <td style="max-width:250px;">
                <div style="font-size:0.85rem; color:var(--text-sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${t.aciklama}">
                    ${t.aciklama}
                </div>
            </td>
            <td style="text-align:center;">
                <form action="/quick-task/delete" method="POST" onsubmit="return confirm('Bu kaydı silmek istediğinize emin misiniz?');">
                    <input type="hidden" name="id" value="${t.id}">
                    <button type="submit" class="btn-delete" style="width:32px; height:32px; border:none;">
                        <span class="material-icons-round" style="font-size:18px;">delete_outline</span>
                    </button>
                </form>
            </td>
        `;
        tbody.appendChild(tr);
    });
}