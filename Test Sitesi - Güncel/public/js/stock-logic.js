// public/js/stock-logic.js

const BRAND_MAPPING = {
    'Toner': ['Lexmark', 'Epson', 'Pantum', 'Canon'],
    'Drum':  ['Lexmark', 'Pantum', 'Epson'],
    'Fuser': ['Lexmark']
};

let allDefinitions = [];

document.addEventListener("DOMContentLoaded", () => {
    if(document.getElementById('stock-management')) {
        refreshStockData();
        setupOutsideClick();
    }
});

// Verileri Yenile
window.refreshStockData = async function() {
    try {
        const response = await fetch('/api/stocks');
        const data = await response.json();
        
        allDefinitions = data.definitions;
        renderDefinitionsList(data.definitions);
        renderLogs(data.logs);

    } catch (error) {
        console.error("Veri çekilemedi:", error);
    }
}

/* --- CUSTOM DROPDOWN MANTIĞI --- */

// Menüyü Aç/Kapa
window.toggleDropdown = function(id) {
    const container = document.getElementById(id);
    if(container.classList.contains('disabled')) return;

    // Diğer tüm açık menüleri kapat
    document.querySelectorAll('.dropdown-container').forEach(el => {
        if(el.id !== id) el.classList.remove('active');
    });

    container.classList.toggle('active');
}

// Seçim Yapılınca
window.selectOption = function(parentId, value, text = null) {
    const container = document.getElementById(parentId);
    const triggerText = container.querySelector('.selected-text');
    
    // Görünen metni güncelle
    triggerText.textContent = text || value;
    triggerText.style.color = "var(--text-main)";

    // Arka plandaki gizli input'u güncelle (Form gönderimi için)
    let hiddenInput;
    if(parentId === 'dd_type') hiddenInput = document.getElementById('input_issue_type');
    if(parentId === 'dd_brand') hiddenInput = document.getElementById('input_issue_brand');
    if(parentId === 'dd_model') hiddenInput = document.getElementById('input_stock_def_select');
    if(parentId === 'dd_title') hiddenInput = document.getElementById('input_alici_unvan');
    
    if(hiddenInput) hiddenInput.value = value;

    // Menüyü kapat
    container.classList.remove('active');

    // CASCADING MANTIK (Bir sonraki menüyü tetikle)
    if(parentId === 'dd_type') updateBrandList(value);
    if(parentId === 'dd_brand') updateModelList(value);
}

// Dışarı tıklayınca kapatma
function setupOutsideClick() {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown-container')) {
            document.querySelectorAll('.dropdown-container').forEach(el => {
                el.classList.remove('active');
            });
        }
    });
}

// --- CASCADING LİSTELER ---

// 1. Tür seçilince Markaları Doldur
function updateBrandList(selectedType) {
    const brandContainer = document.getElementById('dd_brand');
    const brandMenu = document.getElementById('menu_brand_list');
    const brandInput = document.getElementById('input_issue_brand');
    const brandText = brandContainer.querySelector('.selected-text');

    const modelContainer = document.getElementById('dd_model');
    const modelText = modelContainer.querySelector('.selected-text');
    const modelInput = document.getElementById('input_stock_def_select');

    // Marka listesini temizle ve yeniden oluştur
    brandMenu.innerHTML = '';
    const brands = BRAND_MAPPING[selectedType] || [];

    brands.forEach(brand => {
        const div = document.createElement('div');
        div.className = 'dropdown-option';
        div.textContent = brand;
        div.onclick = () => selectOption('dd_brand', brand);
        brandMenu.appendChild(div);
    });

    // Marka menüsünü aktif et, resetle
    brandContainer.classList.remove('disabled');
    brandText.textContent = '2. Marka Seçin';
    brandText.style.color = 'var(--text-sub)';
    brandInput.value = '';

    // Model menüsünü pasif yap ve sıfırla
    modelContainer.classList.add('disabled');
    modelText.textContent = '3. Model Seçin';
    modelInput.value = '';
}

// 2. Marka seçilince Modelleri Doldur
function updateModelList(selectedBrand) {
    const typeInput = document.getElementById('input_issue_type');
    const selectedType = typeInput.value;

    const modelContainer = document.getElementById('dd_model');
    const modelMenu = document.getElementById('menu_model_list');
    const modelInput = document.getElementById('input_stock_def_select');
    const modelText = modelContainer.querySelector('.selected-text');

    modelMenu.innerHTML = '';

    // Filtreleme
    const filteredModels = allDefinitions.filter(def => 
        def.tur === selectedType && 
        def.ad.toLowerCase().includes(selectedBrand.toLowerCase())
    );

    if (filteredModels.length === 0) {
        const div = document.createElement('div');
        div.className = 'dropdown-option';
        div.style.cursor = 'default';
        div.style.color = 'var(--text-sub)';
        div.textContent = 'Model bulunamadı';
        modelMenu.appendChild(div);
    } else {
        filteredModels.forEach(def => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.textContent = def.ad;
            // Server formatı: Tur|Ad
            const serverValue = `${def.tur}|${def.ad}`;
            div.onclick = () => selectOption('dd_model', serverValue, def.ad);
            modelMenu.appendChild(div);
        });
    }

    // Model menüsünü aktif et
    modelContainer.classList.remove('disabled');
    modelText.textContent = '3. Model Seçin';
    modelText.style.color = 'var(--text-sub)';
    modelInput.value = '';
}


