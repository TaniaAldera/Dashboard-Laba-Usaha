"""
convert.py — Konversi Excel Laba BOPO per Outlet → JSON dashboard
==================================================================
Cara pakai:
  python convert.py --bulan mei   --file "LABA_Mei_2026.xlsx"
  python convert.py --bulan juni  --file "LABA_Juni_2026.xlsx"

Output: data/<bulan>.json  (langsung siap di-push ke GitHub)
"""

import argparse
import json
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

try:
    import pandas as pd
except ImportError:
    sys.exit("❌  pandas tidak ditemukan. Install dulu:\n    pip install pandas openpyxl")


# ──────────────────────────────────────────────────────────────────────────────
# Konfigurasi baris pada sheet "LABA BOPO PER OUTLET"
# ──────────────────────────────────────────────────────────────────────────────
#
# Jika format sheet berubah (baris geser), edit bagian ini saja.
#
# Struktur kolom (0-based):
#   0  = Kode outlet
#   1  = Nama outlet / label baris
#   2  = Pendapatan
#   3  = Biaya
#   4  = BOPO
#   5  = Laba
#   6  = Aset
#   7  = Ekuitas
#   8  = Target Laba DES
#   9  = Target Laba MEI
#   10 = Target Pend DES
#   11 = Target Pend MEI
#   12 = Target Biaya DES
#   13 = Target Biaya MEI
#   14 = Target BOPO RKAP
#   15 = Ach BOPO MEI
#   16 = Ach Laba DES
#   17 = Ach Laba MEI
#   18 = Ach Pend DES
#   19 = Ach Pend MEI
#   20 = Ach Biaya DES
#   21 = Ach Biaya MEI
#   22 = ROA
#   23 = ROE

COL = dict(
    kode=0, nama=1,
    pendapatan=2, biaya=3, bopo=4, laba=5,
    aset=6, ekuitas=7,
    target_laba_mei=9,
    target_pend_mei=11,
    target_bopo=14,
    ach_bopo=15,
    ach_laba_mei=17,
    ach_pend_mei=19,
    roa=22, roe=23,
)

# Baris TOTAL per area  (0-based, mulai dari atas file)
AREA_TOTAL_ROW = {
    "AREA LAMPUNG"   : 115,
    "AREA PALEMBANG" : 337,
    "AREA JAMBI"     : 508,
}

# Rentang baris data per area  [start, end)
AREA_DATA_RANGE = {
    "AREA LAMPUNG"   : (21, 115),
    "AREA PALEMBANG" : (169, 337),
    "AREA JAMBI"     : (362, 508),
}

# Baris TOTAL per CP (masuk ke area masing-masing)
CP_TOTAL_ROWS = {
    "AREA LAMPUNG"   : [33, 41, 51, 63, 77, 86, 102, 114],
    "AREA PALEMBANG" : [182, 190, 202, 213, 225, 237, 250, 258, 274, 287, 298, 310, 318, 335],
    "AREA JAMBI"     : [381, 397, 411, 425, 441, 454, 467, 481, 493, 507],
}

# Baris Grand Total Kanwil
GRAND_TOTAL_ROW = 509

SHEET_NAME = "LABA BOPO PER OUTLET "   # perhatikan spasi trailing


# ──────────────────────────────────────────────────────────────────────────────
# Helper functions
# ──────────────────────────────────────────────────────────────────────────────

def safe_float(val) -> float:
    """Konversi nilai sel ke float; kembalikan 0 jika kosong/error."""
    if val is None:
        return 0.0
    try:
        f = float(val)
        return 0.0 if (f != f) else f   # NaN → 0
    except (TypeError, ValueError):
        return 0.0


def cell(df, row: int, col_key: str) -> float:
    return safe_float(df.iloc[row, COL[col_key]])


def row_name(df, row: int) -> str:
    raw = df.iloc[row, COL["nama"]]
    if raw is None or (isinstance(raw, float) and raw != raw):
        return ""
    name = str(raw).strip()
    return name.split(":", 1)[1].strip() if ":" in name else name


