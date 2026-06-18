/* ============================================================
   Dashboard Laba Usaha — KANWIL III SUMBAGSEL
   app.js
   ============================================================ */

'use strict';

/* ── Constants ─────────────────────────────────────────── */
const AREA_COLORS = {
  'AREA LAMPUNG'   : '#003087',
  'AREA PALEMBANG' : '#1a7a4a',
  'AREA JAMBI'     : '#e8a000',
};
const PCT_METRICS = new Set(['bopo', 'roa', 'roe', 'ach_laba_mei']);
const METRIC_LABELS = {
  laba         : 'Laba Usaha',
  ach_laba_mei : '% Pencapaian Laba',
  bopo         : 'BOPO',
  roa          : 'ROA',
  roe          : 'ROE',
  pendapatan   : 'Pendapatan',
};

/* ── State ──────────────────────────────────────────────── */
let DATA         = null;
let selArea      = null;
let activeCharts = {};
let allCPs       = [];
let allOutlets   = [];

/* ── Bootstrap ──────────────────────────────────────────── */
window.addEventListener('load', () => {
  const saved = localStorage.getItem('dashboardMonth') || 'mei';
  const sel   = document.getElementById('monthSelect');
  if ([...sel.options].some(o => o.value === saved)) sel.value = saved;
  loadMonth(sel.value);
});

/* ── Month switching ────────────────────────────────────── */
function onMonthChange() {
  const m = document.getElementById('monthSelect').value;
  localStorage.setItem('dashboardMonth', m);
  loadMonth(m);
}

function loadMonth(month) {
  showLoading(true);
  hideNoData();
  resetDerivedData();

  fetch(`nama-folder/${month}.json?v=${Date.now()}`)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(json => {
      if (json._placeholder) { showLoading(false); showNoData(month); return; }
      DATA = json;
      initDerivedData();
      showLoading(false);
      const activeTab = document.querySelector('.nav-tab.active');
      const tabNames  = ['overview','area','ranking','detail'];
      const idx = [...document.querySelectorAll('.nav-tab')].indexOf(activeTab);
      renderCurrentTab(tabNames[idx] || 'overview');
      document.getElementById('dataStatus').textContent =
        'Data: sd. ' + capFirst(month) + ' 2026';
    })
    .catch(() => { showLoading(false); showNoData(month); });
}

function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ── Loading / no-data states ───────────────────────────── */
function showLoading(on) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !on);
}
function showNoData(month) {
  document.getElementById('noDataMonth').textContent = month;
  document.getElementById('noDataNotice').style.display = 'flex';
}
function hideNoData() {
  document.getElementById('noDataNotice').style.display = 'none';
}

/* ── Derived data ───────────────────────────────────────── */
function resetDerivedData() { allCPs = []; allOutlets = []; }

function initDerivedData() {
  resetDerivedData();
  Object.values(DATA.areas).forEach(area => {
    area.cp_list.forEach(cp => {
      allCPs.push({ ...cp, areaName: area.name });
      (cp.outlets || []).forEach(o => {
        if (o.pendapatan > 0 || o.laba > 0)
          allOutlets.push({ ...o, cpName: cp.name, areaName: area.name });
      });
    });
  });
}

/* ── Formatters ─────────────────────────────────────────── */
function fmt(n, d = 0) {
  if (!n || isNaN(n)) return '-';
  const a = Math.abs(n);
  if (a >= 1e12) return (n/1e12).toFixed(d) + 'T';
  if (a >= 1e9)  return (n/1e9).toFixed(d)  + 'M';
  if (a >= 1e6)  return (n/1e6).toFixed(d)  + 'rb';
  if (a >= 1e3)  return (n/1e3).toFixed(d)  + 'k';
  return n.toFixed(d);
}
const fmtB = n => (n && !isNaN(n)) ? 'Rp ' + fmt(n, 1) : '-';
const pct  = (n, d = 1) => (n && !isNaN(n)) ? (n * 100).toFixed(d) + '%' : '-';

