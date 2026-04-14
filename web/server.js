const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const https = require('https');
const net = require('net');

let helmet, rateLimit, Resend;
try { helmet = require('helmet'); } catch (_) { helmet = null; }
try { rateLimit = require('express-rate-limit'); } catch (_) { rateLimit = null; }
try { Resend = require('resend').Resend; } catch (_) { Resend = null; }

const logger = require('./logger');
const { sendPremiumTokenEmail } = require('./src/services/email');

const app = express();
app.use(compression());    // Gzip all responses — saves ~60% bandwidth
const server = http.createServer(app);
const io = new Server(server);

// Inject security headers for Socket.IO static files (socket.io.js)
// Must use prependListener so it runs BEFORE Socket.IO handles the request
server.prependListener('request', (req, res) => {
    if (req.url && req.url.startsWith('/socket.io/')) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    }
});

const IS_PROD = process.env.NODE_ENV === 'production';

const PORT = parseInt(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/literature_assistant';
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
}
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// Email availability check (actual Resend instance is in src/services/email.js)
const isEmailConfigured = !!(Resend && RESEND_KEY);
if (!isEmailConfigured) logger.warn('Resend not configured — email features disabled');


const { getTodayWIB } = require('./src/utils/date');

const User = require('./src/models/User');
const Journal = require('./src/models/Journal');
const SavedJournal = require('./src/models/SavedJournal');

mongoose.connect(MONGO_URI)
    .then(() => logger.info('MongoDB connected', { uri: MONGO_URI }))
    .catch(err => { logger.error('MongoDB connection failed', { error: err.message }); process.exit(1); });

app.use((req, res, next) => {
    const allowed = ['http://localhost:9002', 'http://localhost:5173', 'http://127.0.0.1:9002'];
    const origin = req.headers.origin;
    if (allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Prevent service worker / browser from caching any API responses
app.use('/api/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

app.set('trust proxy', 1);

// ── Derive WebSocket origin from APP_URL ─────────────────────────────────────
// Converts https://xxxx.ngrok-free.app → wss://xxxx.ngrok-free.app
// Converts http://localhost:3000       → ws://localhost:3000
// Required so Socket.IO works through ngrok — browser blocks wss:// not in CSP whitelist
const appWsOrigin = APP_URL
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://');

const connectSrcOrigins = [
    "'self'",
    "ws://localhost:*", "wss://localhost:*",
    "ws://127.0.0.1:*", "wss://127.0.0.1:*",
];

// Only add external origin if not already covered by localhost wildcards
if (!appWsOrigin.includes('localhost') && !appWsOrigin.includes('127.0.0.1')) {
    connectSrcOrigins.push(appWsOrigin);
    logger.info('CSP connectSrc extended', { origin: appWsOrigin });
}

if (helmet) {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'"],
                styleSrc: ["'self'", "'unsafe-inline'",
                    "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "blob:"],
                connectSrc: connectSrcOrigins,
                frameSrc: ["'self'"],
                objectSrc: ["'none'"],
            }
        },
        crossOriginEmbedderPolicy: { policy: 'unsafe-none' },
        crossOriginOpenerPolicy: false,
    }));

    // Headers not covered by helmet
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=()');
        res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
        next();
    });

    // Fix: Cache headers for static assets
    app.use((req, res, next) => {
        const ext = req.path.split('.').pop().toLowerCase();
        // Long cache for immutable assets (CSS, JS, fonts, images)
        const immutableExts = ['css', 'js', 'png', 'jpg', 'jpeg', 'svg', 'ico', 'woff', 'woff2', 'gif', 'webp'];
        // Short cache for HTML (may change on redeploy)
        const htmlExts = ['html'];
        if (immutableExts.includes(ext) && !req.path.startsWith('/api/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (htmlExts.includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        }
        next();
    });

    logger.info('Helmet security headers enabled');
} else {
    logger.warn('helmet not installed — run: npm i helmet');
}

app.use(express.json({ limit: '2mb' }));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false, // cookies work over both HTTP and HTTPS (ngrok handles HTTPS termination)
        sameSite: 'lax'
    }
}));

if (rateLimit) {
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, max: 200,
        standardHeaders: true, legacyHeaders: false,
        message: { error: 'Too many requests. Please slow down.' }
    });
    app.use('/api/', apiLimiter);

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, max: 20,
        message: { error: 'Too many auth attempts. Try again later.' }
    });
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);

    const scrapeLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, max: 10,
        message: { error: 'Scrape rate limit reached. Max 10 scrapes per hour.' },
        skip: (req) => {
            // Skip rate limit for admin and premium users
            const role = req.session && req.session.role;
            return role === 'admin' || role === 'premium';
        }
    });
    app.use('/api/scrape', scrapeLimiter);

    logger.info('Rate limiters enabled');
} else {
    logger.warn('express-rate-limit not installed — run: npm i express-rate-limit');
}

