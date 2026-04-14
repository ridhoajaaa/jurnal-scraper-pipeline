const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const https = require('https');
const CONFIG = require('./config');

puppeteer.use(StealthPlugin());

const argOffset = process.argv[2] === '--' ? 1 : 0;

const keyword = process.argv[2 + argOffset] || '';
const hapusLama = process.argv[3 + argOffset] || 'n';
const source = (process.argv[4 + argOffset] || 'scholar').toLowerCase();
const apiKey = process.argv[5 + argOffset] || '';
const yearFrom = parseInt(process.argv[6 + argOffset]) || 2020;
const currentYear = new Date().getFullYear();
let yearTo = parseInt(process.argv[7 + argOffset]) || currentYear;

// Cap yearTo to current year + 1 (untuk early access papers)
if (yearTo > currentYear + 1) {
    console.log(`⚠️  Year ${yearTo} is in the future. Capping to ${currentYear + 1}.`);
    yearTo = currentYear + 1;
}
const TARGET = Math.min(parseInt(process.argv[8 + argOffset]) || 10, 50);

const JOB_ID = process.argv[9 + argOffset] || process.env.JOB_ID || 'standalone';
const DATA_PATH = path.join(__dirname, `../data/jurnal_mentah_${JOB_ID}.json`);
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// ─── Quality constants (from config) ──────────────────────────────────────────
const CITATION_MIN = CONFIG.QUALITY.MIN_CITATION;
const SKIP_CITATION_YEAR = CONFIG.QUALITY.SKIP_CITATION_YEAR;
const RESERVED_CITATION_MIN = CONFIG.QUALITY.RESERVED_CITATION_MIN;
const MAX_RESERVED_SLOTS = CONFIG.QUALITY.MAX_RESERVED_SLOTS;
const ABSTRACT_MIN_LENGTH = CONFIG.QUALITY.ABSTRACT_MIN_LENGTH;
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
 * Smart citation quality filter - age aware
 * Paper baru: bebas citasi requirement
 * Paper 2-5 tahun: minimal 1 citasi per 2 tahun
 * Paper > 5 tahun: minimal 3 citasi total
 * Paper dengan potensi: minimal 1 citasi (bisa enrichment)
 */
function passesCitationFilter(citationCount, yearStr) {
    const yr = parseInt(yearStr);
    const currentYear = new Date().getFullYear();
    if (isNaN(yr)) return true; // Kalau tahun tidak valid, jangan filter

    const age = currentYear - yr;
    const citations = citationCount || 0;

    // Paper tahun ini atau tahun lalu: bebas
    if (age <= 1) return true;

    // Paper 2-3 tahun: minimal 1 citasi
    if (age <= 3) return citations >= 1;

    // Paper 4-5 tahun: minimal 2 citasi
    if (age <= 5) return citations >= 2;

    // Paper > 5 tahun: minimal 3 citasi
    return citations >= CITATION_MIN;
}

/**
 * Get quality tier berdasarkan citation + age (untuk ranking)
 */
