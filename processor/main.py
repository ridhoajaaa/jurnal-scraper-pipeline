import pandas as pd
import json
import os

def extract_key_points(row):
    # Gabungkan judul dan abstrak untuk analisis
    text = (str(row['judul']) + " " + str(row['abstrak_lengkap'])).lower()
    points = []
    
    # METODE & DATA (Bilingual)
    if any(w in text for w in ["method", "metode", "approach", "framework", "kuantitatif", "kualitatif", "sampel", "uji", "data"]):
        points.append("⚙️ Metode/Data")

    # HASIL & TEMUAN (Bilingual)
    if any(w in text for w in ["result", "hasil", "finding", "menunjukkan", "significant", "signifikan", "conclude", "pengaruh", "impact"]):
        points.append("🎯 Temuan/Hasil")

    # KONTEKS & ISU (Bilingual)
    if any(w in text for w in ["education", "pendidikan", "mahasiswa", "policy", "kebijakan", "strategy", "strategi", "ekonomi", "business", "security"]):
        points.append("🌐 Konteks/Isu")

    return " | ".join(points) if points else "📖 Literatur Umum"

def proses_data():
    input_file = '../data/jurnal_mentah.json'
    output_file = '../data/jurnal_siap_skripsi.xlsx'

    if not os.path.exists(input_file):
        print("❌ File JSON tidak ditemukan. Jalankan scraper JS dulu.")
        return

    # Baca JSON
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    df = pd.DataFrame(data)
    
    print("🧠 Menganalisis poin-poin penting jurnal...")
    df['Poin_Penting'] = df.apply(extract_key_points, axis=1)
    
    # Pilih dan urutkan kolom agar rapi di Excel
    kolom = ['tahun', 'judul', 'link', 'abstrak_lengkap', 'Poin_Penting']
    df = df[kolom]

    # Ekspor ke Excel dengan Formatting
    print("📊 Membuat file Excel yang rapi...")
    writer = pd.ExcelWriter(output_file, engine='xlsxwriter')
    df.to_excel(writer, index=False, sheet_name='Hasil Jurnal')

    workbook  = writer.book
    worksheet = writer.sheets['Hasil Jurnal']
    
    # Format agar teks membungkus ke bawah (Wrap Text)
    wrap_format = workbook.add_format({'text_wrap': True, 'valign': 'top', 'border': 1})
    header_format = workbook.add_format({'bold': True, 'bg_color': '#D7E4BC', 'border': 1})

    # Set kolom (A:Tahun, B:Judul, C:Link, D:Abstrak, E:Poin)
    worksheet.set_column('A:A', 8)    # Tahun
    worksheet.set_column('B:B', 35, wrap_format)   # Judul
    worksheet.set_column('C:C', 20)   # Link
    worksheet.set_column('D:D', 80, wrap_format)   # Abstrak (Paling Lebar)
    worksheet.set_column('E:E', 25, wrap_format)   # Poin Penting

    writer.close()
    print(f"✨ SUKSES! File siap dibaca: {output_file}")

if __name__ == "__main__":
    proses_data()