function achBadge(v) {
  if (!v || isNaN(v)) return '';
  const p = (v * 100).toFixed(1);
  if (v >= 1.20) return `<span class="pill pill-g">▲ ${p}%</span>`;
  if (v >= 1.00) return `<span class="pill pill-g">✓ ${p}%</span>`;
  return `<span class="pill pill-r">✗ ${p}%</span>`;
}
function bopoBadge(v) {
  if (!v || isNaN(v)) return '';
  const p = (v * 100).toFixed(2) + '%';
  if (v < 0.40) return `<span class="pill pill-g">${p}</span>`;
  if (v < 0.50) return `<span class="pill pill-y">${p}</span>`;
  return `<span class="pill pill-r">${p}</span>`;
}

/* ── Chart helpers ──────────────────────────────────────── */
function destroyChart(id) {
  if (activeCharts[id]) { activeCharts[id].destroy(); delete activeCharts[id]; }
}
const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { font: { size: 11 } } } },
};

/* ── Tab navigation ─────────────────────────────────────── */
function switchTab(name) {
  const names = ['overview','area','ranking','detail'];
  document.querySelectorAll('.nav-tab').forEach((b, i) =>
    b.classList.toggle('active', names[i] === name));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  renderCurrentTab(name);
}

function renderCurrentTab(name) {
  if (!DATA) return;
  if (name === 'overview') renderOverview();
  if (name === 'area')     renderAreaTab();
  if (name === 'ranking')  renderRanking();
  // detail tab only re-renders on dropdown change
}

