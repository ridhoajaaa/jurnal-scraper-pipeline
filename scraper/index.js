const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Fungsi input terminal
const askQuestion = (query) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
};

// Fungsi Jeda (Anti-Banned)
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function scrape() {
    const keyword = await askQuestion("🔎 Masukkan Topik Jurnal: ");
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page = await browser.newPage();
    
    console.log("🌐 Membuka Google Scholar...");
    await page.goto(`https://scholar.google.com/scholar?q=${encodeURIComponent(keyword)}`);

    // Ambil daftar awal dari Google Scholar
    const listJurnal = await page.evaluate(() => {
        let items = [];
        document.querySelectorAll('.gs_ri').forEach(el => {
            // Ekstrak Tahun dari baris info penulis
            const infoText = el.querySelector('.gs_a') ? el.querySelector('.gs_a').innerText : "";
            const yearMatch = infoText.match(/\d{4}/);
            
            items.push({
                judul: el.querySelector('.gs_rt').innerText,
                tahun: yearMatch ? yearMatch[0] : "N/A",
                snippet_awal: el.querySelector('.gs_rs') ? el.querySelector('.gs_rs').innerText : "",
                link: el.querySelector('.gs_rt a') ? el.querySelector('.gs_rt a').href : null
            });
        });
        return items;
    });

    console.log(`📌 Menemukan ${listJurnal.length} jurnal. Memulai ekstraksi mendalam...`);

    let hasilAkhir = [];
    for (let i = 0; i < listJurnal.length; i++) {
        let jurnal = listJurnal[i];
        let abstrakFinal = jurnal.snippet_awal;

        // Jeda acak 3-5 detik agar tidak diblokir Google/Jurnal
        if (i > 0) await delay(Math.floor(Math.random() * 2000) + 3000);

        if (jurnal.link) {
            // Deteksi jika link langsung ke PDF
            if (jurnal.link.toLowerCase().endsWith('.pdf')) {
                abstrakFinal = `[FILE PDF] Teks tidak dapat di-scan otomatis. Link: ${jurnal.link}`;
            } else {
                console.log(`⏳ [${i+1}/${listJurnal.length}] Mengunjungi: ${jurnal.judul.substring(0, 40)}...`);
                const newPage = await browser.newPage();
                try {
                    await newPage.goto(jurnal.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    
                    const deepAbstrak = await newPage.evaluate(() => {
                        // Kumpulan Selector untuk Jurnal Internasional & Lokal
                        const targetSelectors = [
                            '#articleAbstract', '.article-abstract', '.item.abstract', 
                            'section.abstract', '#abstract', '.c-article-section__content',
                            '.abstract-content', '.hlFld-Abstract', '.abstract.author'
                        ];
                        
                        for (let s of targetSelectors) {
                            let el = document.querySelector(s);
                            if (el && el.innerText.trim().length > 150) return el.innerText.trim();
                        }

                        // Jika gagal, cari paragraf terpanjang yang bukan menu
                        const cleanPs = Array.from(document.querySelectorAll('p')).filter(p => {
                            const parent = p.closest('nav, header, footer, .sidebar, .menu, .citation');
                            const txt = p.innerText.trim();
                            const isCitation = /([12][0-9]{3})|Vol\.|No\.|pp\.|doi|http/i.test(txt);
                            return !parent && !isCitation && txt.length > 200;
                        });

                        return cleanPs.length > 0 ? cleanPs.sort((a,b) => b.innerText.length - a.innerText.length)[0].innerText.trim() : null;
                    });

                    if (deepAbstrak) abstrakFinal = deepAbstrak;
                } catch (e) {
                    console.log("⚠️ Timeout/Blokir, menggunakan cuplikan Google.");
                }
                await newPage.close();
            }
        }
        hasilAkhir.push({ ...jurnal, abstrak_lengkap: abstrakFinal });
    }

    const dataPath = path.join(__dirname, '../data/jurnal_mentah.json');
    fs.writeFileSync(dataPath, JSON.stringify(hasilAkhir, null, 2));
    console.log("\n✅ SCRAPING SELESAI! Hasil disimpan di folder data.");
    await browser.close();
}

scrape().catch(err => console.log("❌ Error:", err));