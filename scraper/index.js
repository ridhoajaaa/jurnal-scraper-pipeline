const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const https = require('https');

puppeteer.use(StealthPlugin());

const argOffset = process.argv[2] === '--' ? 1 : 0;

const keyword = process.argv[2 + argOffset] || '';
const hapusLama = process.argv[3 + argOffset] || 'n';
const source = (process.argv[4 + argOffset] || 'scholar').toLowerCase();
const apiKey = process.argv[5 + argOffset] || '';
const yearFrom = parseInt(process.argv[6 + argOffset]) || 2020;
const yearTo = parseInt(process.argv[7 + argOffset]) || new Date().getFullYear();
const TARGET = Math.min(parseInt(process.argv[8 + argOffset]) || 10, 50);

const JOB_ID = process.argv[9 + argOffset] || process.env.JOB_ID || 'standalone';
const DATA_PATH = path.join(__dirname, `../data/jurnal_mentah_${JOB_ID}.json`);
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// ─── Quality constants ────────────────────────────────────────────────────────
const CITATION_MIN = 3;    // min citations — skip jika di bawah ini
const SKIP_CITATION_YEAR = 2024; // tahun ini ke atas bebas dari citation filter
const RESERVED_CITATION_MIN = 3;    // min citations untuk masuk reserved slot
const MAX_RESERVED_SLOTS = 15;   // max jurnal tanpa abstract per scrape
const ABSTRACT_MIN_LENGTH = 150;  // min karakter abstract yang diterima
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip JATS XML, HTML tags, HTML entities, dan extra whitespace dari abstract.
 */