/* ══════════════════════════════════════════════════════════
   TAB 1 — OVERVIEW
══════════════════════════════════════════════════════════ */
function renderOverview() {
  const gt    = DATA.grand_total;
  const areas = Object.values(DATA.areas);

  /* KPI */
  const kpis = [
    { label:'Total Pendapatan', value:'Rp '+fmt(gt.pendapatan,1),
      sub:'Target: Rp '+fmt(gt.target_pend_mei,1), badge:achBadge(gt.ach_pend_mei) },
    { label:'Total Laba Usaha', value:'Rp '+fmt(gt.laba,1),
      sub:'Target MEI: Rp '+fmt(gt.target_laba_mei,1), badge:achBadge(gt.ach_laba_mei) },
    { label:'BOPO Kanwil', value:(gt.bopo*100).toFixed(2)+'%',
      sub:'Target RKAP: '+(gt.target_bopo*100).toFixed(2)+'%', badge:bopoBadge(gt.bopo) },
    { label:'ROA',  value:pct(gt.roa,2),  sub:'Return on Assets', badge:'' },
    { label:'ROE',  value:pct(gt.roe,2),  sub:'Return on Equity', badge:'' },
    { label:'Ach. Laba', value:(gt.ach_laba_mei*100).toFixed(1)+'%',
      sub:'vs Target 2026', badge:achBadge(gt.ach_laba_mei) },
  ];
  document.getElementById('kpi-overview').innerHTML =
    '<div class="kpi-row">' +
    kpis.map(k=>`<div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>${k.badge}
    </div>`).join('') + '</div>';

  /* Chart — Laba */
  destroyChart('chartAreaLaba');
  activeCharts['chartAreaLaba'] = new Chart(document.getElementById('chartAreaLaba'), {
    type: 'bar',
    data: {
      labels: areas.map(a => a.name.replace('AREA ','')),
      datasets: [
        { label:'Laba Realisasi', data:areas.map(a=>+(a.laba/1e9).toFixed(2)),
          backgroundColor:areas.map(a=>AREA_COLORS[a.name]), borderRadius:6 },
        { label:'Target', data:areas.map(a=>+(a.target_laba_mei/1e9).toFixed(2)),
          type:'line', tension:.3, fill:false, pointRadius:5,
          borderColor:'#64748b', backgroundColor:'transparent' },
      ],
    },
    options: { ...BASE_OPTS, plugins: { ...BASE_OPTS.plugins, tooltip: { callbacks: {
      label: c => c.dataset.label+': Rp '+c.raw.toFixed(0)+' M'
    }}}, scales: { y: { ticks: { callback: v=>'Rp '+v+'M' }, grid:{ color:'#f1f5f9' } } } },
  });

  /* Chart — Ach Laba */
  destroyChart('chartAchLaba');
  activeCharts['chartAchLaba'] = new Chart(document.getElementById('chartAchLaba'), {
    type: 'bar',
    data: {
      labels: areas.map(a=>a.name.replace('AREA ','')),
      datasets: [{ label:'% Ach. Laba',
        data: areas.map(a=>+(a.ach_laba_mei*100).toFixed(2)),
        backgroundColor: areas.map(a=>a.ach_laba_mei>=1?'#1a7a4a':'#c0392b'),
        borderRadius:6 }],
    },
    options: { ...BASE_OPTS, plugins:{ legend:{display:false}, tooltip:{ callbacks:{
      label:c=>c.raw.toFixed(2)+'%'
    }}}, scales:{ y:{ ticks:{ callback:v=>v+'%' }, grid:{color:'#f1f5f9'} } } },
  });

  /* Chart — BOPO donut */
  destroyChart('chartBopo');
  activeCharts['chartBopo'] = new Chart(document.getElementById('chartBopo'), {
    type: 'doughnut',
    data: {
      labels: areas.map(a=>a.name.replace('AREA ','') + ' ' + (a.bopo*100).toFixed(1)+'%'),
      datasets: [{ data:areas.map(a=>+(a.bopo*100).toFixed(2)),
        backgroundColor:areas.map(a=>AREA_COLORS[a.name]), hoverOffset:8 }],
    },
    options: { ...BASE_OPTS, plugins: {
      legend:{ position:'right', labels:{font:{size:11}} },
      tooltip:{ callbacks:{ label:c=>c.label } }
    }},
  });

  /* Chart — ROA ROE */
  destroyChart('chartRoaRoe');
  activeCharts['chartRoaRoe'] = new Chart(document.getElementById('chartRoaRoe'), {
    type: 'bar',
    data: {
      labels: areas.map(a=>a.name.replace('AREA ','')),
      datasets: [
        { label:'ROA (%)', data:areas.map(a=>+(a.roa*100).toFixed(2)), backgroundColor:'#003087', borderRadius:4 },
        { label:'ROE (%)', data:areas.map(a=>+(a.roe*100).toFixed(2)), backgroundColor:'#e8a000', borderRadius:4 },
      ],
    },
    options: { ...BASE_OPTS, plugins:{ ...BASE_OPTS.plugins, tooltip:{ callbacks:{
      label:c=>c.dataset.label+': '+c.raw+'%'
    }}}, scales:{ y:{ ticks:{ callback:v=>v+'%' }, grid:{color:'#f1f5f9'} } } },
  });

  /* Table */
  const th = `<thead><tr><th>Area</th><th>Pendapatan</th><th>Biaya</th><th>Laba</th>
    <th>BOPO</th><th>Ach.Laba</th><th>Ach.Pend</th><th>ROA</th><th>ROE</th><th>CP</th>
  </tr></thead>`;
  const tb = '<tbody>'+areas.map(a=>`<tr>
    <td class="td-name">${a.name}</td>
    <td class="td-num">${fmtB(a.pendapatan)}</td><td class="td-num">${fmtB(a.biaya)}</td>
    <td class="td-num"><strong>${fmtB(a.laba)}</strong></td>
    <td class="td-num">${bopoBadge(a.bopo)}</td>
    <td class="td-num">${achBadge(a.ach_laba_mei)}</td>
    <td class="td-num">${achBadge(a.ach_pend_mei)}</td>
    <td class="td-num">${pct(a.roa,2)}</td><td class="td-num">${pct(a.roe,2)}</td>
    <td class="td-num">${a.cp_list.length}</td>
  </tr>`).join('')+'</tbody>';
  const tf = `<tfoot><tr><td>GRAND TOTAL</td>
    <td class="td-num">${fmtB(gt.pendapatan)}</td><td class="td-num">${fmtB(gt.biaya)}</td>
    <td class="td-num">${fmtB(gt.laba)}</td>
    <td class="td-num">${bopoBadge(gt.bopo)}</td>
    <td class="td-num">${achBadge(gt.ach_laba_mei)}</td>
    <td class="td-num">${achBadge(gt.ach_pend_mei)}</td>
    <td class="td-num">${pct(gt.roa,2)}</td><td class="td-num">${pct(gt.roe,2)}</td>
    <td class="td-num">${allCPs.length}</td>
  </tr></tfoot>`;
  document.getElementById('tableArea').innerHTML = th + tb + tf;
}