// Fix: add missing security headers to Socket.IO served files
app.use('/socket.io', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
});

app.set('etag', false);
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'dist'), { etag: false }));
// NOTE: Do NOT serve __dirname as static — it exposes server.js, logger.js, etc.
app.use(express.static(path.join(__dirname, 'public'), { etag: false }));
app.use('/novnc', express.static('/usr/share/novnc', { etag: false }));

const { requireAuth, requireAdmin } = require('./src/middlewares/auth');

// API Routes
const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profile');
const dataRoutes = require('./src/routes/data');

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', dataRoutes);

async function fetchPageContent(url) {
    // Validasi URL - hanya izinkan http/https
    if (!url || url === 'null' || url === 'undefined') return null;

    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return null;
        }
    } catch {
        return null;
    }

    return new Promise((resolve) => {

        const scraper = spawn('node', ['-e', `
const puppeteer = require('puppeteer-extra');
const Stealth   = require('puppeteer-extra-plugin-stealth');
puppeteer.use(Stealth());
(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
            args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
            headless: 'new'
        });
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(20000);
        await page.setRequestInterception(true);
        page.on('request', r => {
            if (['image','stylesheet','font','media'].includes(r.resourceType())) r.abort();
            else r.continue();
        });
        await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 2000));
        const content = await page.evaluate(() => {
            const selectors = [
                '[class*="abstract"]','[id*="abstract"]','[class*="Abstract"]',
                'section.abstract','.hlFld-Abstract','.article-abstract',
                '#abstracts','.abstractSection','.abstract-content','.abstractInFull',
                '[data-abstract]','.paper-abstract',
                'meta[name="description"]','meta[property="og:description"]'
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const txt = el.innerText || el.getAttribute('content') || '';
                    if (txt.length > 150) return txt.trim().slice(0, 5000);
                }
            }
            const longPara = [...document.querySelectorAll('p')].find(p => p.innerText.length > 200);
            if (longPara) return longPara.innerText.trim().slice(0, 5000);
            return document.body?.innerText?.trim().slice(0, 5000) || '';
        });
        await browser.close();
        process.stdout.write(JSON.stringify({ content }));
    } catch(e) {
        if (browser) await browser.close().catch(() => {});
        process.stdout.write(JSON.stringify({ error: e.message }));
    }
})();
        `], { cwd: path.join(__dirname, '..', 'scraper') });

        let out = '';
        scraper.stdout.on('data', d => out += d.toString());
        scraper.on('close', () => {
            try { resolve(JSON.parse(out).content || null); } catch { resolve(null); }
        });
        setTimeout(() => { scraper.kill(); resolve(null); }, 25000);
    });
}

// ── Gemini error types (used by /api/summary for user-facing messages) ──────
const GEMINI_ERR = {
    QUOTA: 'gemini_quota',
    KEY: 'gemini_key',
    OVERLOAD: 'gemini_overload',
    TIMEOUT: 'gemini_timeout',
    UNKNOWN: 'gemini_unknown',
};

