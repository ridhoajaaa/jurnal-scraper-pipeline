import pandas as pd
import json
import os

def extract_key_points(row):
    text = (str(row['judul']) + " " + str(row['abstrak_lengkap'])).lower()
    points =[]
    
    if any(w in text for w in["method", "metode", "approach", "framework", "kuantitatif", "kualitatif", "sampel", "uji", "data"]):
        points.append("⚙️ Metode/Data")
    if any(w in text for w in["result", "hasil", "finding", "menunjukkan", "significant", "signifikan", "conclude", "pengaruh", "impact"]):
        points.append("🎯 Temuan/Hasil")
    if any(w in text for w in["education", "pendidikan", "mahasiswa", "policy", "kebijakan", "strategy", "strategi", "ekonomi", "business", "security", "ai", "artificial", "war"]):
        points.append("🌐 Konteks/Isu")

    return " | ".join(points) if points else "📖 Literatur Umum"

def proses_data():
    input_file = '../data/jurnal_mentah.json'
    output_file = '../data/jurnal_siap_skripsi.xlsx'

    if not os.path.exists(input_file):
        print("❌ File JSON tidak ditemukan.")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    df = pd.DataFrame(data)
    
    # --- FITUR BARU: MENGHAPUS DUPLIKAT ---
    # Jika ada jurnal dengan judul yang persis sama, hapus salah satunya
    jumlah_awal = len(df)
    df = df.drop_duplicates(subset=['judul'], keep='first')
    jumlah_akhir = len(df)
    if jumlah_awal != jumlah_akhir:
        print(f"🧹 Ditemukan {jumlah_awal - jumlah_akhir} jurnal duplikat. Telah dibersihkan!")
    
    print(f"🧠 Menganalisis {jumlah_akhir} jurnal...")
    df['Poin_Penting'] = df.apply(extract_key_points, axis=1)
    
    kolom =['tahun', 'judul', 'link', 'abstrak_lengkap', 'Poin_Penting']
    df = df[kolom]

    writer = pd.ExcelWriter(output_file, engine='xlsxwriter')
    df.to_excel(writer, index=False, sheet_name='Hasil Jurnal')

    workbook  = writer.book
    worksheet = writer.sheets['Hasil Jurnal']
    
    wrap_format = workbook.add_format({'text_wrap': True, 'valign': 'top', 'border': 1})
    
    worksheet.set_column('A:A', 8)    # Tahun
    worksheet.set_column('B:B', 35, wrap_format)   # Judul
    worksheet.set_column('C:C', 20)   # Link
    worksheet.set_column('D:D', 80, wrap_format)   # Abstrak
    worksheet.set_column('E:E', 25, wrap_format)   # Poin Penting
    writer.close()

    df.to_json('../data/jurnal_bersih.json', orient='records', force_ascii=False)
    
    print(f"✨ SUKSES! File siap dibaca: {output_file}")

if __name__ == "__main__":
    proses_data()