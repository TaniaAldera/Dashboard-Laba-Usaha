/**
 * DATA UTAMA DASHBOARD (Multi-Periode)
 * Masukkan data realisasi masing-masing bulan ke dalam properti yang sesuai.
 */
const ALL_DATA = {
    "Mei": {
        // Salin isi properti "areas" dan "grand_total" dari sumber PDF ke sini
        "areas": { /* Data Area Lampung, Palembang, Jambi dari sumber */ },
        "grand_total": { /* Data Grand Total dari sumber */ }
    },
    "April": { "areas": {}, "grand_total": {} },
    "Maret": { "areas": {}, "grand_total": {} },
    "Februari": { "areas": {}, "grand_total": {} },
    "Januari": { "areas": {}, "grand_total": {} }
};

// State Aplikasi
let currentMonth = "Mei";
let activeData = ALL_DATA[currentMonth];
let activeCharts = {};
const AREA_COLORS = { 'AREA LAMPUNG': '#003087', 'AREA PALEMBANG': '#1a7a4a', 'AREA JAMBI': '#e8a000' };

// --- 1. Helpers (Fungsi Pembantu) ---
const fmt = (n, d = 0) => {
    if (!n || isNaN(n)) return '-';
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(d) + 'T';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d) + 'M';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + 'rb';
    return n.toFixed(d);
};

const fmtB = (n) => (!n || isNaN(n)) ? '-' : 'Rp ' + fmt(n, 1);
const pct = (n, d = 1) => n && !isNaN(n) ? (n * 100).toFixed(d) + '%' : '-';

const achBadge = (v) => {
    if (!v || isNaN(v)) return '';
    const p = v * 100;
    if (p >= 100) return `<span class="pill pill-g">✓ ${p.toFixed(1)}%</span>`;
    return `<span class="pill pill-r">✗ ${p.toFixed(1)}%</span>`;
};

const bopoBadge = (v) => {
    if (!v || isNaN(v)) return '';
    const p = (v * 100).toFixed(1);
    if (v < 0.40) return `<span class="pill pill-g">${p}%</span>`;
    if (v < 0.50) return `<span class="pill pill-y">${p}%</span>`;
    return `<span class="pill pill-r">${p}%</span>`;
};

function destroyChart(id) { 
    if (activeCharts[id]) { activeCharts[id].destroy(); delete activeCharts[id]; } 
}

// --- 2. Logika Filter Bulan ---
function changeMonth() {
    currentMonth = document.getElementById('monthFilter').value;
    activeData = ALL_DATA[currentMonth];

    // Update teks UI
    document.getElementById('subHeaderDate').innerText = `Realisasi per Outlet sd. 31 ${currentMonth} 2026`;
    
    // Jika data bulan yang dipilih kosong, beri peringatan
    if (Object.keys(activeData.areas).length === 0) {
        alert(`Data untuk bulan ${currentMonth} belum dimasukkan.`);
        return;
    }

    // Refresh halaman berdasarkan tab aktif
    const activeTabBtn = document.querySelector('.nav-tab.active');
    const tabName = activeTabBtn.getAttribute('onclick').match(/'([^']+)'/)[1];
    switchTab(tabName);
}

// --- 3. Logika Tab ---
function switchTab(name) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    event?.target?.classList?.add('active') || document.querySelector(`[onclick="switchTab('${name}')"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');

    if (name === 'overview') renderOverview();
    if (name === 'area') renderAreaTab();
    if (name === 'ranking') renderRanking();
    if (name === 'detail') onDetailAreaChange();
}

// --- 4. Fungsi Render Overview ---
function renderOverview() {
    const areas = Object.values(activeData.areas);
    const gt = activeData.grand_total;

    // Render KPI
    const kpis = [
        { label: 'Total Pendapatan', value: fmtB(gt.pendapatan), sub: 'Target: ' + fmtB(gt.target_pend_mei), badge: achBadge(gt.ach_pend_mei) },
        { label: 'Total Laba Usaha', value: fmtB(gt.laba), sub: `Target ${currentMonth}: ` + fmtB(gt.target_laba_mei), badge: achBadge(gt.ach_laba_mei) },
        { label: 'BOPO Kanwil', value: pct(gt.bopo, 2), sub: 'Target: ' + pct(gt.target_bopo, 2), badge: bopoBadge(gt.bopo) },
        { label: 'ROA', value: pct(gt.roa, 2), sub: 'Return on Assets', badge: '' }
    ];

    document.getElementById('kpi-overview').innerHTML = `<div class="kpi-row">${kpis.map(k => `
        <div class="kpi-card">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-value">${k.value}</div>
            <div class="kpi-sub">${k.sub}</div>
            ${k.badge}
        </div>`).join('')}</div>`;

    // Chart Laba per Area
    destroyChart('chartAreaLaba');
    activeCharts['chartAreaLaba'] = new Chart(document.getElementById('chartAreaLaba'), {
        type: 'bar',
        data: {
            labels: areas.map(a => a.name.replace('AREA ', '')),
            datasets: [{
                label: 'Laba Realisasi',
                data: areas.map(a => a.laba / 1e9),
                backgroundColor: areas.map(a => AREA_COLORS[a.name]),
                borderRadius: 6
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Tabel Ringkasan
    const rows = areas.map(a => `
        <tr>
            <td class="td-name">${a.name}</td>
            <td class="td-num">${fmtB(a.pendapatan)}</td>
            <td class="td-num">${fmtB(a.laba)}</td>
            <td class="td-num">${bopoBadge(a.bopo)}</td>
            <td class="td-num">${achBadge(a.ach_laba_mei)}</td>
        </tr>`).join('');
    document.getElementById('tableArea').innerHTML = `<thead><tr><th>Area</th><th>Pendapatan</th><th>Laba</th><th>BOPO</th><th>Ach</th></tr></thead><tbody>${rows}</tbody>`;
}

// --- 5. Fungsi Render Ranking ---
function renderRanking() {
    const metric = document.getElementById('rankMetric').value;
    const areas = Object.values(activeData.areas);
    
    // Gabungkan semua CP dari seluruh area
    let allCPs = [];
    areas.forEach(a => {
        a.cp_list.forEach(cp => allCPs.push({ ...cp, areaName: a.name }));
    });

    // Sorting
    allCPs.sort((a, b) => b[metric] - a[metric]);
    const top10 = allCPs.slice(0, 10);

    const listHTML = top10.map((cp, i) => `
        <div class="rank-row">
            <div class="rank-num">${i + 1}</div>
            <div style="flex:1">
                <div class="rank-name">${cp.name.replace('TOTAL ', '')}</div>
                <div class="rank-area">${cp.areaName}</div>
            </div>
            <div class="rank-val">${metric.includes('ach') || metric === 'bopo' ? pct(cp[metric]) : fmtB(cp[metric])}</div>
        </div>`).join('');
    document.getElementById('rankList').innerHTML = listHTML;
}

// Tambahkan fungsi render lainnya (renderAreaTab, onDetailAreaChange) 
// dengan logika serupa yang mengambil data dari 'activeData' [2-4].

// Inisialisasi saat halaman dimuat
window.addEventListener('load', () => {
    switchTab('overview');
});