function callGemini(prompt, { retries = 2, timeoutMs = 30000 } = {}) {
    const attempt = (attemptsLeft) => new Promise((resolve, reject) => {
        const body = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        });

        let settled = false;
        const finish = (fn, val) => { if (!settled) { settled = true; clearTimeout(timer); fn(val); } };

        const timer = setTimeout(() => {
            const err = new Error('Gemini request timed out');
            err.geminiCode = GEMINI_ERR.TIMEOUT;
            finish(reject, err);
        }, timeoutMs);

        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);

                    // ── Classify API-level errors ────────────────────────
                    if (parsed.error) {
                        const status = parsed.error.status || '';
                        const code = parsed.error.code || res.statusCode;
                        const message = parsed.error.message || 'Gemini API error';
                        const err = new Error(message);

                        if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
                            err.geminiCode = GEMINI_ERR.QUOTA;
                        } else if (code === 400 || code === 403 || status === 'INVALID_ARGUMENT' || status === 'PERMISSION_DENIED') {
                            err.geminiCode = GEMINI_ERR.KEY;
                        } else if (code === 503 || status === 'UNAVAILABLE') {
                            err.geminiCode = GEMINI_ERR.OVERLOAD;
                        } else {
                            err.geminiCode = GEMINI_ERR.UNKNOWN;
                        }
                        return finish(reject, err);
                    }

                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (!text) {
                        const err = new Error('Empty response from Gemini');
                        err.geminiCode = GEMINI_ERR.UNKNOWN;
                        return finish(reject, err);
                    }
                    finish(resolve, text);
                } catch (e) { finish(reject, e); }
            });
        });

        req.on('error', (e) => { e.geminiCode = GEMINI_ERR.UNKNOWN; finish(reject, e); });
        req.write(body);
        req.end();

    }).catch(err => {
        // ── Retry only on transient errors ───────────────────────────────
        const isRetryable = err.geminiCode === GEMINI_ERR.OVERLOAD
            || err.geminiCode === GEMINI_ERR.TIMEOUT
            || err.geminiCode === GEMINI_ERR.UNKNOWN;

        if (attemptsLeft > 0 && isRetryable) {
            const delay = (retries - attemptsLeft + 1) * 1500; // 1.5s, 3s
            logger.warn('Gemini transient error, retrying...', {
                code: err.geminiCode,
                attemptsLeft,
                retryInMs: delay
            });
            return new Promise(r => setTimeout(r, delay)).then(() => attempt(attemptsLeft - 1));
        }
        throw err;
    });

    return attempt(retries);
}

app.post('/api/summary', requireAuth, async (req, res) => {
    if (!GEMINI_KEY)
        return res.status(503).json({ error: 'GEMINI_API_KEY not configured.' });


    const userRole = req.session.role || 'user';
    if (userRole !== 'premium' && userRole !== 'admin')
        return res.status(403).json({
            error: 'premiumRequired',
            message: 'Fitur AI Summary hanya tersedia untuk pengguna Premium.'
        });

    const { journalIds, language = 'id' } = req.body;
    if (!journalIds?.length)
        return res.status(400).json({ error: 'No journals selected.' });
    if (journalIds.length > 15)
        return res.status(400).json({ error: 'Maximum 15 journals per summary.' });

    const timeoutId = setTimeout(() => {
        if (!res.headersSent)
            res.status(504).json({ error: 'Summary generation timed out.' });
    }, 90000);

    const originalJson = res.json.bind(res);
    res.json = (body) => { clearTimeout(timeoutId); return originalJson(body); };

    try {
        const journals = await SavedJournal.find({
            _id: { $in: journalIds },
            userId: req.session.userId
        });

        if (!journals.length) return res.status(404).json({ error: 'Journals not found.' });

        const contents = [];
        for (const j of journals) {
            let content = j.abstrak_lengkap || '';
            const hasAbs = content && !content.toLowerCase().includes('not available') && content.length > 400;

            if (!hasAbs && j.link && j.link !== 'null') {
                const fetched = await fetchPageContent(j.link);
                if (fetched?.length > 80) content = fetched;
            }

            contents.push({
                judul: j.judul || 'Unknown Title',
                authors: j.author_info || 'Unknown Author',
                tahun: j.tahun || 'n.d.',
                content: content || '[No abstract available]'
            });
        }

        const journalList = contents.map((j, i) =>
            `[${i + 1}] "${j.judul}" — ${j.authors} (${j.tahun})\nContent: ${j.content}`
        ).join('\n\n---\n\n');

        const langInstruction = language === 'id'
            ? 'Tulis dalam Bahasa Indonesia dengan gaya akademik formal.'
            : 'Write in formal academic English.';

        const prompt = `You are an academic writing assistant helping a university student write their literature review (tinjauan pustaka).

Based on the following ${contents.length} academic papers, write a cohesive literature review paragraph (or 2-3 paragraphs if needed). 
- Use in-text citations in format: (Author, Year)
- Synthesize the findings, don't just summarize each paper separately
- Focus on connecting the papers thematically
- ${langInstruction}
- End with a brief synthesis sentence connecting all papers

PAPERS:
${journalList}

Write the literature review paragraph now:`;

        const summary = await callGemini(prompt);

        // ── Track usage ───────────────────────────────────────────────────
        await User.findByIdAndUpdate(req.session.userId, { $inc: { summaryCount: 1 } });
        logger.info('AI Summary generated', {
            userId: req.session.userId,
            journalCount: journals.length,
            language
        });

        res.json({ summary, journalCount: journals.length });

    } catch (err) {
        clearTimeout(timeoutId);

        // ── Map Gemini error codes to user-friendly messages ──────────────
        const geminiMessages = {
            [GEMINI_ERR.QUOTA]: { status: 503, error: 'geminiQuota', message: 'Layanan AI sedang kelebihan beban (quota habis). Coba lagi dalam beberapa menit.' },
            [GEMINI_ERR.KEY]: { status: 503, error: 'geminiKey', message: 'Konfigurasi AI bermasalah. Hubungi admin.' },
            [GEMINI_ERR.OVERLOAD]: { status: 503, error: 'geminiOverload', message: 'Server AI sedang sibuk. Coba lagi dalam 1-2 menit.' },
            [GEMINI_ERR.TIMEOUT]: { status: 504, error: 'geminiTimeout', message: 'AI terlalu lama merespons. Coba lagi atau kurangi jumlah jurnal.' },
        };

        const mapped = geminiMessages[err.geminiCode];
        logger.error('Summary generation error', { error: err.message, geminiCode: err.geminiCode });

        if (!res.headersSent) {
            if (mapped) {
                res.status(mapped.status).json({ error: mapped.error, message: mapped.message });
            } else {
                res.status(500).json({ error: 'summaryFailed', message: 'Gagal generate summary. Coba lagi.' });
            }
        }
    }
});

