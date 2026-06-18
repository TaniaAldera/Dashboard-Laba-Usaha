# Dashboard Laba Usaha — KANWIL III SUMBAGSEL

Dashboard interaktif per area untuk memantau Laba Usaha, BOPO, ROA, dan ROE
per Outlet, CP/CPS, dan Area — berbasis data Excel bulanan.

---

## 📁 Struktur File

```
dashboard/
├── index.html       ← Halaman utama (tidak perlu diedit tiap bulan)
├── style.css        ← Semua styling
├── app.js           ← Semua logika dashboard
├── convert.py       ← Script konversi Excel → JSON
├── data/
│   ├── januari.json
│   ├── februari.json
│   ├── maret.json
│   ├── april.json
│   └── mei.json     ← Data aktif
└── README.md
```

---

## 🚀 Deploy ke GitHub Pages

```bash
# 1. Buat repo baru di GitHub (misal: dashboard-kanwil)
git init
git remote add origin https://github.com/<username>/dashboard-kanwil.git

# 2. Push semua file
git add .
git commit -m "Initial dashboard"
git push -u origin main

# 3. Aktifkan GitHub Pages
#    → Settings → Pages → Source: main branch / root folder
#    → Dashboard live di: https://<username>.github.io/dashboard-kanwil/
```

---

## 📅 Update Data Bulan Baru

### Langkah 1 — Install dependensi (sekali saja)
```bash
pip install pandas openpyxl
```

### Langkah 2 — Jalankan script konversi
```bash
python convert.py --bulan juni --file "LABA_Juni_2026.xlsx"
# Output: data/juni.json
```

### Langkah 3 — Tambahkan opsi bulan di index.html
Buka `index.html`, cari bagian `<select id="monthSelect">`, tambahkan:
```html
<option value="juni">Juni 2026</option>
```

### Langkah 4 — Push ke GitHub
```bash
git add data/juni.json index.html
git commit -m "Tambah data Juni 2026"
git push
```

Dashboard otomatis update. ✅

---

## ⚙️ Konfigurasi Baris (jika format Excel berubah)

Jika posisi baris pada sheet `LABA BOPO PER OUTLET` berubah (misal ada penambahan outlet),
edit bagian konfigurasi di `convert.py`:

```python
# Baris TOTAL per area (0-based)
AREA_TOTAL_ROW = {
    "AREA LAMPUNG"   : 115,
    "AREA PALEMBANG" : 337,
    "AREA JAMBI"     : 508,
}

# Rentang baris data per area
AREA_DATA_RANGE = { ... }

# Baris TOTAL per CP
CP_TOTAL_ROWS = { ... }

# Baris Grand Total
GRAND_TOTAL_ROW = 509
```

---

## 📊 Fitur Dashboard

| Tab | Isi |
|-----|-----|
| **Overview Kanwil** | KPI utama, chart laba/ach/BOPO/ROA-ROE per area, tabel ringkasan |
| **Per Area** | Klik area → detail CP/CPS dengan chart & tabel |
| **Ranking** | Filter by metrik, level (CP/Outlet), area, top N |
| **Detail Outlet** | Pilih Area → CP → semua outlet lengkap |

Selector **Periode** di header untuk ganti bulan tanpa reload halaman.
