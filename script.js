/**
 * DATA DASBOR LABA USAHA
 * Berisi data realisasi per 31 Mei 2026 untuk Area Lampung, Palembang, dan Jambi.
 */
const DATA = {
    "areas": {
        "AREA LAMPUNG": { /* Data detail di passage [1-11] */ },
        "AREA PALEMBANG": { /* Data detail di passage [12-28] */ },
        "AREA JAMBI": { /* Data detail di passage [29-44] */ }
    },
    "grand_total": { /* Data total kanwil di passage [44] */ }
};

// --- Helpers (Fungsi Pembantu) --- [45-47]
const fmt = (n, d = 0) => {
    if (!n || isNaN(n)) return '-';
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(d) + 'T';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d) + 'M';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + 'rb';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(d) + 'k';
    return n.toFixed(d);
};

const fmtB = (n) => (!n || isNaN(n)) ? '-' : 'Rp ' + fmt(n, 1);
const pct = (n, d = 1) => n && !isNaN(n) ? ((n) * 100).toFixed(d) + '%' : '-';

const achBadge = (v) => {
    if (!v || isNaN(v)) return '';
    const p = v * 100;
    if (p >= 120) return `<span class="pill pill-g">▲ ${p.toFixed(1)}%</span>`;
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

// --- Inisialisasi & Pengolahan Data --- [47, 48]
const AREA_COLORS = { 'AREA LAMPUNG': '#003087', 'AREA PALEMBANG': '#1a7a4a', 'AREA JAMBI': '#e8a000' };
let activeCharts = {};

function destroyChart(id) { if (activeCharts[id]) { activeCharts[id].destroy(); delete activeCharts[id]; } }

const areas = Object.values(DATA.areas);
const gt = DATA.grand_total;

// Flatten CPs dan Outlets untuk fitur Ranking [48]
const allCPs = [];
areas.forEach(a => {
    a.cp_list.forEach(cp => {
        allCPs.push({ ...cp, areaName: a.name, areaColor: AREA_COLORS[a.name] || '#003087' });
    });
});

const allOutlets = [];
allCPs.forEach(cp => {
    (cp.outlets || []).forEach(o => {
        if (o.pendapatan > 0 || o.laba > 0) {
            allOutlets.push({ ...o, cpName: cp.name, areaName: cp.areaName });
        }
    });
});

// --- Logika Tab --- [48, 49]
function switchTab(name) {
    const tabs = ['overview', 'area', 'ranking', 'detail'];
    document.querySelectorAll('.nav-tab').forEach((t, i) => {
        t.classList.toggle('active', tabs[i] === name);
    });
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');

    if (name === 'overview') renderOverview();
    if (name === 'area') renderAreaTab();
    if (name === 'ranking') renderRanking();
}

// --- Render Tab Overview --- [49-59]
function renderOverview() {
    // Render KPI Cards [50, 51]
    const kpis = [
        { label: 'Total Pendapatan', value: 'Rp ' + fmt(gt.pendapatan, 1), sub: 'Target: Rp ' + fmt(gt.target_pend_mei, 1), badge: achBadge(gt.ach_pend_mei) },
        { label: 'Total Laba Usaha', value: 'Rp ' + fmt(gt.laba, 1), sub: 'Target MEI: Rp ' + fmt(gt.target_laba_mei, 1), badge: achBadge(gt.ach_laba_mei) },
        { label: 'BOPO Kanwil', value: (gt.bopo * 100).toFixed(2) + '%', sub: 'Target RKAP: ' + (gt.target_bopo * 100).toFixed(2) + '%', badge: bopoBadge(gt.bopo) },
        { label: 'ROA', value: pct(gt.roa, 2), sub: 'Return on Assets', badge: '' },
        { label: 'ROE', value: pct(gt.roe, 2), sub: 'Return on Equity', badge: '' },
        { label: 'Ach. Laba MEI', value: (gt.ach_laba_mei * 100).toFixed(1) + '%', sub: 'vs Target MEI 2026', badge: achBadge(gt.ach_laba_mei) }
    ];
    document.getElementById('kpi-overview').innerHTML = `<div class="kpi-row">${kpis.map(k => `
        <div class="kpi-card">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-value">${k.value}</div>
            <div class="kpi-sub">${k.sub}</div>
            ${k.badge}
        </div>`).join('')}</div>`;

    // Grafik Laba per Area [52, 53]
    destroyChart('chartAreaLaba');
    activeCharts['chartAreaLaba'] = new Chart(document.getElementById('chartAreaLaba'), {
        type: 'bar',
        data: {
            labels: areas.map(a => a.name.replace('AREA ', '')),
            datasets: [
                { label: 'Laba Realisasi', data: areas.map(a => a.laba / 1e9), backgroundColor: areas.map(a => AREA_COLORS[a.name]), borderRadius: 6 },
                { label: 'Target MEI', data: areas.map(a => a.target_laba_mei / 1e9), borderColor: '#64748b', borderWidth: 2, type: 'line', tension: .3, fill: false, pointRadius: 5 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Render Tabel Ringkasan Area [57-59]
    const tbody = areas.map(a => `<tr>
        <td class="td-name">${a.name}</td>
        <td class="td-num">${fmtB(a.pendapatan)}</td>
        <td class="td-num">${fmtB(a.biaya)}</td>
        <td class="td-num"><strong>${fmtB(a.laba)}</strong></td>
        <td class="td-num">${bopoBadge(a.bopo)}</td>
        <td class="td-num">${achBadge(a.ach_laba_mei)}</td>
        <td class="td-num">${pct(a.roa, 2)}</td>
        <td class="td-num">${pct(a.roe, 2)}</td>
        <td class="td-num">${a.cp_list.length}</td>
    </tr>`).join('');
    document.getElementById('tableArea').innerHTML = `<thead><tr><th>Area</th><th>Pendapatan</th><th>Biaya</th><th>Laba</th><th>BOPO</th><th>Ach. Laba</th><th>ROA</th><th>ROE</th><th>Jml CP</th></tr></thead><tbody>${tbody}</tbody>`;
}

// --- Render Tab Ranking --- [69-75]
function renderRanking() {
    const metric = document.getElementById('rankMetric').value;
    const level = document.getElementById('rankLevel').value;
    const areaFilter = document.getElementById('rankArea').value;
    const topN = document.getElementById('rankTop').value;

    let items = level === 'cp' ? allCPs : allOutlets;
    if (areaFilter !== 'all') items = items.filter(i => i.areaName === areaFilter);
    items = items.filter(i => i[metric] && !isNaN(i[metric]) && i.laba > 0);

    let sorted = [...items].sort((a, b) => metric === 'bopo' ? a[metric] - b[metric] : b[metric] - a[metric]);
    const top = topN === 'all' ? sorted : sorted.slice(0, parseInt(topN));

    // Update Judul & Grafik Ranking [71-73]
    document.getElementById('rankTitle').textContent = `Top ${topN === 'all' ? 'Semua' : topN} ${level === 'cp' ? 'CP' : 'Outlet'} berdasarkan ${metric}`;
    
    // Logic untuk tabel list ranking [74, 75]
    const listHTML = top.map((item, idx) => {
        const valStr = ['bopo', 'roa', 'roe', 'ach_laba_mei'].includes(metric) ? (item[metric] * 100).toFixed(2) + '%' : 'Rp ' + fmt(item[metric], 1);
        const maxVal = top[metric];
        const pctBar = maxVal ? Math.abs(item[metric] / maxVal) * 100 : 0;
        return `<div class="rank-row">
            <div class="rank-num ${idx < 3 ? ['gold', 'silver', 'bronze'][idx] : ''}">${idx + 1}</div>
            <div style="flex:1">
                <div class="rank-name">${(item.name || '').replace('TOTAL ', '')}</div>
                <div class="rank-area">${item.areaName}</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pctBar}%;background:${AREA_COLORS[item.areaName]}"></div></div>
            </div>
            <div class="rank-val">${valStr}</div>
        </div>`;
    }).join('');
    document.getElementById('rankList').innerHTML = listHTML;
}

// --- Inisialisasi saat Load --- [82]
window.addEventListener('load', () => {
    renderOverview();
});