const jobQueue = [];
const activeJobs = {};
const jobProgress = {}; // tracks last progress per jobId for reconnecting sockets
let isRunning = false;
const userJobSet = new Set();

function processQueue() {
    if (isRunning || jobQueue.length === 0) return;
    isRunning = true;
    const nextJob = jobQueue.shift();

    // Notify remaining queued jobs of their new position
    jobQueue.forEach((job, idx) => {
        io.to(job.jobId).emit('scrape-status', {
            status: 'queued',
            jobId: job.jobId,
            queuePosition: idx + 1
        });
    });

    // Notify the job that's about to start
    io.to(nextJob.jobId).emit('scrape-status', { status: 'starting', jobId: nextJob.jobId });

    runScraper(nextJob);
}

function cleanupJobFiles(jobId) {
    const dataDir = path.join(__dirname, '../data');
    const files = [
        path.join(dataDir, `jurnal_mentah_${jobId}.json`),
        path.join(dataDir, `jurnal_bersih_${jobId}.json`),
        path.join(dataDir, `jurnal_siap_skripsi_${jobId}.xlsx`),
    ];
    for (const f of files) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) { }
    }
}

function runScraper({ jobId, keyword, clearData, source, apiKey, userId, yearFrom, yearTo, target }) {
    const scraperPath = path.join(__dirname, '../scraper');

    const ALLOWED_SOURCES = ['SCHOLAR', 'SEMANTIC', 'SCOPUS'];
    const normalizedSource = source?.toUpperCase();
    if (!ALLOWED_SOURCES.includes(normalizedSource)) {
        logger.job(jobId).error('Invalid source rejected', { source });
        io.to(jobId).emit('scrape-error', 'Sumber tidak valid. Gunakan: scholar, semantic, atau scopus');
        isRunning = false;
        userJobSet.delete(userId?.toString());
        return;
    }

    const sanitizedKeyword = keyword?.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    if (!sanitizedKeyword || sanitizedKeyword.length === 0) {
        logger.job(jobId).error('Invalid keyword rejected', { keyword });
        io.to(jobId).emit('scrape-error', 'Keyword tidak valid');
        isRunning = false;
        userJobSet.delete(userId?.toString());
        return;
    }

    const sanitizedYearFrom = /^\d{4}$/.test(String(yearFrom)) ? String(yearFrom) : '';
    const sanitizedYearTo = /^\d{4}$/.test(String(yearTo)) ? String(yearTo) : '';
    const totalTargetReq = /^\d+$/.test(String(target)) && parseInt(target) > 0 && parseInt(target) <= 1000
        ? parseInt(target)
        : 10;
        
    // Divide target evenly: ~50% for main scraper (e.g. Scholar), ~50% for OpenAlex
    const mainTargetNum = Math.ceil(totalTargetReq / 2);
    const openalexTargetNum = totalTargetReq - mainTargetNum;
    
    const sanitizedTarget = String(mainTargetNum);
    const sanitizedApiKey = apiKey ? apiKey.replace(/[^a-zA-Z0-9\-_]/g, '') : '';

    logger.job(jobId).info('Scrape job started', {
        keyword: sanitizedKeyword,
        source: normalizedSource,
        yearFrom: sanitizedYearFrom,
        yearTo: sanitizedYearTo
    });

    io.to(jobId).emit('scrape-status', { status: 'running', jobId });

    const scraperProcess = spawn(
        'node',
        [
            'index.js',
            '--',
            sanitizedKeyword,
            clearData ? 'y' : 'n',
            normalizedSource.toLowerCase(),
            sanitizedApiKey,
            sanitizedYearFrom,
            sanitizedYearTo,
            sanitizedTarget,
            jobId
        ],
        { cwd: scraperPath, env: { ...process.env, DISPLAY: ':99' } }
    );

    activeJobs[jobId] = { scraperProcess, userId };

    let mainCurrent = 0;
    let stdoutBuf = '';
    scraperProcess.stdout.on('data', (data) => {
        stdoutBuf += data.toString();
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop();
        for (const line of lines) {
            if (line.startsWith('CAPTCHA_URL:')) {
                const captchaUrl = line.slice(12).trim();
                logger.job(jobId).warn('CAPTCHA detected');
                io.to(jobId).emit('captcha-url', captchaUrl);
            } else if (line.includes('PROGRESS:')) {
                const match = line.match(/PROGRESS:(\d+)\/(\d+)/);
                if (match) {
                    mainCurrent = parseInt(match[1]);
                    const progressData = { current: parseInt(match[1]), total: parseInt(match[2]) };
                    jobProgress[jobId] = progressData;
                    io.to(jobId).emit('scrape-progress', progressData);
                }
            } else if (line.trim()) {
                logger.job(jobId).info('Bot output', { line: line.trim() });
            }
        }
    });

    scraperProcess.stderr.on('data', d => logger.job(jobId).warn('Scraper stderr', { output: d.toString().trim() }));

    scraperProcess.on('error', (err) => {
        logger.job(jobId).error('Scraper spawn error', { error: err.message });
        if (activeJobs[jobId]) {
            try { activeJobs[jobId].scraperProcess.stdin.end(); } catch (_) { }
            delete activeJobs[jobId];
        }
        userJobSet.delete(userId.toString());
        isRunning = false;
        io.to(jobId).emit('scrape-error', `Failed to start scraper: ${err.message}`);
        cleanupJobFiles(jobId);
        processQueue();
    });

    scraperProcess.on('close', async (code) => {
        if (activeJobs[jobId]) {
            try { activeJobs[jobId].scraperProcess.stdin.end(); } catch (_) { }
            delete activeJobs[jobId];
        }
        isRunning = false;
        delete jobProgress[jobId]; // cleanup progress store

        if (code !== 0) {
            userJobSet.delete(userId.toString());
            io.to(jobId).emit('scrape-error', `Scraper error (code ${code}). Cek CAPTCHA atau API key.`);
            cleanupJobFiles(jobId);
            processQueue();
            return;
        }

        logger.job(jobId).info('Scraper done, running OpenAlex in parallel');

        const pythonPath = path.join(__dirname, '../processor');
        const totalTarget = totalTargetReq;
        const openalexTarget = openalexTargetNum; // OpenAlex gets the remaining half

        // Combined progress tracking
        let openalexCurrent = 0;
        const emitProgress = () => {
            const combined = mainCurrent + openalexCurrent;
            const prog = { current: Math.min(combined, totalTarget), total: totalTarget };
            jobProgress[jobId] = prog;
            io.to(jobId).emit('scrape-progress', prog);
        };

        const runPython = () => {
            logger.job(jobId).info('OpenAlex done, running Python processor');

            const pyArgs = ['main.py', sanitizedKeyword, sanitizedYearFrom, sanitizedYearTo, jobId];
            const pyProcess = spawn('python3', pyArgs, {
                cwd: pythonPath,
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });

            let pyStdout = '', pyStderr = '';
            pyProcess.stdout.on('data', d => { pyStdout += d.toString(); });
            pyProcess.stderr.on('data', d => { pyStderr += d.toString(); });

            pyProcess.on('close', async (pyCode) => {
                if (pyCode !== 0) {
                    logger.job(jobId).error('Python processor failed', { stderr: pyStderr.trim() });
                    io.to(jobId).emit('scrape-error', `Python processing failed.`);
                    userJobSet.delete(userId.toString());
                    cleanupJobFiles(jobId);
                    processQueue();
                    return;
                }

                logger.job(jobId).info('Python processor done', { output: pyStdout.trim() });

                const jsonPath = path.join(__dirname, `../data/jurnal_bersih_${jobId}.json`);
                try {
                    if (!fs.existsSync(jsonPath))
                        throw new Error(`jurnal_bersih_${jobId}.json not found`);

                    const raw = fs.readFileSync(jsonPath, 'utf-8');
                    let records = JSON.parse(raw);

                    if (records.length === 0) {
                        io.to(jobId).emit('scrape-error', 'No results found for this keyword.');
                        userJobSet.delete(userId.toString());
                        cleanupJobFiles(jobId);
                        processQueue();
                        return;
                    }

                    const user = await User.findById(userId);
                    const isPremium = user && (user.role === 'premium' || user.role === 'admin');

                    if (!isPremium && user) {
                        records = records.slice(0, user.dailyLimit);
                        const todayWIB = getTodayWIB();
                        if (user.lastScrapeDate !== todayWIB) {
                            user.dailyScrapedToday = 0;
                        }
                        user.quotaUsed += records.length;
                        user.dailyScrapedToday += records.length;
                        user.lastScrapeDate = todayWIB;
                        await user.save();
                    }

                    if (clearData) await Journal.deleteMany({ userId });

                    const docs = records.map(r => ({
                        ...r,
                        userId,
                        keyword: r.keyword || keyword,
                        isBook: !!r.isBook
                    }));

                    await Journal.insertMany(docs);
                    logger.job(jobId).info('Journals saved to MongoDB', { count: docs.length });
                    io.to(jobId).emit('scrape-done', { count: docs.length });
                } catch (dbErr) {
                    logger.job(jobId).error('DB save error', { error: dbErr.message });
                    io.to(jobId).emit('scrape-error', `Failed to save: ${dbErr.message}`);
                } finally {
                    userJobSet.delete(userId.toString());
                    cleanupJobFiles(jobId);
                    processQueue();
                }
            });
        };

        // OpenAlex — track progress via stdout
        let openalexBuf = '';
        const openalexProcess = spawn('python3', ['openalex_scraper.py', sanitizedKeyword, sanitizedYearFrom, sanitizedYearTo, jobId, String(openalexTarget)], {
            cwd: pythonPath,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });
        openalexProcess.stdout.on('data', (data) => {
            openalexBuf += data.toString();
            const lines = openalexBuf.split('\n');
            openalexBuf = lines.pop();
            for (const line of lines) {
                if (line.startsWith('OPENALEX_PROGRESS:')) {
                    const match = line.match(/OPENALEX_PROGRESS:(\d+)\/(\d+)/);
                    if (match) {
                        openalexCurrent = parseInt(match[1]);
                        emitProgress();
                    }
                }
            }
        });
        openalexProcess.stderr.on('data', d => logger.job(jobId).warn('OpenAlex stderr', { output: d.toString().trim() }));
        openalexProcess.on('close', () => {
            runPython();
        });
    });
}