function cleanAbstract(text) {
    if (!text || typeof text !== 'string') return null;
    return text
        .replace(/<jats:[^>]*>/gi, '')
        .replace(/<\/jats:[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Returns true jika paper lolos citation quality filter.
 * Papers dari SKIP_CITATION_YEAR ke atas dibebaskan (terlalu baru).
 */
function passesCitationFilter(citationCount, yearStr) {
    const yr = parseInt(yearStr);
    if (!isNaN(yr) && yr >= SKIP_CITATION_YEAR) return true;
    return (citationCount || 0) >= CITATION_MIN;
}

function emitProgress(current, total) {
    process.stdout.write(`PROGRESS:${current}/${total}\n`);
}

function cleanScholarLink(url) {
    if (!url) return null;
    try {

        const u = new URL(url, 'https://scholar.google.com');
        const innerUrl = u.searchParams.get('url') || u.searchParams.get('q');
        if (innerUrl) return decodeURIComponent(innerUrl);

        if (url.startsWith('http') && !url.includes('scholar.google.com/scholar?')) return url;
        return url;
    } catch { return url; }
}

function extractDOI(url) {
    if (!url) return null;

    const m1 = url.match(/(?:doi\.org|dx\.doi\.org)\/([10]\.[\d.]+\/[^\s&?#]+)/i);
    if (m1) return m1[1].replace(/\/$/, '');

    const m2 = url.match(/[?&]doi=([^&]+)/i);
    if (m2) return decodeURIComponent(m2[1]);
    return null;
}

async function fetchAbstractByDOI(doi) {
    if (!doi) return null;

    // 1. Semantic Scholar
    try {
        const data = await httpsGet(
            `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=abstract,title`,
            {}
        );
        const abs = cleanAbstract(data?.abstract);
        if (abs && abs.length >= ABSTRACT_MIN_LENGTH) return abs;
    } catch { /* continue */ }

    // 2. CrossRef
    try {
        const data = await httpsGet(
            `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
            { 'User-Agent': 'LiteratureAssistant/2.0 (mailto:research@example.com)' }
        );
        const abs = cleanAbstract(data?.message?.abstract);
        if (abs && abs.length >= ABSTRACT_MIN_LENGTH) return abs;
    } catch { /* continue */ }

    return null;
}

function normalizeTitle(title) {
    return title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function isDuplicate(title, existing) {
    const norm = normalizeTitle(title);
    return existing.some(e => normalizeTitle(e.judul || '') === norm);
}

/**
 * Tiered keyword relevance check.
 * Tier 1: exact phrase in title        → 'title'
 * Tier 2: exact phrase in abstract     → 'abstract'
 * Tier 3: not found anywhere           → null (skip)
 *
 * Uses exact phrase match — "machine learning" must appear as-is,
 * not just individual words scattered in the text.
 */
function getKeywordTier(keyword, title, abstract) {
    const phrase = keyword.trim().toLowerCase();
    const t = (title || '').toLowerCase();
    const a = (abstract || '').toLowerCase();
    if (t.includes(phrase)) return 'title';
    if (a.includes(phrase)) return 'abstract';
    return null;
}

function httpsGet(url, headers = {}, retries = 3) {
    return new Promise((resolve, reject) => {
        const attempt = (n) => {
            const options = {
                headers: { 'User-Agent': 'LiteratureAssistant/2.0', ...headers },
                timeout: 25000
            };
            const req = https.get(url, options, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return httpsGet(res.headers.location, headers, retries).then(resolve).catch(reject);
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error(`JSON parse failed (${res.statusCode}): ${data.slice(0, 200)}`)); }
                });
            });
            req.on('error', (err) => {
                if (n > 1) { setTimeout(() => attempt(n - 1), 3000); }
                else { reject(err); }
            });
            req.on('timeout', () => {
                req.destroy();
                if (n > 1) { setTimeout(() => attempt(n - 1), 3000); }
                else { reject(new Error('Request timeout')); }
            });
        };
        attempt(retries);
    });
}

function loadExisting() {
    if (hapusLama === 'y' && fs.existsSync(DATA_PATH)) { fs.unlinkSync(DATA_PATH); return []; }
    if (hapusLama === 'n' && fs.existsSync(DATA_PATH)) {
        try {
            const all = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));


            const SOURCE_MAP = {
                'scholar': 'Google Scholar',
                'scopus': 'Scopus',
                'semantic': 'Semantic Scholar'
            };
            const currentSourceLabel = SOURCE_MAP[source] || source;
            const filtered = all.filter(e => e.source !== currentSourceLabel);
            if (filtered.length < all.length) {
                console.log(` Removed ${all.length - filtered.length} old [${currentSourceLabel}] entries, keeping other sources.`);
            }
            return filtered;
        } catch { return []; }
    }
    return [];
}

function save(data) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

async function extractAbstractFromPage(page) {
    return page.evaluate(() => {
        const selectors = [
            '#abstract', '#articleAbstract', '#abs', '#abstractSection', '#abstractInFull',
            '.abstract', '.article-abstract', '.paper-abstract', '.abstractSection',
            '[itemprop="description"]', 'section.abstract', 'div.abstract',
            'meta[name="description"]', 'meta[property="og:description"]'
        ];
        for (const s of selectors) {
            const el = document.querySelector(s);
            if (!el) continue;
            const text = el.tagName === 'META' ? el.getAttribute('content') : el.innerText;
            if (text && text.trim().length > 100) return text.trim();
        }
        // Fallback paragraph — harus substansial agar tidak ambil teks acak
        const paras = [...document.querySelectorAll('p')]
            .map(p => p.innerText?.trim() || '')
            .filter(t => t.length > 200 && t.length < 4000)
            .sort((a, b) => b.length - a.length);
        return paras[0] || null;
    });
}

async function scrapeScholar(hasilAkhir) {
    let globalPage = null;

    let stdinBuf = '';
    process.stdin.on('data', async (data) => {
        stdinBuf += data.toString();
        const lines = stdinBuf.split('\n');
        stdinBuf = lines.pop();
        for (const line of lines) {
            const cmd = line.trim();
            if (cmd.startsWith('click:') && globalPage) {
                const parts = cmd.replace('click:', '').split(',');
                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                if (!isFinite(x) || !isFinite(y)) continue;
                try { await globalPage.mouse.click(x, y); } catch (err) { console.error('click error:', err.message); }
            }
        }
    });

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,720']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    let captchaActive = false;
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (!captchaActive && ['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    globalPage = page;

    const baseUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(keyword)}&as_ylo=${yearFrom}&as_yhi=${yearTo}`;

    console.log(` [Scholar] "${keyword}" (${yearFrom}${yearTo})  Target: ${TARGET}`);

    try {
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
        console.log('⟳ Scholar nav timeout, retrying...');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }


    const CAPTCHA_TIMEOUT = 120_000;
    const captchaStart = Date.now();
    while (true) {
        const captcha = await page.$('#gs_captcha_ccl') || await page.$('.g-recaptcha') || await page.$('#recaptcha');
        if (!captcha) break;
        if (Date.now() - captchaStart > CAPTCHA_TIMEOUT) {
            console.error(' CAPTCHA timeout');
            await browser.close(); process.exit(1);
        }
        const b64 = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });
        process.stdout.write(`CAPTCHA_URL:${b64}\n`);
        await delay(2000);
    }

    let journalCount = 0;
    let startParam = 0;
    const maxStart = Math.ceil(TARGET / 10) * 10 + 20;
    const reservedCandidates = []; // paywall slots: high quality tapi tidak ada abstract

    while (journalCount < TARGET && startParam < maxStart) {
        if (startParam > 0) {
            const pageUrl = `${baseUrl}&start=${startParam}`;
            try {
                await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 25000 });
            } catch {
                console.log(`⟳ Page ${startParam / 10 + 1} timeout, retrying...`);
                await delay(2500);
                try { await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
                catch { console.log(`️ Skip page ${startParam / 10 + 1}`); startParam += 10; continue; }
            }


            const cap2 = await page.$('#gs_captcha_ccl') || await page.$('.g-recaptcha');
            if (cap2) {
                const b64 = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });
                process.stdout.write(`CAPTCHA_URL:${b64}\n`);
                console.log('️ CAPTCHA on page, waiting...');
                for (let w = 0; w < 60; w++) {
                    await delay(2000);
                    const still = await page.$('#gs_captcha_ccl') || await page.$('.g-recaptcha');
                    if (!still) break;
                    const b64b = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });
                    process.stdout.write(`CAPTCHA_URL:${b64b}\n`);
                }
            }
        }

        const results = await page.evaluate(() => {
            return [...document.querySelectorAll('.gs_ri')].map(el => {
                const titleEl = el.querySelector('.gs_rt');
                const titleText = titleEl ? titleEl.innerText.trim() : '';
                const isBook = /\[BOOK\]|\[BUKU\]|\[CITATION\]/i.test(titleText);


                const citedByEl = [...el.querySelectorAll('.gs_fl a')]
                    .find(a => a.innerText.includes('Cited by'));
                const citationCount = citedByEl
                    ? parseInt(citedByEl.innerText.replace(/\D/g, '')) || 0
                    : 0;


                const pdfEl = el.closest('.gs_r')?.querySelector('.gs_or_gsh .gs_or_btn');
                const pdfLink = pdfEl?.href || null;
                const isOpenAccess = !!pdfEl;

                return {
                    isBook,
                    judul: titleText.replace(/^\[.*?\]\s*/, '').trim(),
                    author_info: (() => {
                        const gsa = el.querySelector('.gs_a')?.innerText || '';


                        const parts = gsa.split(' - ');
                        return parts[0] ? parts[0].trim() : 'Unknown';
                    })(),
                    tahun: (() => {
                        const gsa = el.querySelector('.gs_a')?.innerText || '';
                        const m = gsa.match(/\b(19|20)\d{2}\b/);
                        return m ? m[0] : 'N/A';
                    })(),
                    snippet: el.querySelector('.gs_rs')?.innerText || '',
                    link: el.querySelector('.gs_rt a')?.href || null,
                    pdfLink,
                    isOpenAccess,
                    citationCount,
                    source: 'Google Scholar'
                };
            });
        });

        if (!results.length) { console.log('️ Empty page, stopping.'); break; }


        for (const r of results) { r.link = cleanScholarLink(r.link); }

        for (const item of results) {
            if (journalCount >= TARGET) break;
            if (!item.judul || isDuplicate(item.judul, hasilAkhir)) continue;

            const itemYear = parseInt(item.tahun);
            if (itemYear && (itemYear < yearFrom || itemYear > yearTo)) {
                console.log(`⏭ Year skip (${itemYear}): ${item.judul.slice(0, 50)}`);
                continue;
            }

            // ── Citation quality filter ──────────────────────────────────────
            if (!item.isBook && !passesCitationFilter(item.citationCount, item.tahun)) {
                console.log(`⏭ Citation skip (${item.citationCount}): ${item.judul.slice(0, 50)}`);
                continue;
            }

            if (item.isBook) {
                // Books: only check title (no abstract available yet)
                const bookTier = getKeywordTier(keyword, item.judul, '');
                if (!bookTier) {
                    console.log(`⏭ Off-topic book skip: ${item.judul.slice(0, 50)}`);
                    continue;
                }
                item.abstrak_lengkap = 'Book/citation preview — no abstract available.';
                item.keyword = keyword;
                hasilAkhir.push(item);
                journalCount++;
                emitProgress(journalCount, TARGET);
                continue;
            }

            if (!item.link) continue;

            // ── Step 1: API-first — coba DOI API sebelum buka browser tab ──────
            let abstrak_lengkap = null;
            const doi = extractDOI(item.link);
            if (doi) {
                abstrak_lengkap = await fetchAbstractByDOI(doi);
                if (abstrak_lengkap) console.log(`  API abstract (DOI): ${doi.slice(0, 40)}`);
                await delay(300);
            }

            // ── Step 2: Buka detail page hanya jika API gagal ────────────────
            if (!abstrak_lengkap || abstrak_lengkap.length < ABSTRACT_MIN_LENGTH) {
                const detailPage = await browser.newPage();
                await detailPage.setRequestInterception(true);
                detailPage.on('request', req => {
                    if (['image', 'media', 'font'].includes(req.resourceType())) req.abort();
                    else req.continue();
                });

                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        await detailPage.goto(item.link, {
                            waitUntil: 'domcontentloaded',
                            timeout: attempt === 1 ? 12000 : 8000
                        });
                        abstrak_lengkap = await extractAbstractFromPage(detailPage);
                        if (abstrak_lengkap && abstrak_lengkap.length > 80) break;
                    } catch {
                        if (attempt === 2) console.log(`️ Fetch fail: ${item.judul.slice(0, 40)}`);
                        await delay(800);
                    }
                }

                await detailPage.close();
            } // end: buka detail page

            // ── Step 3: Decide ────────────────────────────────────────────────
            // Tier check: keyword must appear as exact phrase in title or abstract
            const scholarTier = getKeywordTier(keyword, item.judul, abstrak_lengkap || item.snippet || '');
            if (!scholarTier) {
                console.log(`⏭ Off-topic skip: ${item.judul.slice(0, 50)}`);
                continue;
            }

            if (abstrak_lengkap && abstrak_lengkap.length >= ABSTRACT_MIN_LENGTH) {
                // Abstract berkualitas ditemukan — masuk main results
                if (item.pdfLink) item.link = item.pdfLink;
                item.abstrak_lengkap = cleanAbstract(abstrak_lengkap) || abstrak_lengkap;
                item.keyword = keyword;
                item._kwTier = scholarTier;
                hasilAkhir.push(item);
                journalCount++;
                emitProgress(journalCount, TARGET);
            } else {
                // Tidak ada abstract — simpan jika layak (citation atau tahun baru)
                const qualifiesReserved = (item.citationCount >= RESERVED_CITATION_MIN || parseInt(item.tahun) >= SKIP_CITATION_YEAR)
                    && reservedCandidates.length < MAX_RESERVED_SLOTS;

                if (qualifiesReserved) {
                    console.log(`  No-abstract slot: "${item.judul.slice(0, 45)}" (${item.citationCount} citations)`);
                    if (item.pdfLink) item.link = item.pdfLink;
                    item.abstrak_lengkap = 'Abstract not available — access restricted or not indexed.';
                    item.keyword = keyword;
                    item.isPaywalled = true;
                    item._kwTier = scholarTier;
                    reservedCandidates.push(item);
                } else {
                    console.log(`⏭ No abstract, skip: ${item.judul.slice(0, 50)}`);
                }
            }

            // Jitter delay — tetap terlihat manusiawi
            await delay(300 + Math.random() * 300);
        }

        startParam += 10;
    }

    // ── Fill sisa slot dengan paywall candidates terbaik ───────────────────
    const remainingScholar = TARGET - journalCount;
    if (remainingScholar > 0 && reservedCandidates.length > 0) {
        const sorted = reservedCandidates.sort((a, b) => b.citationCount - a.citationCount);
        const toAdd = sorted.slice(0, Math.min(remainingScholar, MAX_RESERVED_SLOTS));
        for (const item of toAdd) {
            hasilAkhir.push(item);
            journalCount++;
            emitProgress(journalCount, TARGET);
        }
        console.log(` Added ${toAdd.length} paywall-reserved slot(s).`);
    }

    await browser.close();
    console.log(` [Scholar] Done. ${journalCount}/${TARGET} collected.`);
}