/* ══════════════════════════════════════════════════════════
   TAB 2 — PER AREA
══════════════════════════════════════════════════════════ */
function renderAreaTab() {
  const areas = Object.values(DATA.areas);
  document.getElementById('areaSelectorGrid').innerHTML = areas.map(a=>`
    <div class="area-card ${selArea===a.name?'sel':''}" onclick="selectArea('${a.name}')">
      <h3>${a.name}</h3>
      <div class="big">Rp ${fmt(a.laba,1)}</div>
      <div class="sub2">Laba Usaha</div>
      <div class="area-card-metrics">
        <div><div class="val">${(a.bopo*100).toFixed(1)}%</div><div class="lbl">BOPO</div></div>
        <div><div class="val">${(a.ach_laba_mei*100).toFixed(1)}%</div><div class="lbl">Ach.Laba</div></div>
        <div><div class="val">${a.cp_list.length}</div><div class="lbl">CP/CPS</div></div>
      </div>
    </div>`).join('');
  if (selArea && DATA.areas[selArea]) renderAreaDetail(DATA.areas[selArea]);
  else document.getElementById('areaDetail').innerHTML = '';
}

function selectArea(name) {
  selArea = name;
  renderAreaTab();
}

function renderAreaDetail(area) {
  const cpNames = area.cp_list.map(c => c.name.replace('TOTAL ',''));
  const kpis = [
    { label:'Pendapatan', value:'Rp '+fmt(area.pendapatan,1),
      sub:'Target: Rp '+fmt(area.target_pend_mei,1), badge:achBadge(area.ach_pend_mei) },
    { label:'Laba Usaha', value:'Rp '+fmt(area.laba,1),
      sub:'Target: Rp '+fmt(area.target_laba_mei,1), badge:achBadge(area.ach_laba_mei) },
    { label:'BOPO', value:(area.bopo*100).toFixed(2)+'%',
      sub:'Target: '+(area.target_bopo*100).toFixed(1)+'%', badge:bopoBadge(area.bopo) },
    { label:'ROA', value:pct(area.roa,2), sub:'', badge:'' },
    { label:'ROE', value:pct(area.roe,2), sub:'', badge:'' },
  ];

  document.getElementById('areaDetail').innerHTML = `
    <div class="kpi-row" style="margin-bottom:16px">
      ${kpis.map(k=>`<div class="kpi-card">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-sub">${k.sub}</div>${k.badge}
      </div>`).join('')}
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Laba per CP/CPS — ${area.name}</span></div>
        <div class="card-body"><div class="chart-wrap-lg"><canvas id="chartCpLaba"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">BOPO per CP/CPS</span></div>
        <div class="card-body"><div class="chart-wrap-lg"><canvas id="chartCpBopo"></canvas></div></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><span class="card-title">Tabel CP/CPS — ${area.name}</span></div>
      <div class="card-body"><div class="table-wrap"><table id="tableCp"></table></div></div>
    </div>`;

  requestAnimationFrame(() => {
    destroyChart('chartCpLaba');
    activeCharts['chartCpLaba'] = new Chart(document.getElementById('chartCpLaba'), {
      type:'bar',
      data:{ labels:cpNames, datasets:[
        { label:'Laba', data:area.cp_list.map(c=>+(c.laba/1e9).toFixed(2)),
          backgroundColor:AREA_COLORS[area.name]||'#003087', borderRadius:4 },
        { label:'Target', data:area.cp_list.map(c=>+(c.target_laba_mei/1e9).toFixed(2)),
          type:'line', borderColor:'#e8a000', fill:false, tension:.3, pointRadius:4, backgroundColor:'transparent' },
      ]},
      options:{ ...BASE_OPTS, plugins:{ ...BASE_OPTS.plugins, tooltip:{ callbacks:{
        label:c=>c.dataset.label+': Rp '+c.raw.toFixed(0)+'M'
      }}}, scales:{ x:{ ticks:{ font:{size:9} } }, y:{ ticks:{ callback:v=>'Rp '+v+'M' } } } },
    });

    destroyChart('chartCpBopo');
    activeCharts['chartCpBopo'] = new Chart(document.getElementById('chartCpBopo'), {
      type:'bar',
      data:{ labels:cpNames, datasets:[{ label:'BOPO',
        data:area.cp_list.map(c=>+(c.bopo*100).toFixed(2)),
        backgroundColor:area.cp_list.map(c=>c.bopo<.4?'#1a7a4a':c.bopo<.5?'#e8a000':'#c0392b'),
        borderRadius:4 }] },
      options:{ ...BASE_OPTS, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>c.raw+'%' } } },
        scales:{ x:{ ticks:{ font:{size:9} } }, y:{ ticks:{ callback:v=>v+'%' } } } },
    });

    const th=`<thead><tr><th>CP/CPS</th><th>Pendapatan</th><th>Biaya</th><th>Laba</th>
      <th>BOPO</th><th>Ach.Laba</th><th>Ach.Pend</th><th>ROA</th><th>ROE</th><th>Outlet</th>
    </tr></thead>`;
    const tb='<tbody>'+area.cp_list.map(c=>`<tr>
      <td class="td-name">${c.name.replace('TOTAL ','')}</td>
      <td class="td-num">${fmtB(c.pendapatan)}</td><td class="td-num">${fmtB(c.biaya)}</td>
      <td class="td-num"><strong>${fmtB(c.laba)}</strong></td>
      <td class="td-num">${bopoBadge(c.bopo)}</td>
      <td class="td-num">${achBadge(c.ach_laba_mei)}</td>
      <td class="td-num">${achBadge(c.ach_pend_mei)}</td>
      <td class="td-num">${pct(c.roa,2)}</td><td class="td-num">${pct(c.roe,2)}</td>
      <td class="td-num">${(c.outlets||[]).filter(o=>o.pendapatan>0).length}</td>
    </tr>`).join('')+'</tbody>';
    document.getElementById('tableCp').innerHTML = th + tb;
  });
}