// --- MODAL İÇİ FONKSİYONLAR (Standart Select) ---

window.openDefModal = function() { 
    document.getElementById('defModal').classList.add('show'); 
    document.getElementById('def_type').value = "";
    const brandSelect = document.getElementById('def_brand');
    brandSelect.innerHTML = '<option value="" disabled selected>Önce Tür Seçiniz</option>';
    brandSelect.disabled = true;
    brandSelect.style.opacity = "0.6";
    document.getElementById('def_model_input').value = "";
}
window.closeDefModal = function() { document.getElementById('defModal').classList.remove('show'); }

window.filterBrands = function(context) {
    // Sadece modal (def) için çalışır
    const typeSelect = document.getElementById('def_type');
    const brandSelect = document.getElementById('def_brand');
    const selectedType = typeSelect.value;
    const allowedBrands = BRAND_MAPPING[selectedType] || [];

    brandSelect.innerHTML = '<option value="" disabled selected>Marka Seçin</option>';
    allowedBrands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        brandSelect.appendChild(option);
    });

    brandSelect.disabled = false;
    brandSelect.style.opacity = "1";
    brandSelect.style.cursor = "pointer";
}

window.combineBrandModel = function() {
    const brand = document.getElementById('def_brand').value;
    const model = document.getElementById('def_model_input').value;
    const finalInput = document.getElementById('final_model_name');
    finalInput.value = `${brand} ${model}`;
    return true;
}

// --- LİSTELEME ---

function renderDefinitionsList(defs) {
    const table = document.getElementById('defTable');
    if(!table) return;
    table.innerHTML = '';
    if(defs.length === 0) {
        table.innerHTML = '<tr><td style="padding:20px; text-align:center; color:var(--text-sub);">Tanımlı ürün yok.</td></tr>';
        return;
    }
    defs.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px 15px;">
                <div style="font-weight:500; color:var(--text-main);">${d.ad}</div>
                <div style="font-size:0.75rem; color:var(--text-sub);">${d.tur}</div>
            </td>
            <td style="text-align:right; padding-right:15px;">
                <form action="/stock/def/delete" method="POST" style="display:inline;" onsubmit="return confirm('Bu tanımı silmek istediğinize emin misiniz?');">
                    <input type="hidden" name="id" value="${d.id}">
                    <button type="submit" style="background:none; border:none; color:var(--text-sub); cursor:pointer; padding:5px;">
                        <span class="material-icons-round" style="font-size:18px;">delete_outline</span>
                    </button>
                </form>
            </td>
        `;
        table.appendChild(tr);
    });
}

function renderLogs(logs) {
    const tbody = document.querySelector('#logTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:30px; text-align:center; color:var(--text-sub);">Henüz kayıt bulunmuyor.</td></tr>';
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement('tr');
        let icon = 'inventory_2';
        if(log.urun_tipi === 'Toner') icon = 'invert_colors';
        else if(log.urun_tipi === 'Drum') icon = 'settings_brightness';
        else if(log.urun_tipi === 'Fuser') icon = 'heat_pump';
        
        const date = new Date(log.tarih).toLocaleDateString('tr-TR');
        const time = new Date(log.tarih).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});

        tr.innerHTML = `
            <td style="padding-left:20px; font-size:0.85rem; color:var(--text-sub);">
                <div>${date}</div>
                <div style="font-size:0.75rem;">${time}</div>
            </td>
            <td style="font-weight:500; color:var(--text-main);">${log.teslim_alan}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:28px; height:28px; background:rgba(255,255,255,0.05); border-radius:6px; display:flex; align-items:center; justify-content:center;">
                        <span class="material-icons-round" style="font-size:16px; color:var(--text-sub);">${icon}</span>
                    </div>
                    <span>${log.model}</span>
                </div>
                ${log.aciklama ? `<div style="font-size:0.75rem; color:var(--text-sub); margin-top:2px; margin-left:36px;">${log.aciklama}</div>` : ''}
            </td>
            <td style="font-weight:bold; color:var(--text-main); font-family:monospace; font-size:1rem;">${log.adet}</td>
            <td style="text-align:center;">
                <form action="/stock/delete" method="POST" onsubmit="return confirm('Bu kaydı silmek istediğinize emin misiniz?');">
                    <input type="hidden" name="id" value="${log.id}">
                    <button type="submit" class="btn-delete" style="width:32px; height:32px;">
                        <span class="material-icons-round" style="font-size:18px;">delete</span>
                    </button>
                </form>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.searchLogTable = function() {
    const input = document.getElementById('logSearch');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('logTable');
    const tr = table.getElementsByTagName('tr');

    for (let i = 0; i < tr.length; i++) {
        const tdAlici = tr[i].getElementsByTagName('td')[1];
        const tdUrun = tr[i].getElementsByTagName('td')[2];
        if (tdAlici || tdUrun) {
            const txtAlici = tdAlici ? (tdAlici.textContent || tdAlici.innerText) : "";
            const txtUrun = tdUrun ? (tdUrun.textContent || tdUrun.innerText) : "";
            if (txtAlici.toUpperCase().indexOf(filter) > -1 || txtUrun.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}