async function scrapeScopus(hasilAkhir) {
    if (!apiKey) { console.error(' Scopus API key not provided.'); process.exit(1); }

    console.log(` [Scopus] "${keyword}" (${yearFrom}${yearTo})  Target: ${TARGET}`);

    const baseQuery = `TITLE-ABS-KEY(${keyword}) AND PUBYEAR > ${yearFrom - 1} AND PUBYEAR < ${yearTo + 1}`;
    const fields = 'dc:title,dc:creator,dc:description,author,prism:coverDate,prism:doi,prism:publicationName,prism:isbn,dc:publisher,eid,link,abstract,citedby-count,openaccess,openaccessFlag';
    const batchSize = Math.min(TARGET, 25);

    let count = 0, start = 0;
    const reservedCandidatesScopus = [];

    while (count < TARGET) {
        const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(baseQuery)}&count=${batchSize}&start=${start}&sort=citedby-count&field=${fields}`;
        let data;
        try {
            data = await httpsGet(url, { 'X-ELS-APIKey': apiKey, 'Accept': 'application/json' });
        } catch (err) {
            console.error(' Scopus API error:', err.message);
            break;
        }


        const entries = data?.['search-results']?.entry || [];
        const totalAvail = parseInt(data?.['search-results']?.['opensearch:totalResults'] || '0');
        const statusCode = data?.['service-error']?.status?.statusCode
            || data?.['search-results']?.['opensearch:totalResults'];
        const errMsg = data?.['service-error']?.status?.statusText
            || data?.['search-results']?.entry?.[0]?.error;

        if (data?.['service-error']) {
            console.error(` Scopus API error: ${JSON.stringify(data['service-error'])}`);
            break;
        }

        if (!entries.length) {
            console.log(`️ [Scopus] No results. Total available: ${totalAvail}`);
            console.log(`   Query: ${baseQuery.slice(0, 80)}`);
            if (errMsg) console.log(`   Error: ${errMsg}`);
            break;
        }

        for (const entry of entries) {
            if (count >= TARGET) break;

            const judul = entry['dc:title'];
            if (!judul || judul === 'No title found.') continue;
            if (isDuplicate(judul, hasilAkhir) || isDuplicate(judul, reservedCandidatesScopus)) continue;

            const citationCount = parseInt(entry['citedby-count'] || entry['citationCount'] || 0);
            const tahun = entry['prism:coverDate']?.split('-')[0] || 'N/A';

            // ── Citation quality filter ──────────────────────────────────────
            if (!passesCitationFilter(citationCount, tahun)) {
                console.log(`⏭ Citation skip (${citationCount}): ${judul.slice(0, 50)}`);
                continue;
            }

            let author_info = 'Unknown';
            if (Array.isArray(entry.author) && entry.author.length > 0) {
                const names = entry.author.slice(0, 3).map(a => a.authname || '').filter(Boolean);
                author_info = names.join(', ') + (entry.author.length > 3 ? ' et al.' : '');
            } else if (entry['dc:creator']) {
                author_info = entry['dc:creator'];
            }

            const doi = entry['prism:doi'];
            const scopusLink = Array.isArray(entry.link)
                ? entry.link.find(l => l['@ref'] === 'scopus')?.['@href'] : null;
            const link = scopusLink || (doi ? `https://doi.org/${doi}` : null);

            // ── Abstract pipeline ─────────────────────────────────────────────
            let abstrak_lengkap = null;

            // 1. Inline dari API response
            const inline = cleanAbstract(entry['dc:description'] || entry['abstract']);
            if (inline && inline.length >= ABSTRACT_MIN_LENGTH) abstrak_lengkap = inline;

            // 2. Elsevier Abstract API
            if (!abstrak_lengkap) {
                const eid = entry['eid'];
                const absUrl = eid
                    ? `https://api.elsevier.com/content/abstract/eid/${eid}`
                    : doi ? `https://api.elsevier.com/content/abstract/doi/${encodeURIComponent(doi)}` : null;

                if (absUrl) {
                    try {
                        const absData = await httpsGet(absUrl, { 'X-ELS-APIKey': apiKey, 'Accept': 'application/json' });
                        const core = absData?.['abstracts-retrieval-response']?.coredata;
                        const raw = core?.['dc:description'] || core?.['abstract']
                            || absData?.['abstracts-retrieval-response']?.item?.bibrecord?.head?.abstracts;
                        const candidate = cleanAbstract(String(raw || ''));
                        if (candidate && candidate.length >= ABSTRACT_MIN_LENGTH) abstrak_lengkap = candidate;
                    } catch (e) {
                        console.log(`️ Elsevier abstract fail: ${e.message.slice(0, 50)}`);
                    }
                    await delay(350);
                }
            }

            // 3. DOI fallback (Semantic Scholar → CrossRef)
            if (!abstrak_lengkap && doi) {
                const fallback = await fetchAbstractByDOI(doi);
                if (fallback) {
                    abstrak_lengkap = fallback;
                    console.log(`  DOI fallback: ${doi.slice(0, 40)}`);
                }
                await delay(250);
            }

            const journalName = entry['prism:publicationName'] || entry['prism:isbn']
                || entry['dc:publisher'] || null;

            // ── Decide ────────────────────────────────────────────────────────
            // Tier check
            const scopusTier = getKeywordTier(keyword, judul, abstrak_lengkap || '');
            if (!scopusTier) {
                console.log(`⏭ Off-topic skip: ${judul.slice(0, 50)}`);
                continue;
            }

            if (abstrak_lengkap && abstrak_lengkap.length >= ABSTRACT_MIN_LENGTH) {
                hasilAkhir.push({
                    isBook: false, judul, author_info, tahun,
                    abstrak_lengkap, link, source: 'Scopus',
                    journal: journalName, keyword, citationCount,
                    isOpenAccess: entry['openaccess'] === '1' || entry['openaccessFlag'] === true,
                    _kwTier: scopusTier
                });
                count++;
                emitProgress(count, TARGET);
            } else {
                const qualifiesReserved = doi
                    && (citationCount >= RESERVED_CITATION_MIN || parseInt(tahun) >= SKIP_CITATION_YEAR)
                    && reservedCandidatesScopus.length < MAX_RESERVED_SLOTS;

                if (qualifiesReserved) {
                    console.log(`  Paywall slot reserved: "${judul.slice(0, 45)}" (${citationCount} citations)`);
                    reservedCandidatesScopus.push({
                        isBook: false, judul, author_info, tahun,
                        abstrak_lengkap: 'Abstract not available — access restricted (paywall).',
                        link, source: 'Scopus', journal: journalName,
                        keyword, citationCount, isPaywalled: true,
                        isOpenAccess: entry['openaccess'] === '1' || entry['openaccessFlag'] === true,
                        _kwTier: scopusTier
                    });
                } else {
                    console.log(`⏭ No abstract, skip: ${judul.slice(0, 50)}`);
                }
            }
        }

        start += batchSize;
        if (start >= totalAvail || entries.length < batchSize) break;
        await delay(400);
    }

    // Fill sisa slot dengan paywall candidates
    const remainingScopus = TARGET - count;
    if (remainingScopus > 0 && reservedCandidatesScopus.length > 0) {
        const sorted = reservedCandidatesScopus.sort((a, b) => b.citationCount - a.citationCount);
        const toAdd = sorted.slice(0, Math.min(remainingScopus, MAX_RESERVED_SLOTS));
        for (const item of toAdd) {
            hasilAkhir.push(item);
            count++;
            emitProgress(count, TARGET);
        }
        console.log(` Added ${toAdd.length} paywall-reserved slot(s).`);
    }

    console.log(` [Scopus] Done. ${count}/${TARGET} collected.`);
}