app.post('/api/scrape', requireAuth, async (req, res) => {
    const {
        keyword,
        clearData,
        source = 'scholar',
        apiKey = '',
        yearFrom = 2020,
        yearTo = new Date().getFullYear(),
        target = 10
    } = req.body;


    if (!keyword || typeof keyword !== 'string')
        return res.status(400).json({ error: 'Keyword is required.' });
    if (keyword.trim().length > 200)
        return res.status(400).json({ error: 'Keyword too long (max 200 chars).' });
    if (!['scholar', 'scopus', 'semantic'].includes(source))
        return res.status(400).json({ error: 'Invalid source.' });
    if (source === 'scopus' && !apiKey)
        return res.status(400).json({ error: 'Scopus requires an API key.' });

    const yFrom = parseInt(yearFrom);
    const yTo = parseInt(yearTo);
    if (isNaN(yFrom) || isNaN(yTo) || yFrom > yTo || yFrom < 1900 || yTo > new Date().getFullYear() + 1)
        return res.status(400).json({ error: 'Invalid year range.' });

    const tgt = Math.min(Math.max(parseInt(target) || 10, 1), 50);


    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    const isPremium = user.role === 'premium' || user.role === 'admin';

    if (!isPremium) {

        if (user.quotaUsed >= user.quotaLimit) {
            return res.status(403).json({
                error: 'quotaExhausted',
                message: `Quota kamu sudah habis (${user.quotaUsed}/${user.quotaLimit}). Upgrade ke Premium untuk scraping unlimited.`
            });
        }


        const todayWIB = getTodayWIB();
        const dailyUsed = user.lastScrapeDate === todayWIB ? user.dailyScrapedToday : 0;

        if (dailyUsed >= user.dailyLimit) {
            return res.status(403).json({
                error: 'dailyLimitReached',
                message: `Limit harian kamu sudah tercapai (${user.dailyLimit} jurnal/hari). Coba lagi besok jam 00:00 WIB.`
            });
        }
    }


    const uid = req.session.userId.toString();
    if (userJobSet.has(uid))
        return res.status(429).json({ error: 'You already have an active scrape job. Please wait for it to finish.' });

    const jobId = crypto.randomBytes(6).toString('hex');
    const queuePosition = jobQueue.length + (isRunning ? 1 : 0);

    userJobSet.add(uid);
    jobQueue.push({ jobId, keyword: keyword.trim(), clearData, source, apiKey, userId: req.session.userId, yearFrom: yFrom, yearTo: yTo, target: tgt });
    res.json({ status: 'queued', jobId, queuePosition });

    processQueue();
});