def extract_row(df, row: int) -> dict:
    return {
        "pendapatan"     : cell(df, row, "pendapatan"),
        "biaya"          : cell(df, row, "biaya"),
        "bopo"           : cell(df, row, "bopo"),
        "laba"           : cell(df, row, "laba"),
        "aset"           : cell(df, row, "aset"),
        "ekuitas"        : cell(df, row, "ekuitas"),
        "target_laba_mei": cell(df, row, "target_laba_mei"),
        "target_pend_mei": cell(df, row, "target_pend_mei"),
        "target_bopo"    : cell(df, row, "target_bopo"),
        "ach_bopo"       : cell(df, row, "ach_bopo"),
        "ach_laba_mei"   : cell(df, row, "ach_laba_mei"),
        "ach_pend_mei"   : cell(df, row, "ach_pend_mei"),
        "roa"            : cell(df, row, "roa"),
        "roe"            : cell(df, row, "roe"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Main conversion
# ──────────────────────────────────────────────────────────────────────────────

def convert(excel_path: str) -> dict:
    print(f"📂  Membaca sheet '{SHEET_NAME}' dari {excel_path} ...")
    df = pd.read_excel(excel_path, sheet_name=SHEET_NAME, header=None)
    print(f"    → {df.shape[0]} baris, {df.shape[1]} kolom")

    result = {
        "grand_total": {
            "name": "GRAND TOTAL KANWIL PALEMBANG",
            **extract_row(df, GRAND_TOTAL_ROW),
        },
        "areas": {},
    }

    for area_name, total_row in AREA_TOTAL_ROW.items():
        cp_rows   = CP_TOTAL_ROWS[area_name]
        start, end = AREA_DATA_RANGE[area_name]

        # Kumpulkan outlet per CP
        outlets_by_cp: dict[int, list] = {r: [] for r in cp_rows}

        for idx in range(start, end):
            kode = str(df.iloc[idx, COL["kode"]]) if df.iloc[idx, COL["kode"]] is not None else ""
            kode = kode.strip()

            # Baris outlet: kode harus integer
            try:
                int(float(kode))
            except (ValueError, TypeError):
                continue

            nama = row_name(df, idx)
            if not nama:
                continue

            # Tentukan CP berikutnya (total row pertama di atas baris ini)
            next_cp = next((r for r in cp_rows if r > idx), None)
            if next_cp is None:
                continue

            outlets_by_cp[next_cp].append({
                "code": kode,
                "name": nama,
                **extract_row(df, idx),
            })

        # Susun daftar CP
        cp_list = []
        for cp_row in cp_rows:
            cp_name = row_name(df, cp_row)
            if not cp_name:
                continue
            cp_list.append({
                "name"   : cp_name,
                "outlets": outlets_by_cp.get(cp_row, []),
                **extract_row(df, cp_row),
            })

        result["areas"][area_name] = {
            "name"   : area_name,
            "cp_list": cp_list,
            **extract_row(df, total_row),
        }

        total_outlets = sum(len(cp["outlets"]) for cp in cp_list)
        print(f"    ✓ {area_name}: {len(cp_list)} CP, {total_outlets} outlet")

    return result


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Konversi Excel Laba BOPO per Outlet ke JSON dashboard."
    )
    parser.add_argument(
        "--bulan", required=True,
        help='Nama bulan (huruf kecil), misal: januari, februari, ..., mei, juni'
    )
    parser.add_argument(
        "--file", required=True,
        help="Path ke file Excel (.xlsx)"
    )
    args = parser.parse_args()

    bulan      = args.bulan.strip().lower()
    excel_path = args.file.strip()

    if not Path(excel_path).exists():
        sys.exit(f"❌  File tidak ditemukan: {excel_path}")

    data = convert(excel_path)

    out_dir  = Path("data")
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / f"{bulan}.json"

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = out_file.stat().st_size / 1024
    print(f"\n✅  Berhasil! Output: {out_file}  ({size_kb:.1f} KB)")
    print(f"\nLangkah selanjutnya:")
    print(f"  1. Buka index.html, tambahkan opsi bulan '{bulan}' di <select id=\"monthSelect\">")
    print(f"  2. git add data/{bulan}.json index.html")
    print(f"  3. git commit -m \"Tambah data {bulan.capitalize()} 2026\"")
    print(f"  4. git push")


if __name__ == "__main__":
    main()