async function scrapeSemantic(hasilAkhir) {
    if (!apiKey) {
        console.log(' [Semantic] No API key — rate limit: 1 req/s. Add key for 10 req/s.');
    }

    const perPaperDelay = apiKey ? 120 : 1100;
    const fields = 'title,abstract,authors,year,externalIds,openAccessPdf,url,citationCount,publicationTypes,isOpenAccess,journal,publicationVenue';
    const batch = Math.min(TARGET * 3, 100);
    let count = 0, offset = 0;
    const reservedCandidatesSemantic = [];

    console.log(` [Semantic Scholar] "${keyword}" (${yearFrom}-${yearTo})  Target: ${TARGET}`);

    while (count < TARGET) {
        const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(keyword)}&limit=${batch}&offset=${offset}&fields=${fields}&year=${yearFrom}-${yearTo}`;

        let data;
        try {
            data = await httpsGet(url, { 'x-api-key': apiKey || '' });
        } catch (err) {
            console.error(' [Semantic] Request error:', err.message);
            break;
        }

        const papers = data?.data || [];
        const total = data?.total || 0;

        if (!papers.length) {
            console.log(' [Semantic] No results.');
            break;
        }

        const countBefore = count;

        for (const paper of papers) {
            if (count >= TARGET) break;
            if (!paper.title) continue;
            if (isDuplicate(paper.title, hasilAkhir) || isDuplicate(paper.title, reservedCandidatesSemantic)) continue;

            const citationCount = paper.citationCount || 0;
            const tahun = paper.year ? String(paper.year) : 'N/A';

            if (!passesCitationFilter(citationCount, tahun)) {
                console.log(` Citation skip (${citationCount}): ${paper.title.slice(0, 50)}`);
                continue;
            }

            const doi = paper.externalIds?.DOI;
            const link = paper.openAccessPdf?.url
                || (doi ? `https://doi.org/${doi}` : null)
                || paper.url || null;

            const authors = paper.authors?.length
                ? paper.authors.slice(0, 3).map(a => a.name).join(', ') + (paper.authors.length > 3 ? ' et al.' : '')
                : 'Unknown';

            let abstract = cleanAbstract(paper.abstract);

            if ((!abstract || abstract.length < ABSTRACT_MIN_LENGTH) && doi) {
                try {
                    const detail = await httpsGet(
                        `https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?fields=abstract`,
                        { 'x-api-key': apiKey || '' }
                    );
                    const candidate = cleanAbstract(detail?.abstract);
                    if (candidate && candidate.length >= ABSTRACT_MIN_LENGTH) abstract = candidate;
                } catch { }
                await delay(apiKey ? 250 : 1100);
            }

            if ((!abstract || abstract.length < ABSTRACT_MIN_LENGTH) && doi) {
                try {
                    const cr = await httpsGet(
                        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
                        { 'User-Agent': 'LiteratureAssistant/2.0 (mailto:research@example.com)' }
                    );
                    const candidate = cleanAbstract(cr?.message?.abstract);
                    if (candidate && candidate.length >= ABSTRACT_MIN_LENGTH) abstract = candidate;
                } catch { }
                await delay(200);
            }

            const semanticTier = getKeywordTier(keyword, paper.title, abstract || '');
            if (!semanticTier) {
                console.log(` Off-topic skip: ${paper.title.slice(0, 50)}`);
                continue;
            }

            if (abstract && abstract.length >= ABSTRACT_MIN_LENGTH) {
                hasilAkhir.push({
                    isBook: false,
                    judul: paper.title,
                    author_info: authors,
                    tahun,
                    abstrak_lengkap: abstract,
                    link,
                    source: 'Semantic Scholar',
                    keyword,
                    journal: paper.journal?.name || paper.publicationVenue?.name || null,
                    citationCount,
                    isOpenAccess: paper.isOpenAccess || !!paper.openAccessPdf?.url,
                    _kwTier: semanticTier
                });
                count++;
                emitProgress(count, TARGET);
            } else {
                const qualifiesReserved = doi
                    && (citationCount >= RESERVED_CITATION_MIN || parseInt(tahun) >= SKIP_CITATION_YEAR)
                    && reservedCandidatesSemantic.length < MAX_RESERVED_SLOTS;

                if (qualifiesReserved) {
                    console.log(` Paywall slot reserved: "${paper.title.slice(0, 45)}" (${citationCount} citations)`);
                    reservedCandidatesSemantic.push({
                        isBook: false, judul: paper.title, author_info: authors, tahun,
                        abstrak_lengkap: 'Abstract not available — access restricted (paywall).',
                        link, source: 'Semantic Scholar',
                        keyword, journal: paper.journal?.name || paper.publicationVenue?.name || null,
                        citationCount, isPaywalled: true,
                        isOpenAccess: paper.isOpenAccess || !!paper.openAccessPdf?.url,
                        _kwTier: semanticTier
                    });
                } else {
                    console.log(` No abstract, skip: ${paper.title.slice(0, 50)}`);
                }
            }

            await delay(perPaperDelay);
        }

        offset += batch;

        const stalled = count === countBefore && papers.length < 5;
        if (offset >= total || stalled) break;

        await delay(400);
    }

    const remainingSemantic = TARGET - count;
    if (remainingSemantic > 0 && reservedCandidatesSemantic.length > 0) {
        const sorted = reservedCandidatesSemantic.sort((a, b) => b.citationCount - a.citationCount);
        const toAdd = sorted.slice(0, Math.min(remainingSemantic, MAX_RESERVED_SLOTS));
        for (const item of toAdd) {
            hasilAkhir.push(item);
            count++;
            emitProgress(count, TARGET);
        }
        console.log(` Added ${toAdd.length} paywall-reserved slot(s).`);
    }

    console.log(` [Semantic Scholar] Done. ${count}/${TARGET} collected.`);
}

async function main() {
    if (!keyword) { console.error(' No keyword provided.'); process.exit(1); }

    console.log(`\n ${source.toUpperCase()} | "${keyword}" | ${yearFrom}–${yearTo} | Target: ${TARGET}`);
    console.log(` Quality: min ${CITATION_MIN} citations (exempt: ${SKIP_CITATION_YEAR}+) | Paywall slots: ${MAX_RESERVED_SLOTS}`);

    const hasilAkhir = loadExisting();

    if (source === 'scholar') await scrapeScholar(hasilAkhir);
    else if (source === 'scopus') await scrapeScopus(hasilAkhir);
    else if (source === 'semantic') await scrapeSemantic(hasilAkhir);
    else { console.error(` Unknown source: ${source}`); process.exit(1); }

    save(hasilAkhir);
    console.log(`Saved ${hasilAkhir.length} total items to jurnal_mentah_${JOB_ID}.json`);
    process.exit(0);
}

main().catch(err => {
    console.error(' Fatal error:', err);
    process.exit(1);
});