const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const askQuestion = (query) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function scrape() {
    const keyword = await askQuestion("🔎 Masukkan Topik Jurnal: ");
    
    let hapusLama = await askQuestion("🗑️ Hapus data sebelumnya? (y/n): ");
    hapusLama = hapusLama.toLowerCase();

    const dataPath = path.join(__dirname, '../data/jurnal_mentah.json');
    let hasilAkhir =[];

    if (hapusLama === 'n') {
        if (fs.existsSync(dataPath)) {
            try {
                const fileLama = fs.readFileSync(dataPath, 'utf-8');
                hasilAkhir = JSON.parse(fileLama);
                console.log(`\n📦 Memuat ${hasilAkhir.length} data lama...`);
            } catch (e) {
                console.log("\n⚠️ Gagal membaca data lama. Memulai dari kosong.");
            }
        }
    } else {
        console.log("\n🗑️ Memulai lembaran baru...");
    }

    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page = await browser.newPage();
    
    let allResults =[];
    let journalCount = 0; // Penghitung khusus Jurnal murni
    let startParam = 0; 
    const TARGET_JOURNALS = 10; // Target Jurnal Murni

    console.log(`\n🎯 Target: Mengumpulkan ${TARGET_JOURNALS} Jurnal Murni (Buku akan tetap diambil sebagai bonus)...`);

    // --- LOOPING MENCARI 10 JURNAL ---
    while (journalCount < TARGET_JOURNALS) {
        const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(keyword)}&start=${startParam}`;
        console.log(`🌐 Memindai Google Scholar (Halaman ${(startParam/10)+1})...`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // CAPTCHA DETECTOR
        try {
            await page.waitForSelector('.gs_ri', { timeout: 5000 });
        } catch (error) {
            console.log("\n🛑 ⚠️ PERINGATAN: Google meminta CAPTCHA!");
            console.log("👉 Selesaikan CAPTCHA di browser. Bot menunggu maksimal 60 detik...\n");
            try {
                await page.waitForSelector('.gs_ri', { timeout: 60000 });
                console.log("✅ CAPTCHA selesai! Lanjut bekerja...\n");
            } catch (err) {
                console.log("❌ Gagal melewati CAPTCHA. Membatalkan program.");
                await browser.close();
                return;
            }
        }

        const pageResults = await page.evaluate(() => {
            let items =[];
            document.querySelectorAll('.gs_ri').forEach(el => {
                const titleEl = el.querySelector('.gs_rt');
                const titleText = titleEl ? titleEl.innerText : "";
                
                // Cek apakah ini buku/sitasi
                let isBook = false;
                if (titleText.includes('[BOOK]') || titleText.includes('[BUKU]') || 
                    titleText.includes('[B]') || titleText.includes('[CITATION]') || 
                    titleText.includes('[KUTIPAN]')) {
                    isBook = true;
                }

                const infoText = el.querySelector('.gs_a') ? el.querySelector('.gs_a').innerText : "";
                const yearMatch = infoText.match(/\d{4}/);
                const cleanTitle = titleText.replace(/^\[.*?\]\s*/, '').trim();

                items.push({
                    isBook: isBook,
                    judul: cleanTitle,
                    tahun: yearMatch ? yearMatch[0] : "N/A",
                    snippet_awal: el.querySelector('.gs_rs') ? el.querySelector('.gs_rs').innerText : "Tidak ada cuplikan",
                    link: el.querySelector('.gs_rt a') ? el.querySelector('.gs_rt a').href : null
                });
            });
            return items;
        });

        // Pilah hasil dari halaman ini
        for (let item of pageResults) {
            if (journalCount >= TARGET_JOURNALS) {
                break; // Jika jurnal sudah 10, berhenti memproses sisa halaman ini
            }
            
            if (item.isBook) {
                item.judul = "📚 [BUKU/SITASI] " + item.judul; // Beri tanda buku
                allResults.push(item); // Tetap ambil bukunya!
            } else {
                allResults.push(item);
                journalCount++; // Tambah hitungan jurnal
            }
        }

        console.log(`📈 Terkumpul: ${journalCount}/${TARGET_JOURNALS} Jurnal Murni (Total dengan buku: ${allResults.length})`);

        if (pageResults.length === 0 || startParam >= 100) break;
        
        if (journalCount < TARGET_JOURNALS) {
            startParam += 10;
            await delay(2000);
        }
    }

    console.log(`\n📌 Memulai ekstraksi mendalam untuk ${allResults.length} data...`);

    // --- DEEP SCRAPING ---
    for (let i = 0; i < allResults.length; i++) {
        let item = allResults[i];
        let abstrakFinal = item.snippet_awal;

        if (i > 0) await delay(Math.floor(Math.random() * 2000) + 2000);

        if (item.isBook) {
            // JIKA BUKU: Tidak perlu deep scraping buang-buang waktu
            abstrakFinal = "📖 [INFO BUKU] Bot tidak masuk ke halaman ini karena ini adalah format Buku/Kutipan.";
            console.log(`⏩[${i+1}/${allResults.length}] Melewati Buku: ${item.judul.substring(0, 30)}...`);
        } else if (item.link) {
            if (item.link.toLowerCase().endsWith('.pdf')) {
                abstrakFinal = `[FILE PDF] Teks tidak dapat di-scan otomatis. Link: ${item.link}`;
            } else if (item.link.includes('books.google')) {
                abstrakFinal = `📚 [BUKU] Teks tidak lengkap karena ini adalah preview buku.`;
            } else {
                console.log(`⏳ [${i+1}/${allResults.length}] Mengunjungi: ${item.judul.substring(0, 40)}...`);
                const newPage = await browser.newPage();
                try {
                    await newPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    const deepAbstrak = await newPage.evaluate(() => {
                        const targetSelectors =['#articleAbstract', '.article-abstract', '.item.abstract', 'section.abstract', '#abstract', '.c-article-section__content', '.abstract-content', '.hlFld-Abstract', '.abstract.author'];
                        for (let s of targetSelectors) {
                            let el = document.querySelector(s);
                            if (el && el.innerText.trim().length > 150) return el.innerText.trim();
                        }
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
        
        // Hapus penanda isBook sebelum masuk ke JSON agar rapi
        delete item.isBook;
        if (item.link && item.link !== "null") {
            hasilAkhir.push({ ...item, abstrak_lengkap: abstrakFinal });
        } else {
            console.log(`⏩ Melewati "${item.judul.substring(0,20)}..." karena tidak ada link sumber.`);
            }
    }

    fs.writeFileSync(dataPath, JSON.stringify(hasilAkhir, null, 2));
    console.log(`\n✅ SCRAPING SELESAI! Total saat ini: ${hasilAkhir.length} Data di database.`);
    await browser.close();
}

scrape().catch(err => console.log("❌ Error:", err));