// ── GET /api/scrape/my-active-job ────────────────────────────────────────────
// Lets the client restore UI state after a page reload mid-scrape.
// Returns the active/queued jobId for the current user, or null if none.
app.get('/api/scrape/my-active-job', requireAuth, (req, res) => {
    const uid = req.session.userId.toString();

    // Check running jobs
    for (const [jobId, job] of Object.entries(activeJobs)) {
        if (job.userId.toString() === uid) {
            return res.json({
                jobId,
                status: 'running',
                progress: jobProgress[jobId] || null
            });
        }
    }

    // Check queued jobs
    const queuedIdx = jobQueue.findIndex(j => j.userId.toString() === uid);
    if (queuedIdx !== -1) {
        return res.json({
            jobId: jobQueue[queuedIdx].jobId,
            status: 'queued',
            queuePosition: queuedIdx + 1,
            progress: null
        });
    }

    res.json({ jobId: null, status: null });
});

app.post('/api/scrape/:jobId/cancel', requireAuth, (req, res) => {
    const { jobId } = req.params;
    const job = activeJobs[jobId];
    if (!job) return res.status(404).json({ error: 'Job not found or already finished.' });

    if (job.userId.toString() !== req.session.userId.toString())
        return res.status(403).json({ error: 'Not your job.' });

    try { job.scraperProcess.kill('SIGTERM'); } catch (_) { }
    delete activeJobs[jobId];
    userJobSet.delete(req.session.userId.toString());
    cleanupJobFiles(jobId);
    res.json({ success: true, message: 'Job cancelled.' });
});