/* ══════════════════════════════════════════════════════════
   TAB 3 — RANKING
══════════════════════════════════════════════════════════ */
function renderRanking() {
  const metric     = document.getElementById('rankMetric').value;
  const level      = document.getElementById('rankLevel').value;
  const areaFilter = document.getElementById('rankArea').value;
  const topN       = document.getElementById('rankTop').value;

  let items = (level === 'cp' ? allCPs : allOutlets)
    .filter(i => i[metric] && !isNaN(i[metric]) && i.laba > 0 && i.pendapatan > 0);
  if (areaFilter !== 'all') items = items.filter(i => i.areaName === areaFilter);

  const sorted = metric === 'bopo'
    ? [...items].filter(i=>i.bopo>0&&i.bopo<2).sort((a,b)=>a[metric]-b[metric])
    : [...items].sort((a,b)=>b[metric]-a[metric]);

  const top     = topN === 'all' ? sorted : sorted.slice(0, parseInt(topN));
  const display = top.slice(0, 20);

  document.getElementById('rankTitle').textContent =
    `🏅 Top ${topN==='all'?'Semua':topN} ${level==='cp'?'CP':'Outlet'} — ${METRIC_LABELS[metric]}`;

  destroyChart('chartRank');
  activeCharts['chartRank'] = new Chart(document.getElementById('chartRank'), {
    type:'bar',
    data:{
      labels: display.map(i=>(i.name||'').replace('TOTAL ','').substring(0,20)),
      datasets:[{ label:METRIC_LABELS[metric],
        data: display.map(i=>PCT_METRICS.has(metric)?+(i[metric]*100).toFixed(2):+(i[metric]/1e9).toFixed(2)),
        backgroundColor: display.map(i=>AREA_COLORS[i.areaName]||'#003087'),
        borderRadius:4 }],
    },
    options:{ indexAxis:'y', ...BASE_OPTS,
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>
        PCT_METRICS.has(metric)?c.raw.toFixed(2)+'%':'Rp '+c.raw.toFixed(0)+' M'
      }}},
      scales:{ x:{ ticks:{ callback:v=>PCT_METRICS.has(metric)?v+'%':'Rp '+v+'M' }, grid:{color:'#f1f5f9'} },
        y:{ ticks:{ font:{size:9} } } } },
  });

  const maxVal = top[0] ? Math.abs(top[0][metric]) : 1;
  document.getElementById('rankList').innerHTML = top.map((item,idx)=>{
    const valStr = PCT_METRICS.has(metric)
      ? (item[metric]*100).toFixed(2)+'%'
      : 'Rp '+fmt(item[metric],1);
    const nc    = idx===0?'gold':idx===1?'silver':idx===2?'bronze':'';
    const pctW  = (Math.abs(item[metric])/maxVal*100).toFixed(1);
    const color = AREA_COLORS[item.areaName]||'#003087';
    const sub   = (item.cpName||'').replace('TOTAL ','');
    return `<div class="rank-row">
      <div class="rank-num ${nc}">${idx+1}</div>
      <div class="rank-info">
        <div class="rank-name">${(item.name||'').replace('TOTAL ','')}</div>
        <div class="rank-area">${item.areaName}${sub?' | '+sub:''}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pctW}%;background:${color}"></div></div>
      </div>
      <div class="rank-val">${valStr}</div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   TAB 4 — DETAIL OUTLET
══════════════════════════════════════════════════════════ */
function onDetailAreaChange() {
  const area  = document.getElementById('detailArea').value;
  const cpSel = document.getElementById('detailCP');
  cpSel.innerHTML = '<option value="">— Pilih CP —</option>';
  document.getElementById('detailKPI').innerHTML = '';
  if (!area || !DATA) return;
  DATA.areas[area].cp_list.forEach(cp => {
    const opt = document.createElement('option');
    opt.value = cp.name;
    opt.textContent = cp.name.replace('TOTAL ','');
    cpSel.appendChild(opt);
  });
}

function renderDetailOutlets() {
  const area   = document.getElementById('detailArea').value;
  const cpName = document.getElementById('detailCP').value;
  if (!area || !cpName || !DATA) return;
  const cp = DATA.areas[area].cp_list.find(c=>c.name===cpName);
  if (!cp) return;

  const cpKpis = [
    { label:'Pendapatan CP', value:'Rp '+fmt(cp.pendapatan,1),
      sub:'Target: Rp '+fmt(cp.target_pend_mei,1), badge:achBadge(cp.ach_pend_mei) },
    { label:'Laba CP',       value:'Rp '+fmt(cp.laba,1),
      sub:'Target: Rp '+fmt(cp.target_laba_mei,1), badge:achBadge(cp.ach_laba_mei) },
    { label:'BOPO CP',       value:(cp.bopo*100).toFixed(2)+'%',
      sub:'Target: '+(cp.target_bopo*100).toFixed(1)+'%', badge:bopoBadge(cp.bopo) },
    { label:'ROA CP', value:pct(cp.roa,2), sub:'', badge:'' },
    { label:'ROE CP', value:pct(cp.roe,2), sub:'', badge:'' },
  ];
  document.getElementById('detailKPI').innerHTML =
    '<div class="kpi-row">'+cpKpis.map(k=>`<div class="kpi-card">
      <div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>${k.badge}
    </div>`).join('')+'</div>';

  const outlets = (cp.outlets||[]).filter(o=>o.pendapatan>0||o.laba>0);

  destroyChart('chartOutletLaba');
  activeCharts['chartOutletLaba'] = new Chart(document.getElementById('chartOutletLaba'), {
    type:'bar',
    data:{ labels:outlets.map(o=>o.name.substring(0,18)), datasets:[
      { label:'Laba', data:outlets.map(o=>+(o.laba/1e9).toFixed(2)),
        backgroundColor:AREA_COLORS[area]||'#003087', borderRadius:4 },
      { label:'Target', data:outlets.map(o=>+(o.target_laba_mei/1e9).toFixed(2)),
        type:'line', borderColor:'#e8a000', fill:false, tension:.3, pointRadius:4, backgroundColor:'transparent' },
    ]},
    options:{ ...BASE_OPTS, plugins:{ ...BASE_OPTS.plugins, tooltip:{ callbacks:{
      label:c=>c.dataset.label+': Rp '+c.raw.toFixed(0)+'M'
    }}}, scales:{ x:{ ticks:{ font:{size:9} } }, y:{ ticks:{ callback:v=>'Rp '+v+'M' } } } },
  });

  destroyChart('chartOutletBopo');
  activeCharts['chartOutletBopo'] = new Chart(document.getElementById('chartOutletBopo'), {
    type:'bar',
    data:{ labels:outlets.map(o=>o.name.substring(0,18)), datasets:[{ label:'BOPO %',
      data:outlets.map(o=>+(o.bopo*100).toFixed(2)),
      backgroundColor:outlets.map(o=>o.bopo<.4?'#1a7a4a':o.bopo<.5?'#e8a000':'#c0392b'),
      borderRadius:4 }] },
    options:{ ...BASE_OPTS, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>c.raw+'%' } } },
      scales:{ x:{ ticks:{ font:{size:9} } }, y:{ ticks:{ callback:v=>v+'%' } } } },
  });

  const th=`<thead><tr><th>Kode</th><th>Nama Outlet</th><th>Pendapatan</th><th>Biaya</th>
    <th>Laba</th><th>BOPO</th><th>Ach.Laba</th><th>Ach.Pend</th><th>ROA</th><th>ROE</th>
  </tr></thead>`;
  const tb='<tbody>'+outlets.map(o=>`<tr>
    <td style="font-size:.75rem;color:var(--muted)">${o.code}</td>
    <td class="td-name">${o.name}</td>
    <td class="td-num">${fmtB(o.pendapatan)}</td><td class="td-num">${fmtB(o.biaya)}</td>
    <td class="td-num"><strong>${fmtB(o.laba)}</strong></td>
    <td class="td-num">${bopoBadge(o.bopo)}</td>
    <td class="td-num">${achBadge(o.ach_laba_mei)}</td>
    <td class="td-num">${achBadge(o.ach_pend_mei)}</td>
    <td class="td-num">${pct(o.roa,2)}</td><td class="td-num">${pct(o.roe,2)}</td>
  </tr>`).join('')+'</tbody>';
  document.getElementById('tableOutlet').innerHTML = th + tb;
}