function getCitationTier(citationCount, yearStr) {
    const yr = parseInt(yearStr);
    const currentYear = new Date().getFullYear();
    if (isNaN(yr)) return 'unknown';

    const age = currentYear - yr;
    const citations = citationCount || 0;
    const rate = age > 0 ? citations / age : citations;

    if (rate >= 10) return 'high';      // > 10 citasi per tahun
    if (rate >= 3) return 'medium';     // 3-10 citasi per tahun
    if (rate >= 1) return 'low';        // 1-3 citasi per tahun
    return 'minimal';                   // < 1 citasi per tahun
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
            {},
            CONFIG.RETRY.API_MAX
        );
        const abs = cleanAbstract(data?.abstract);
        if (abs && abs.length >= ABSTRACT_MIN_LENGTH) return abs;
    } catch (err) {
        console.error(`[Semantic Scholar] Failed for DOI:${doi}: ${err.message}`);
    }

    // 2. CrossRef
    try {
        const data = await httpsGet(
            `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
            { 'User-Agent': `${CONFIG.HEADERS.USER_AGENT} (${CONFIG.HEADERS.EMAIL_CONTACT})` },
            CONFIG.RETRY.API_MAX
        );
        const abs = cleanAbstract(data?.message?.abstract);
        if (abs && abs.length >= ABSTRACT_MIN_LENGTH) return abs;
    } catch (err) {
        console.error(`[CrossRef] Failed for DOI:${doi}: ${err.message}`);
    }

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
 * Smart keyword relevance check - partial matching
 * Relevance score: 0.0 - 1.0 based on token overlap
 * Tier 1: score >= 0.7 in title       → 'title-high'
 * Tier 2: score >= 0.5 in title       → 'title-medium'
 * Tier 3: score >= 0.7 in abstract    → 'abstract-high'
 * Tier 4: score >= 0.5 in abstract    → 'abstract-medium'
 * Tier 5: score < 0.5                 → null (skip)
 *
 * Contoh: keyword "machine learning"
 * - "Deep Learning for Machine Vision" → title-medium (50% match)
 * - "Machine Learning Applications"    → title-high (100% match)
 * - "Learning Machines in Healthcare"  → title-medium (partial match)
 */
function getKeywordRelevance(keyword, text) {
    if (!keyword || !text) return 0;

    const keyTokens = keyword.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2);  // Abaikan kata pendek (the, in, of, dll)

    if (keyTokens.length === 0) return 0;

    const textLower = text.toLowerCase();
    let matchedTokens = 0;

    for (const token of keyTokens) {
        // Cek exact match atau partial match (untuk kata majemuk)
        if (textLower.includes(token)) {
            matchedTokens++;
        } else {
            // Cek apakah token ini ada sebagai substring dalam kata lain
            // Contoh: "learning" dalam "deep learning" atau "machine learning"
            const words = textLower.split(/\s+/);
            if (words.some(w => w.includes(token) || token.includes(w))) {
                matchedTokens += 0.5;  // Partial match, setengah poin
            }
        }
    }

    return matchedTokens / keyTokens.length;
}

function getKeywordTier(keyword, title, abstract) {
    const titleRel = getKeywordRelevance(keyword, title);
    const abstractRel = getKeywordRelevance(keyword, abstract);

    // Priority: title match lebih tinggi dari abstract match
    if (titleRel >= 0.7) return 'title-high';
    if (titleRel >= 0.5) return 'title-medium';
    if (abstractRel >= 0.7) return 'abstract-high';
    if (abstractRel >= 0.5) return 'abstract-medium';

    return null;  // Skip kalau relevance terlalu rendah
}

/**
 * Get relevance score untuk ranking (0-100)
 */
function getRelevanceScore(keyword, title, abstract) {
    const titleRel = getKeywordRelevance(keyword, title);
    const abstractRel = getKeywordRelevance(keyword, abstract);

    // Title match lebih berbobot (70%) daripada abstract (30%)
    const score = (titleRel * 0.7 + abstractRel * 0.3) * 100;
    return Math.round(score);
}

/**
 * HTTPS GET dengan retry logic dan exponential backoff
 * Handle 429 Too Many Requests dengan delay yang meningkat
 */
function httpsGet(url, headers = {}, retries = CONFIG.RETRY.API_MAX) {
    return new Promise((resolve, reject) => {
        const attempt = (n, delayMs = CONFIG.DELAY.RETRY_BACKOFF) => {
            let isHandled = false;
            const options = {
                headers: { 'User-Agent': CONFIG.HEADERS.USER_AGENT, ...headers },
                timeout: CONFIG.TIMEOUT.API_CALL
            };
            const req = https.get(url, options, (res) => {
                // Handle redirect
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if (isHandled) return; isHandled = true;
                    return httpsGet(res.headers.location, headers, retries).then(resolve).catch(reject);
                }

                // Handle rate limit (429) dengan exponential backoff
                if (res.statusCode === 429) {
                    if (isHandled) return; isHandled = true;
                    const retryAfter = parseInt(res.headers['retry-after']) || 0;
                    const waitMs = retryAfter * 1000 || delayMs;
                    console.warn(`[httpsGet] Rate limited (429). Waiting ${waitMs}ms before retry ${CONFIG.RETRY.API_MAX - n + 1}...`);
                    if (n > 1) {
                        setTimeout(() => attempt(n - 1, delayMs * 2), waitMs);
                    } else {
                        reject(new Error('Rate limit exceeded (429). Try again later or use an API key.'));
                    }
                    return;
                }

                // Handle server errors (5xx) dengan retry
                if (res.statusCode >= 500) {
                    if (isHandled) return; isHandled = true;
                    console.warn(`[httpsGet] Server error (${res.statusCode}). Retry ${CONFIG.RETRY.API_MAX - n + 1}...`);
                    if (n > 1) {
                        setTimeout(() => attempt(n - 1, delayMs), delayMs);
                    } else {
                        reject(new Error(`Server error ${res.statusCode}`));
                    }
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (isHandled) return; isHandled = true;
                    if (res.statusCode >= 400) {
                        reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    }
                    catch (e) {
                        reject(new Error(`JSON parse failed (${res.statusCode}): ${data.slice(0, 200)}`));
                    }
                });
            });
            req.on('error', (err) => {
                if (isHandled) return; isHandled = true;
                console.error(`[httpsGet] Attempt ${CONFIG.RETRY.API_MAX - n + 1} failed for ${url}: ${err.message}`);
                if (n > 1) { setTimeout(() => attempt(n - 1, delayMs * 2), delayMs); }
                else { reject(err); }
            });
            req.on('timeout', () => {
                if (isHandled) return; isHandled = true;
                req.destroy();
                console.error(`[httpsGet] Timeout on attempt ${CONFIG.RETRY.API_MAX - n + 1} for ${url}`);
                if (n > 1) { setTimeout(() => attempt(n - 1, delayMs * 2), delayMs); }
                else { reject(new Error('Request timeout')); }
            });
        };
        attempt(retries);
    });
}

function loadExisting() {
    if (hapusLama === 'y' && fs.existsSync(DATA_PATH)) {
        fs.unlinkSync(DATA_PATH);
        console.log(`[loadExisting] Deleted old data file: ${DATA_PATH}`);
        return [];
    }
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
                console.log(`[loadExisting] Removed ${all.length - filtered.length} old [${currentSourceLabel}] entries, keeping other sources.`);
            }
            return filtered;
        } catch (err) {
            console.error(`[loadExisting] Failed to parse ${DATA_PATH}: ${err.message}`);
            return [];
        }
    }
    return [];
}

function save(data) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

async function extractAbstractFromPage(page) {
    const maxLen = CONFIG.QUALITY.ABSTRACT_MAX_LENGTH || 5000;
    return page.evaluate((selectors, minLength, maxLength) => {
        // Noise patterns — skip elements containing these (navigation, metadata, etc.)
        const NOISE = ['order article', 'reprints', 'open accessarticle', 'download keyboard',
                        'browse figures', 'review reports', 'submit to', 'copyright ©',
                        'share and cite', 'article metrics'];

        function isNoise(text) {
            const lower = text.toLowerCase().substring(0, 300);
            return NOISE.some(n => lower.includes(n));
        }

        function clamp(text) {
            return text.trim().substring(0, maxLength);
        }

        // Step 1: Try dedicated abstract selectors
        for (const s of selectors) {
            const el = document.querySelector(s);
            if (!el) continue;
            const text = el.tagName === 'META' ? el.getAttribute('content') : el.innerText;
            if (!text) continue;
            const trimmed = text.trim();
            if (trimmed.length > minLength && trimmed.length < maxLength && !isNoise(trimmed)) {
                return trimmed;
            }
        }

        // Step 2: Fallback — find the best paragraph that looks like an abstract
        const paras = [...document.querySelectorAll('p, div.abstract, section.abstract')]
            .map(p => p.innerText?.trim() || '')
            .filter(t => t.length > 200 && t.length < 4000 && !isNoise(t));

        // Prefer paragraphs with academic signal words
        const signals = ['this study', 'this paper', 'abstract', 'we propose', 'results',
                         'findings', 'method', 'objective', 'purpose', 'conclusion'];
        const academic = paras.filter(t => {
            const lower = t.toLowerCase();
            return signals.some(s => lower.includes(s));
        });

        if (academic.length > 0) return clamp(academic[0]);
        if (paras.length > 0) return clamp(paras[0]);

        // NO body.innerText fallback — it grabs entire page content and is never useful
        return null;
    }, CONFIG.ABSTRACT_SELECTORS, 100, maxLen);
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
        headless: CONFIG.BROWSER.HEADLESS,
        args: CONFIG.BROWSER.ARGS
    });

    const page = await browser.newPage();
    await page.setViewport({ width: CONFIG.BROWSER.WINDOW_WIDTH, height: CONFIG.BROWSER.WINDOW_HEIGHT });
    let captchaActive = false;
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (!captchaActive && ['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    globalPage = page;

    const baseUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(keyword)}&as_ylo=${yearFrom}&as_yhi=${yearTo}`;

    console.log(`[Scholar] "${keyword}" (${yearFrom}-${yearTo}) Target: ${TARGET}`);

    try {
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUT.PAGE_LOAD });
    } catch (err) {
        console.log(`[Scholar] Initial nav timeout: ${err.message}, retrying...`);
        try {
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.TIMEOUT.PAGE_LOAD });
        } catch (err2) {
            console.error(`[Scholar] Failed to load initial page: ${err2.message}`);
            await browser.close();
            process.exit(1);
        }
    }

    const captchaStart = Date.now();
    while (true) {
        try {
            const captcha = await page.$('#gs_captcha_ccl') || await page.$('.g-recaptcha') || await page.$('#recaptcha');
            if (!captcha) { captchaActive = false; break; }
        } catch {
            // Execution context destroyed = page navigated after CAPTCHA solved
            console.log('[Scholar] CAPTCHA resolved (page navigated)');
            captchaActive = false;
            break;
        }
        captchaActive = true;
        if (Date.now() - captchaStart > CONFIG.TIMEOUT.CAPTCHA) {
            console.error('[Scholar] CAPTCHA timeout after 2 minutes');
            await browser.close();
            process.exit(1);
        }
        try {
            const b64 = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });
            process.stdout.write(`CAPTCHA_URL:${b64}\n`);
        } catch { /* page navigating, ignore */ }
        await delay(CONFIG.TIMEOUT.STDIN_POLL);
    }

    let journalCount = 0;
    let startParam = 0;
    const maxStart = Math.ceil(TARGET / CONFIG.PAGINATION.RESULTS_PER_PAGE) * CONFIG.PAGINATION.RESULTS_PER_PAGE + CONFIG.PAGINATION.MAX_PAGES_BUFFER;
    const reservedCandidates = []; // paywall slots: high quality tapi tidak ada abstract

    while (journalCount < TARGET && startParam < maxStart) {
        if (startParam > 0) {
            const pageUrl = `${baseUrl}&start=${startParam}`;
            const pageNum = Math.floor(startParam / CONFIG.PAGINATION.RESULTS_PER_PAGE) + 1;
            try {
                await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUT.PAGE_LOAD });
            } catch (err) {
                console.log(`[Scholar] Page ${pageNum} timeout: ${err.message}, retrying...`);
                await delay(CONFIG.DELAY.BETWEEN_PAGES);
                try {
                    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.TIMEOUT.PAGE_LOAD_RETRY });
                } catch (err2) {
                    console.error(`[Scholar] Failed to load page ${pageNum}: ${err2.message}, skipping...`);
                    startParam += CONFIG.PAGINATION.RESULTS_PER_PAGE;
                    continue;
                }
            }

            // Human-like delay between pages
            await delay(CONFIG.DELAY.BETWEEN_PAGES + Math.random() * 1000);

            const cap2 = await page.$('#gs_captcha_ccl') || await page.$('.g-recaptcha');
            if (cap2) {
                captchaActive = true;
                try {
                    const b64 = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });
                    process.stdout.write(`CAPTCHA_URL:${b64}\n`);
                } catch { /* ignore if page navigating */ }
                console.log(`[Scholar] CAPTCHA on page ${pageNum}, waiting...`);
                for (let w = 0; w < 60; w++) {
                    await delay(CONFIG.TIMEOUT.STDIN_POLL);
                    try {
                        const still = await page.$('#gs_captcha_ccl') || await page.$('.g-recaptcha');
                        if (!still) break;
                        const b64b = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 40 });
                        process.stdout.write(`CAPTCHA_URL:${b64b}\n`);
                    } catch {
                        // Execution context destroyed = CAPTCHA solved, page navigated
                        console.log(`[Scholar] CAPTCHA resolved on page ${pageNum}`);
                        break;
                    }
                }
                captchaActive = false;
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
                // Books: check title dengan relaxed matching
                const bookTier = getKeywordTier(keyword, item.judul, item.snippet || '');
                if (!bookTier) {
                    console.log(`⏭ Off-topic book skip: ${item.judul.slice(0, 50)}`);
                    continue;
                }
                const relevanceScore = getRelevanceScore(keyword, item.judul, item.snippet || '');
                item.abstrak_lengkap = item.snippet || 'Book/citation preview — no abstract available.';
                item.keyword = keyword;
                item._kwTier = bookTier;
                item._relevanceScore = relevanceScore;
                item._isEnriched = false;
                hasilAkhir.push(item);
                journalCount++;
                emitProgress(journalCount, TARGET);
                console.log(`  📚 Book: "${item.judul.slice(0, 45)}" (${relevanceScore}% relevance)`);
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
                try {
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
                } finally {
                    await detailPage.close().catch(() => {});
                }
            } // end: buka detail page

            // ── Step 3: Decide ────────────────────────────────────────────────
            // ALWAYS use Google Scholar snippet as base abstract (never empty!)
            let finalAbstract = item.snippet || '';
            let isEnriched = false;

            // If we got better abstract from enrichment, use it
            if (abstrak_lengkap && abstrak_lengkap.length >= ABSTRACT_MIN_LENGTH) {
                finalAbstract = cleanAbstract(abstrak_lengkap) || abstrak_lengkap;
                isEnriched = true;
            }

            // Check keyword relevance dengan abstract final (snippet atau enriched)
            const scholarTier = getKeywordTier(keyword, item.judul, finalAbstract);
            if (!scholarTier) {
                console.log(`⏭ Off-topic skip: ${item.judul.slice(0, 50)}`);
                continue;
            }

            // Calculate relevance score untuk ranking
            const relevanceScore = getRelevanceScore(keyword, item.judul, finalAbstract);

            // Prepare final item
            if (item.pdfLink) item.link = item.pdfLink;
            item.abstrak_lengkap = finalAbstract;
            item.keyword = keyword;
            item._kwTier = scholarTier;
            item._relevanceScore = relevanceScore;
            item._isEnriched = isEnriched;

            // Categorize: enriched abstract = main result, snippet only = reserved slot
            if (isEnriched) {
                // Abstract berkualitas ditemukan — masuk main results
                hasilAkhir.push(item);
                journalCount++;
                emitProgress(journalCount, TARGET);
                console.log(`  ✓ Enriched: "${item.judul.slice(0, 45)}" (${relevanceScore}% relevance)`);
            } else {
                // Hanya punya snippet — simpan jika layak
                const qualifiesReserved = (item.citationCount >= RESERVED_CITATION_MIN || parseInt(item.tahun) >= SKIP_CITATION_YEAR)
                    && reservedCandidates.length < MAX_RESERVED_SLOTS;

                if (qualifiesReserved) {
                    console.log(`  ○ Snippet-only: "${item.judul.slice(0, 45)}" (${item.citationCount} citations, ${relevanceScore}% relevance)`);
                    item.isPaywalled = true;
                    reservedCandidates.push(item);
                } else {
                    console.log(`⏭ Low quality (snippet-only): ${item.judul.slice(0, 50)}`);
                }
            }

            // Jitter delay — human-like pacing to reduce CAPTCHA risk
            await delay(1500 + Math.random() * 2000);
        }

        startParam += 10;
    }

    // ── Fill sisa slot dengan paywall candidates terbaik ───────────────────
    const remainingScholar = TARGET - journalCount;
    if (remainingScholar > 0 && reservedCandidates.length > 0) {
        // Sort by: relevance score (60%) + citation count (40%)
        const sorted = reservedCandidates.sort((a, b) => {
            const scoreA = (a._relevanceScore || 0) * 0.6 + (a.citationCount || 0) * 0.4;
            const scoreB = (b._relevanceScore || 0) * 0.6 + (b.citationCount || 0) * 0.4;
            return scoreB - scoreA;
        });
        const toAdd = sorted.slice(0, Math.min(remainingScholar, MAX_RESERVED_SLOTS));
        for (const item of toAdd) {
            hasilAkhir.push(item);
            journalCount++;
            emitProgress(journalCount, TARGET);
        }
        console.log(` Added ${toAdd.length} snippet-only slot(s) (sorted by relevance + citations).`);
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
            // Tier check dengan relaxed matching
            const scopusTier = getKeywordTier(keyword, judul, abstrak_lengkap || '');
            if (!scopusTier) {
                console.log(`⏭ Off-topic skip: ${judul.slice(0, 50)}`);
                continue;
            }

            // Calculate relevance score
            const relevanceScore = getRelevanceScore(keyword, judul, abstrak_lengkap || '');
            const citationTier = getCitationTier(citationCount, tahun);

            if (abstrak_lengkap && abstrak_lengkap.length >= ABSTRACT_MIN_LENGTH) {
                hasilAkhir.push({
                    isBook: false, judul, author_info, tahun,
                    abstrak_lengkap, link, source: 'Scopus',
                    journal: journalName, keyword, citationCount,
                    isOpenAccess: entry['openaccess'] === '1' || entry['openaccessFlag'] === true,
                    _kwTier: scopusTier,
                    _relevanceScore: relevanceScore,
                    _citationTier: citationTier,
                    _isEnriched: true
                });
                count++;
                emitProgress(count, TARGET);
                console.log(`  ✓ Scopus: "${judul.slice(0, 45)}" (${relevanceScore}% relevance, ${citationTier} citations)`);
            } else {
                // Untuk Scopus, selalu simpan karena data sudah berkualitas
                const qualifiesReserved = (citationCount >= 1 || parseInt(tahun) >= 2023)
                    && reservedCandidatesScopus.length < MAX_RESERVED_SLOTS;

                if (qualifiesReserved) {
                    console.log(`  ○ Scopus (no abstract): "${judul.slice(0, 45)}" (${citationCount} citations)`);
                    reservedCandidatesScopus.push({
                        isBook: false, judul, author_info, tahun,
                        abstrak_lengkap: 'Abstract not available — access restricted (paywall).',
                        link, source: 'Scopus', journal: journalName,
                        keyword, citationCount, isPaywalled: true,
                        isOpenAccess: entry['openaccess'] === '1' || entry['openaccessFlag'] === true,
                        _kwTier: scopusTier,
                        _relevanceScore: relevanceScore,
                        _citationTier: citationTier,
                        _isEnriched: false
                    });
                } else {
                    console.log(`⏭ Scopus low quality: ${judul.slice(0, 50)}`);
                }
            }
        }

        start += batchSize;
        if (start >= totalAvail || entries.length < batchSize) break;
        await delay(1200);  // Scopus rate limit safety margin
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

    const semanticYearTo = Math.min(yearTo, currentYear);
    console.log(` [Semantic Scholar] "${keyword}" (${yearFrom}-${semanticYearTo})  Target: ${TARGET}`);

    let useDateFilter = true;

    while (count < TARGET) {
        const dateFilter = useDateFilter && yearFrom && semanticYearTo
            ? `&publicationDateOrYear=${yearFrom}:${semanticYearTo}`
            : '';
        const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(keyword)}&fields=${fields}&limit=${batch}&offset=${offset}${dateFilter}`;

        console.log(` [Semantic] Requesting: ${url.substring(0, 100)}...`);

        let data;
        try {
            const headers = {};
            if (apiKey) headers['x-api-key'] = apiKey;
            data = await httpsGet(url, headers);
        } catch (err) {
            console.error(' [Semantic] Request error:', err.message);
            break;
        }

        // Debug: log response structure
        if (!data || typeof data !== 'object') {
            console.error(' [Semantic] Invalid response:', data);
            break;
        }

        const papers = data.data || [];
        const total = data.total || 0;

        console.log(` [Semantic] Got ${papers.length} papers (total available: ${total})`);

        if (!papers.length) {
            if (total === 0 && useDateFilter && offset === 0) {
                console.log(` [Semantic] No results with date filter (${yearFrom}-${semanticYearTo}). Retrying without date filter...`);
                useDateFilter = false;
                offset = 0;
                continue;
            } else if (total === 0) {
                console.log(' [Semantic] No results found for this query.');
            } else {
                console.log(` [Semantic] No more results at offset ${offset}.`);
            }
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
                        apiKey ? { 'x-api-key': apiKey } : {}
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

            // Calculate relevance score
            const relevanceScore = getRelevanceScore(keyword, paper.title, abstract || '');
            const citationTier = getCitationTier(citationCount, tahun);

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
                    _kwTier: semanticTier,
                    _relevanceScore: relevanceScore,
                    _citationTier: citationTier,
                    _isEnriched: true
                });
                count++;
                emitProgress(count, TARGET);
                console.log(`  ✓ Semantic: "${paper.title.slice(0, 45)}" (${relevanceScore}% relevance)`);
            } else {
                const qualifiesReserved = (citationCount >= 1 || parseInt(tahun) >= 2023)
                    && reservedCandidatesSemantic.length < MAX_RESERVED_SLOTS;

                if (qualifiesReserved) {
                    console.log(`  ○ Semantic (no abstract): "${paper.title.slice(0, 45)}" (${citationCount} citations)`);
                    reservedCandidatesSemantic.push({
                        isBook: false, judul: paper.title, author_info: authors, tahun,
                        abstrak_lengkap: 'Abstract not available — access restricted (paywall).',
                        link, source: 'Semantic Scholar',
                        keyword, journal: paper.journal?.name || paper.publicationVenue?.name || null,
                        citationCount, isPaywalled: true,
                        isOpenAccess: paper.isOpenAccess || !!paper.openAccessPdf?.url,
                        _kwTier: semanticTier,
                        _relevanceScore: relevanceScore,
                        _citationTier: citationTier,
                        _isEnriched: false
                    });
                } else {
                    console.log(` Semantic low quality: ${paper.title.slice(0, 50)}`);
                }
            }

            await delay(perPaperDelay);
        }

        offset += batch;

        const stalled = count === countBefore && papers.length < 5;
        if (offset >= total || stalled) break;

        await delay(800);  // Semantic Scholar rate limit safety margin
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
    // Let process exit naturally instead of process.exit(0) to allow pending writes to complete
}

main().then(() => {
    // stdout might have pending async writes, wait briefly to flush then force exit
    try { process.stdin.destroy(); } catch (_) {}
    setTimeout(() => { process.exit(0); }, 500);
}).catch(err => {
    console.error(' Fatal error:', err);
    process.exit(1);
});