io.on('connection', (socket) => {
    logger.debug('Socket connected', { socketId: socket.id });

    socket.on('join-job', (jobId) => {
        socket.join(jobId);
        logger.debug('Socket joined job room', { socketId: socket.id, jobId });

        // Immediately send last known progress so reconnecting clients catch up
        if (jobProgress[jobId]) {
            socket.emit('scrape-progress', jobProgress[jobId]);
        }
        // Tell client if job is still active or already queued
        if (activeJobs[jobId]) {
            socket.emit('scrape-status', { status: 'running', jobId });
        } else {
            const queuedIdx = jobQueue.findIndex(j => j.jobId === jobId);
            if (queuedIdx !== -1) {
                socket.emit('scrape-status', { status: 'queued', jobId, queuePosition: queuedIdx + 1 });
            }
        }
    });

    socket.on('captcha-resume', ({ jobId }) => {
        const job = activeJobs[jobId];
        if (job?.scraperProcess) {
            job.scraperProcess.stdin.write('resume\n');
            io.to(jobId).emit('captcha-resolved');
            logger.job(jobId).info('CAPTCHA resume signal sent');
        }
    });

    socket.on('disconnect', () => {
        logger.debug('Socket disconnected', { socketId: socket.id });
    });
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find({}, { passwordHash: 0, emailVerifyToken: 0 }).sort({ createdAt: -1 }).lean();
        const counts = await Journal.aggregate([{ $group: { _id: '$userId', count: { $sum: 1 } } }]);
        const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));
        res.json(users.map(u => ({
            ...u,
            premiumToken: undefined,
            hasActiveToken: !!(u.premiumToken && u.premiumTokenExpiry > new Date()),
            journalCount: countMap[u._id.toString()] || 0
        })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ error: 'Invalid user ID.' });
        if (id === req.session.userId.toString())
            return res.status(400).json({ error: 'Cannot delete your own account.' });

        await Journal.deleteMany({ userId: id });
        await SavedJournal.deleteMany({ userId: id });
        await User.findByIdAndDelete(id);

        try {
            const store = req.sessionStore;
            if (store && typeof store.all === 'function') {
                store.all((err, sessions) => {
                    if (err || !sessions) return;
                    const list = Array.isArray(sessions) ? sessions : Object.values(sessions);
                    for (const sess of list) {
                        const uid = sess?.session?.userId || sess?.userId;
                        if (uid && uid.toString() === id)
                            store.destroy(sess._id || sess.id, () => { });
                    }
                });
            }
        } catch (_) { }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

app.patch('/api/admin/users/:id/verify', requireAdmin, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, {
            isEmailVerified: true,
            emailVerifyToken: null,
            emailVerifyExpiry: null
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to verify user.' });
    }
});

app.patch('/api/admin/users/:id/promote', requireAdmin, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { role: 'admin' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to promote user.' });
    }
});

app.post('/api/admin/users/:id/generate-token', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (user.role === 'admin')
            return res.status(400).json({ error: 'Cannot generate token for admin accounts.' });


        const rawToken = crypto.randomBytes(9).toString('base64url').toUpperCase().slice(0, 12);
        const token = `${rawToken.slice(0, 4)}-${rawToken.slice(4, 8)}-${rawToken.slice(8, 12)}`;
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        user.premiumToken = token;
        user.premiumTokenExpiry = expiry;
        await user.save();

        const emailResult = await sendPremiumTokenEmail(user.email, user.username, token);

        res.json({
            success: true,
            token,
            emailSent: !emailResult.error,
            emailError: emailResult.error || null,
            message: emailResult.error
                ? `Token generated (${token}) tapi email gagal dikirim: ${emailResult.error}`
                : `Token berhasil di-generate dan dikirim ke ${user.email}.`
        });
    } catch (err) {
        logger.error('Generate token error', { error: err.message });
        res.status(500).json({ error: 'Failed to generate token.' });
    }
});

app.get('/api/admin/journals', requireAdmin, async (req, res) => {
    try {
        const journals = await Journal.find({}).sort({ createdAt: -1 }).limit(200).lean();
        const userIds = [...new Set(journals.map(j => j.userId.toString()))];
        const users = await User.find({ _id: { $in: userIds } }, { username: 1 }).lean();
        const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.username]));
        res.json(journals.map(j => ({ ...j, username: userMap[j.userId.toString()] || 'Unknown' })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch journals.' });
    }
});

app.delete('/api/admin/journals/all', requireAdmin, async (req, res) => {
    try {
        const result = await Journal.deleteMany({});
        res.json({ success: true, deleted: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete all journals.' });
    }
});

app.delete('/api/admin/journals/:id', requireAdmin, async (req, res) => {
    try {
        await Journal.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete journal.' });
    }
});

app.get('/health', async (req, res) => {
    const dbState = mongoose.connection.readyState;
    res.status(dbState === 1 ? 200 : 503).json({
        status: dbState === 1 ? 'ok' : 'degraded',
        db: dbState === 1 ? 'connected' : 'disconnected',
        uptime: Math.floor(process.uptime()),
        queue: jobQueue.length,
        activeJob: isRunning,
        timestamp: new Date().toISOString()
    });
});

// Fallback for SPA routing: serve dist/index.html for any unknown GET requests
app.use((req, res, next) => {
    // Only handle GET and avoid API/Socket routes
    if (req.method !== 'GET' || req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/socket.io')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// noVNC WebSocket proxy: /novnc-ws → websockify:6080 → x11vnc:5900
server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/novnc-ws')) return;
    const target = net.createConnection(6080, '127.0.0.1', () => {
        target.write(
            `GET ${req.url} HTTP/1.1\r\nHost: localhost:6080\r\n` +
            Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
            '\r\n\r\n'
        );
    });
    socket.pipe(target);
    target.pipe(socket);
    socket.on('error', () => target.destroy());
    target.on('error', () => socket.destroy());
});

// Export app for supertest (tests import this without starting the server)
if (require.main === module || process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        logger.info('Server started', {
            url: `http://localhost:${PORT}`,
            mode: IS_PROD ? 'production' : 'development',
            mongo: MONGO_URI,
            email: isEmailConfigured ? 'enabled' : 'disabled',
        });
    });
} // end: not test mode

module.exports = app;
module.exports.server = server; // expose for test teardown

function gracefulShutdown(signal) {
    logger.info('Shutdown signal received', { signal });
    for (const [jobId, job] of Object.entries(activeJobs)) {
        try {
            job.scraperProcess.kill('SIGTERM');
            cleanupJobFiles(jobId);
            logger.info('Killed active job on shutdown', { jobId });
        } catch (_) { }
    }
    server.close(async () => {
        try { await mongoose.connection.close(); logger.info('Shutdown complete'); } catch (_) { }
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));