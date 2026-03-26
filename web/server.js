const express      = require('express');
const compression  = require('compression');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const fs         = require('fs');
const { spawn }  = require('child_process');
const crypto     = require('crypto');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const https      = require('https');
const net        = require('net');

let helmet, rateLimit, Resend;
try { helmet    = require('helmet');             } catch (_) { helmet    = null; }
try { rateLimit = require('express-rate-limit'); } catch (_) { rateLimit = null; }
try { Resend    = require('resend').Resend;      } catch (_) { Resend    = null; }

const logger = require('./logger');

const app    = express();
app.use(compression());    // Gzip all responses — saves ~60% bandwidth
const server = http.createServer(app);
const io     = new Server(server);

// Inject security headers for Socket.IO static files (socket.io.js)
// Must use prependListener so it runs BEFORE Socket.IO handles the request
server.prependListener('request', (req, res) => {
    if (req.url && req.url.startsWith('/socket.io/')) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    }
});

const IS_PROD = process.env.NODE_ENV === 'production';

const PORT           = parseInt(process.env.PORT) || 3000;
const MONGO_URI      = process.env.MONGO_URI || 'mongodb://localhost:27017/literature_assistant';
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}
const GEMINI_KEY     = process.env.GEMINI_API_KEY || '';
const RESEND_KEY     = process.env.RESEND_API_KEY || '';
const APP_URL        = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const resend = (Resend && RESEND_KEY) ? new Resend(RESEND_KEY) : null;
if (!resend) logger.warn('Resend not configured — email features disabled');

async function sendVerificationEmail(to, username, token) {
    if (!resend) return { error: 'Email not configured' };
    const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
    try {
        await resend.emails.send({
            from:    'LitAssist <onboarding@resend.dev>',
            to,
            subject: '[LitAssist] Verifikasi Email Kamu',
            html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;">
  <h2 style="color:#4f46e5;margin-bottom:8px;">LitAssist</h2>
  <p style="color:#374151;">Halo <strong>${username}</strong>,</p>
  <p style="color:#374151;">Terima kasih sudah daftar! Klik tombol di bawah untuk verifikasi email kamu.</p>
  <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
    Verifikasi Email
  </a>
  <p style="color:#9ca3af;font-size:13px;">Link ini berlaku selama 24 jam. Kalau bukan kamu yang daftar, abaikan email ini.</p>
</div>`
        });
        return { ok: true };
    } catch (err) {
        logger.error('sendVerificationEmail failed', { error: err.message });
        return { error: err.message };
    }
}

async function sendPremiumTokenEmail(to, username, token) {
    if (!resend) return { error: 'Email not configured' };
    try {
        await resend.emails.send({
            from:    'LitAssist <onboarding@resend.dev>',
            to,
            subject: '[LitAssist] Token Aktivasi Premium Kamu',
            html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;">
  <h2 style="color:#4f46e5;margin-bottom:8px;">LitAssist Premium</h2>
  <p style="color:#374151;">Halo <strong>${username}</strong>,</p>
  <p style="color:#374151;">Pembayaranmu sudah dikonfirmasi. Berikut token aktivasi Premium kamu:</p>
  <div style="margin:20px 0;padding:16px 20px;background:#f5f3ff;border-radius:10px;text-align:center;">
    <code style="font-size:22px;font-weight:700;letter-spacing:4px;color:#4f46e5;">${token}</code>
  </div>
  <p style="color:#374151;font-size:14px;">Cara aktivasi:</p>
  <ol style="color:#374151;font-size:14px;padding-left:18px;">
    <li>Login ke LitAssist</li>
    <li>Buka halaman <strong>Profile</strong></li>
    <li>Masukkan token di section <strong>Aktivasi Premium</strong></li>
    <li>Klik <strong>Aktifkan</strong></li>
  </ol>
  <p style="color:#9ca3af;font-size:13px;margin-top:16px;">Token berlaku 7 hari. Jangan bagikan token ini ke siapapun.</p>
</div>`
        });
        return { ok: true };
    } catch (err) {
        logger.error('sendPremiumTokenEmail failed', { error: err.message });
        return { error: err.message };
    }
}

function getTodayWIB() {
    
    return new Date(Date.now() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
}

const userSchema = new mongoose.Schema({
    username:     { type: String, required: true, unique: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['user', 'premium', 'admin'], default: 'user' },

    
    isEmailVerified:   { type: Boolean, default: false },
    emailVerifyToken:  { type: String,  default: null },
    emailVerifyExpiry: { type: Date,    default: null },

    
    quotaUsed:         { type: Number, default: 0 },   
    quotaLimit:        { type: Number, default: 10 },  
    dailyScrapedToday: { type: Number, default: 0 },   
    dailyLimit:        { type: Number, default: 2 },
    lastScrapeDate:    { type: String, default: '' },  

    
    premiumToken:       { type: String, default: null },
    premiumTokenExpiry: { type: Date,   default: null },

    summaryCount:      { type: Number, default: 0 },  // lifetime AI Summary usage
    createdAt: { type: Date, default: Date.now }
});

const journalSchema = new mongoose.Schema({
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    keyword:         { type: String, index: true },
    source:          { type: String, default: 'Unknown' },
    judul:           String,
    author_info:     String,
    tahun:           String,
    abstrak_lengkap: String,
    Kategori:        String,
    Relevansi:       Number,
    link:            String,
    isBook:          { type: Boolean, default: false },
    journal:         String,
    citationCount:   { type: Number, default: 0 },
    isOpenAccess:    { type: Boolean, default: false },
    isDuplicateSuspect: String,
    duplicateOf:     String,
    Akses:           String,
    createdAt:       { type: Date, default: Date.now }
});

journalSchema.index({ userId: 1, createdAt: -1 });
journalSchema.index({ userId: 1, Relevansi: -1 });
journalSchema.index({ userId: 1, source: 1 });

const savedJournalSchema = new mongoose.Schema({
    userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    judul:               String,
    author_info:         String,
    tahun:               String,
    abstrak_lengkap:     String,
    Kategori:            String,
    Relevansi:           Number,
    citationCount:       { type: Number, default: 0 },
    Akses:               String,
    link:                String,
    source:              String,
    isBook:              { type: Boolean, default: false },
    keyword:             String,
    journal:             String,
    isDuplicateSuspect:  String,
    note:                { type: String, default: '' },
    savedAt:             { type: Date, default: Date.now }
});

savedJournalSchema.index({ userId: 1, savedAt: -1 });
savedJournalSchema.index({ userId: 1, judul: 1 });

const User         = mongoose.model('User',         userSchema);
const Journal      = mongoose.model('Journal',      journalSchema);
const SavedJournal = mongoose.model('SavedJournal', savedJournalSchema);

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
                defaultSrc:  ["'self'"],
                scriptSrc:   ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'"],
                styleSrc:    ["'self'", "'unsafe-inline'",
                              "https://fonts.googleapis.com"],
                fontSrc:     ["'self'", "data:", "https://fonts.gstatic.com"],
                imgSrc:      ["'self'", "data:", "blob:"],
                connectSrc:  connectSrcOrigins,
                frameSrc:    ["'self'"],
                objectSrc:   ["'none'"],
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
        maxAge:   7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure:   false, // cookies work over both HTTP and HTTPS (ngrok handles HTTPS termination)
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
    app.use('/api/auth/login',    authLimiter);
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
app.use(express.static(path.join(__dirname, 'dist'),     { etag: false }));
app.use(express.static(__dirname,                        { etag: false }));
app.use(express.static(path.join(__dirname, 'public'),   { etag: false }));
app.use('/novnc', express.static('/usr/share/novnc',     { etag: false }));

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized. Please login.' });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.userId)          return res.status(401).json({ error: 'Unauthorized.' });
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admins only.' });
    next();
}

app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
        return res.status(400).json({ error: 'All fields are required.' });
    if (username.length < 3 || username.length > 30)
        return res.status(400).json({ error: 'Username must be 3–30 characters.' });
    if (password.length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    try {
        const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
        if (existing) {
            const field = existing.email === email.toLowerCase() ? 'Email' : 'Username';
            return res.status(409).json({ error: `${field} already in use.` });
        }

        const passwordHash  = await bcrypt.hash(password, 12);
        const userCount     = await User.countDocuments();
        const role          = userCount === 0 ? 'admin' : 'user';

        
        const isEmailVerified  = role === 'admin';
        const emailVerifyToken = role === 'admin' ? null : crypto.randomBytes(32).toString('hex');
        const emailVerifyExpiry = role === 'admin' ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await User.create({
            username, email, passwordHash, role,
            isEmailVerified, emailVerifyToken, emailVerifyExpiry
        });

        
        if (!isEmailVerified) {
            sendVerificationEmail(email, username, emailVerifyToken)
                .then(r => {
                    if (r.error) logger.error('Verification email send failed', { error: r.error });
                    else logger.info('Verification email sent', { email });
                })
                .catch(err => logger.error('Email exception', { error: err.message }));
        }

        if (isEmailVerified) {
            req.session.userId   = user._id;
            req.session.username = user.username;
            req.session.role     = user.role;
            return req.session.save(err => {
                if (err) return res.status(500).json({ error: 'Session save failed.' });
                res.json({ success: true, username: user.username, role: user.role, verified: true });
            });
        }

        res.json({
            success: true,
            verified: false,
            requiresVerification: true,
            message: 'Account created! Check your email to verify before logging in.'
        });
    } catch (err) {
        logger.error('Register error', { error: err.message, stack: err.stack });
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

app.get('/api/auth/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect('/?error=invalid_token');

    try {
        const user = await User.findOne({
            emailVerifyToken: token,
            emailVerifyExpiry: { $gt: new Date() }
        });

        if (!user) return res.redirect('/?error=token_expired');

        user.isEmailVerified   = true;
        user.emailVerifyToken  = null;
        user.emailVerifyExpiry = null;
        await user.save();

        
        req.session.userId   = user._id;
        req.session.username = user.username;
        req.session.role     = user.role;

        req.session.save(err => {
            if (err) return res.redirect('/?error=session_error');
            res.redirect('/index.html?verified=1');
        });
    } catch (err) {
        logger.error('Verify email error', { error: err.message });
        res.redirect('/?error=server_error');
    }
});

app.post('/api/auth/resend-verify', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user)             return res.status(404).json({ error: 'Email not found.' });
        if (user.isEmailVerified) return res.json({ success: true, message: 'Akun sudah terverifikasi.' });

        const token  = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.emailVerifyToken  = token;
        user.emailVerifyExpiry = expiry;
        await user.save();

        await sendVerificationEmail(user.email, user.username, token);
        res.json({ success: true, message: 'Email verifikasi sudah dikirim ulang.' });
    } catch (err) {
        logger.error('Resend verify error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)  return res.status(401).json({ error: 'Invalid email or password.' });

        // Admin/premium bypass email verification
        const isPrivileged = user.role === 'admin' || user.role === 'premium';
        if (!user.isEmailVerified && !isPrivileged) {
            return res.status(403).json({
                error:       'Email belum diverifikasi.',
                notVerified: true,
                message:     'Cek inbox atau spam kamu, lalu klik link verifikasi. Atau minta kirim ulang.'
            });
        }
        // Auto-verify privileged accounts that slipped through
        if (isPrivileged && !user.isEmailVerified) {
            user.isEmailVerified = true;
            await user.save();
        }

        req.session.userId   = user._id;
        req.session.username = user.username;
        req.session.role     = user.role;

        const isPremium = user.role === 'premium' || user.role === 'admin';
        const todayWIB  = getTodayWIB ? getTodayWIB() : new Date().toISOString().slice(0,10);

        req.session.save(err => {
            if (err) {
                logger.error('Session save error', { error: err.message });
                return res.status(500).json({ error: 'Session save failed.' });
            }
            // Return all profile data inline — avoids race condition on client
            res.json({
                success:           true,
                username:          user.username,
                role:              user.role,
                isPremium,
                quotaUsed:         user.quotaUsed         || 0,
                quotaLimit:        user.quotaLimit         || 10,
                quotaRemaining:    Math.max(0, (user.quotaLimit || 10) - (user.quotaUsed || 0)),
                quotaExhausted:    !isPremium && (user.quotaUsed || 0) >= (user.quotaLimit || 10),
                dailyScrapedToday: user.lastScrapeDate === todayWIB ? (user.dailyScrapedToday || 0) : 0,
                dailyLimit:        user.dailyLimit         || 2,
            });
        });
    } catch (err) {
        logger.error('Login error', { error: err.message });
        res.status(500).json({ error: 'Server error during login.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Logout failed.' });
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) return res.json({ loggedIn: false });
    try {
        const user = await User.findById(req.session.userId).lean();
        if (!user) { req.session.destroy(() => {}); return res.json({ loggedIn: false }); }
        res.json({ loggedIn: true, username: req.session.username, role: req.session.role || 'user' });
    } catch { res.json({ loggedIn: false }); }
});

app.get('/api/profile', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId, { passwordHash: 0, emailVerifyToken: 0, premiumToken: 0 }).lean();
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const todayWIB = getTodayWIB();
        const isPremium = user.role === 'premium' || user.role === 'admin';

        res.json({
            username:          user.username,
            email:             user.email,
            role:              user.role,
            isEmailVerified:   user.isEmailVerified,
            createdAt:         user.createdAt,

            
            quotaUsed:         user.quotaUsed,
            quotaLimit:        user.quotaLimit,
            quotaRemaining:    Math.max(0, user.quotaLimit - user.quotaUsed),
            quotaExhausted:    !isPremium && user.quotaUsed >= user.quotaLimit,

            
            dailyScrapedToday: user.lastScrapeDate === todayWIB ? user.dailyScrapedToday : 0,
            dailyLimit:        user.dailyLimit,

            isPremium,
            summaryCount: user.summaryCount || 0
        });
    } catch (err) {
        logger.error('Profile fetch error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
});


// ── PATCH /api/profile/username ─────────────────────────────────────────────
app.patch('/api/profile/username', requireAuth, async (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== 'string')
        return res.status(400).json({ error: 'Username is required.' });

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 32)
        return res.status(400).json({ error: 'Username harus 3–32 karakter.' });
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed))
        return res.status(400).json({ error: 'Username hanya boleh huruf, angka, dan underscore.' });

    try {
        const existing = await User.findOne({ username: trimmed, _id: { $ne: req.session.userId } });
        if (existing) return res.status(409).json({ error: 'Username sudah digunakan.' });

        await User.findByIdAndUpdate(req.session.userId, { username: trimmed });
        res.json({ success: true, username: trimmed });
    } catch (err) {
        logger.error('Change username error', { error: err.message });
        res.status(500).json({ error: 'Gagal mengubah username.' });
    }
});

// ── PATCH /api/profile/password ─────────────────────────────────────────────
app.patch('/api/profile/password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
        return res.status(400).json({ error: 'Semua field wajib diisi.' });
    if (newPassword.length < 6)
        return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });

    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Password saat ini salah.' });

        user.passwordHash = await bcrypt.hash(newPassword, 12);
        await user.save();
        res.json({ success: true });
    } catch (err) {
        logger.error('Change password error', { error: err.message });
        res.status(500).json({ error: 'Gagal mengubah password.' });
    }
});

app.post('/api/activate-premium', requireAuth, async (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== 'string')
        return res.status(400).json({ error: 'Token is required.' });

    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (user.role === 'premium' || user.role === 'admin')
            return res.json({ success: true, message: 'Akun kamu sudah Premium.' });

        if (!user.premiumToken || user.premiumToken !== token.trim())
            return res.status(400).json({ error: 'Token tidak valid.' });

        if (!user.premiumTokenExpiry || user.premiumTokenExpiry < new Date())
            return res.status(400).json({ error: 'Token sudah kadaluarsa. Hubungi admin untuk generate token baru.' });

        user.role               = 'premium';
        user.premiumToken       = null;
        user.premiumTokenExpiry = null;
        await user.save();

        
        req.session.role = 'premium';

        res.json({ success: true, message: ' Akun kamu sekarang Premium! Semua fitur sudah terbuka.' });
    } catch (err) {
        logger.error('Activate premium error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

app.get('/api/data', requireAuth, async (req, res) => {
    try {
        const journals = await Journal
            .find({ userId: req.session.userId })
            .sort({ Relevansi: -1, createdAt: -1 })
            .lean();

        // Robust backend-side 'isSaved' check
        const savedItems = await SavedJournal.find({ userId: req.session.userId }, 'judul link').lean();
        const savedTitles = new Set(savedItems.map(s => s.judul?.trim().toLowerCase()));
        const savedLinks = new Set(savedItems.map(s => s.link?.trim()));

        const journalsWithStatus = journals.map(j => ({
            ...j,
            isSaved: (j.judul && savedTitles.has(j.judul.trim().toLowerCase())) || 
                     (j.link && savedLinks.has(j.link.trim()))
        }));

        res.json(journalsWithStatus);
    } catch (err) {
        logger.error('Data fetch error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch data.' });
    }
});

app.delete('/api/data', requireAuth, async (req, res) => {
    try {
        const { ids } = req.body || {};
        if (ids && Array.isArray(ids) && ids.length > 0) {
            const result = await Journal.deleteMany({
                _id: { $in: ids },
                userId: req.session.userId
            });
            res.json({ success: true, deleted: result.deletedCount });
        } else {
            await Journal.deleteMany({ userId: req.session.userId });
            res.json({ success: true });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete data.' });
    }
});

app.get('/api/saved', requireAuth, async (req, res) => {
    try {
        const saved = await SavedJournal
            .find({ userId: req.session.userId })
            .sort({ savedAt: -1 });
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch saved journals.' });
    }
});

app.get('/api/saved/stats', requireAuth, async (req, res) => {
    try {
        const saved = await SavedJournal.find({ userId: req.session.userId });
        const byYear = {}, bySource = {}, byCategory = {};

        for (const j of saved) {
            const yr  = j.tahun || 'N/A';
            byYear[yr]   = (byYear[yr]   || 0) + 1;
            const src = j.source || 'Unknown';
            bySource[src] = (bySource[src] || 0) + 1;
            const cats = (j.Kategori || 'Literatur Umum').split('|').map(c => c.trim());
            for (const cat of cats) {
                byCategory[cat] = (byCategory[cat] || 0) + 1;
            }
        }

        res.json({
            total:      saved.length,
            byYear:     Object.entries(byYear).sort((a,b) => a[0].localeCompare(b[0])).map(([k,v]) => ({ label: k, count: v })),
            bySource:   Object.entries(bySource).map(([k,v]) => ({ label: k, count: v })),
            byCategory: Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0, 8).map(([k,v]) => ({ label: k, count: v }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

app.post('/api/saved', requireAuth, async (req, res) => {
    try {
        const { judul } = req.body;
        if (!judul) return res.status(400).json({ error: 'Missing judul field.' });

        const exists = await SavedJournal.findOne({ userId: req.session.userId, judul });
        if (exists) return res.status(409).json({ error: 'Already bookmarked.' });

        const { _id, __v, createdAt, isDuplicateSuspect, duplicateOf,
                _score_keyword, _score_citation, _score_abstract, _score_access,
                ...journalData } = req.body;

        const saved = await SavedJournal.create({ userId: req.session.userId, ...journalData });
        res.json(saved);
    } catch (err) {
        logger.error('POST /api/saved error', { error: err.message });
        res.status(500).json({ error: 'Failed to save journal.', detail: err.message });
    }
});

app.patch('/api/saved/:id/note', requireAuth, async (req, res) => {
    try {
        const { note } = req.body;
        await SavedJournal.updateOne(
            { _id: req.params.id, userId: req.session.userId },
            { $set: { note } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update note.' });
    }
});

app.delete('/api/saved/:id', requireAuth, async (req, res) => {
    try {
        await SavedJournal.deleteOne({ _id: req.params.id, userId: req.session.userId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove bookmark.' });
    }
});

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
    QUOTA:     'gemini_quota',
    KEY:       'gemini_key',
    OVERLOAD:  'gemini_overload',
    TIMEOUT:   'gemini_timeout',
    UNKNOWN:   'gemini_unknown',
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
            path:     `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);

                    // ── Classify API-level errors ────────────────────────
                    if (parsed.error) {
                        const status  = parsed.error.status || '';
                        const code    = parsed.error.code   || res.statusCode;
                        const message = parsed.error.message || 'Gemini API error';
                        const err     = new Error(message);

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
                } catch(e) { finish(reject, e); }
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
                code:        err.geminiCode,
                attemptsLeft,
                retryInMs:   delay
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
            _id:    { $in: journalIds },
            userId: req.session.userId
        });

        if (!journals.length) return res.status(404).json({ error: 'Journals not found.' });

        const contents = [];
        for (const j of journals) {
            let content  = j.abstrak_lengkap || '';
            const hasAbs = content && !content.toLowerCase().includes('not available') && content.length > 400;

            if (!hasAbs && j.link && j.link !== 'null') {
                const fetched = await fetchPageContent(j.link);
                if (fetched?.length > 80) content = fetched;
            }

            contents.push({
                judul:   j.judul   || 'Unknown Title',
                authors: j.author_info || 'Unknown Author',
                tahun:   j.tahun   || 'n.d.',
                content: content   || '[No abstract available]'
            });
        }

        const journalList = contents.map((j, i) =>
            `[${i+1}] "${j.judul}" — ${j.authors} (${j.tahun})\nContent: ${j.content}`
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
            userId:       req.session.userId,
            journalCount: journals.length,
            language
        });

        res.json({ summary, journalCount: journals.length });

    } catch (err) {
        clearTimeout(timeoutId);

        // ── Map Gemini error codes to user-friendly messages ──────────────
        const geminiMessages = {
            [GEMINI_ERR.QUOTA]:    { status: 503, error: 'geminiQuota',    message: 'Layanan AI sedang kelebihan beban (quota habis). Coba lagi dalam beberapa menit.' },
            [GEMINI_ERR.KEY]:      { status: 503, error: 'geminiKey',      message: 'Konfigurasi AI bermasalah. Hubungi admin.' },
            [GEMINI_ERR.OVERLOAD]: { status: 503, error: 'geminiOverload', message: 'Server AI sedang sibuk. Coba lagi dalam 1-2 menit.' },
            [GEMINI_ERR.TIMEOUT]:  { status: 504, error: 'geminiTimeout',  message: 'AI terlalu lama merespons. Coba lagi atau kurangi jumlah jurnal.' },
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

const jobQueue   = [];
const activeJobs = {};
const jobProgress = {}; // tracks last progress per jobId for reconnecting sockets
let isRunning    = false;
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
    const files   = [
        path.join(dataDir, `jurnal_mentah_${jobId}.json`),
        path.join(dataDir, `jurnal_bersih_${jobId}.json`),
        path.join(dataDir, `jurnal_siap_skripsi_${jobId}.xlsx`),
    ];
    for (const f of files) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
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
    const sanitizedTarget = /^\d+$/.test(String(target)) && parseInt(target) > 0 && parseInt(target) <= 1000
        ? String(target)
        : '10';
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
            try { activeJobs[jobId].scraperProcess.stdin.end(); } catch (_) {}
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
            try { activeJobs[jobId].scraperProcess.stdin.end(); } catch (_) {}
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

        logger.job(jobId).info('Scraper done, running Python processor');

        const pythonPath = path.join(__dirname, '../processor');
        const pyArgs     = ['main.py', sanitizedKeyword, sanitizedYearFrom, sanitizedYearTo, jobId];
        const pyProcess  = spawn('python3', pyArgs, {
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

                const raw     = fs.readFileSync(jsonPath, 'utf-8');
                let records   = JSON.parse(raw);

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

                    user.quotaUsed         += records.length;
                    user.dailyScrapedToday += records.length;
                    user.lastScrapeDate     = todayWIB;
                    await user.save();
                }

                
                if (clearData) await Journal.deleteMany({ userId });

                const docs = records.map(r => ({
                    ...r,
                    userId,
                    keyword:  r.keyword || keyword,
                    isBook:   !!r.isBook
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
    });
}

app.post('/api/scrape', requireAuth, async (req, res) => {
    const {
        keyword,
        clearData,
        source   = 'scholar',
        apiKey   = '',
        yearFrom = 2020,
        yearTo   = new Date().getFullYear(),
        target   = 10
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
    const yTo   = parseInt(yearTo);
    if (isNaN(yFrom) || isNaN(yTo) || yFrom > yTo || yFrom < 1900 || yTo > new Date().getFullYear() + 1)
        return res.status(400).json({ error: 'Invalid year range.' });

    const tgt = Math.min(Math.max(parseInt(target) || 10, 1), 50);

    
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    const isPremium = user.role === 'premium' || user.role === 'admin';

    if (!isPremium) {
        
        if (user.quotaUsed >= user.quotaLimit) {
            return res.status(403).json({
                error:          'quotaExhausted',
                message:        `Quota kamu sudah habis (${user.quotaUsed}/${user.quotaLimit}). Upgrade ke Premium untuk scraping unlimited.`
            });
        }

        
        const todayWIB = getTodayWIB();
        const dailyUsed = user.lastScrapeDate === todayWIB ? user.dailyScrapedToday : 0;

        if (dailyUsed >= user.dailyLimit) {
            return res.status(403).json({
                error:   'dailyLimitReached',
                message: `Limit harian kamu sudah tercapai (${user.dailyLimit} jurnal/hari). Coba lagi besok jam 00:00 WIB.`
            });
        }
    }

    
    const uid = req.session.userId.toString();
    if (userJobSet.has(uid))
        return res.status(429).json({ error: 'You already have an active scrape job. Please wait for it to finish.' });

    const jobId         = crypto.randomBytes(6).toString('hex');
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
                status:   'running',
                progress: jobProgress[jobId] || null
            });
        }
    }

    // Check queued jobs
    const queuedIdx = jobQueue.findIndex(j => j.userId.toString() === uid);
    if (queuedIdx !== -1) {
        return res.json({
            jobId:         jobQueue[queuedIdx].jobId,
            status:        'queued',
            queuePosition: queuedIdx + 1,
            progress:      null
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

    try { job.scraperProcess.kill('SIGTERM'); } catch (_) {}
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
        const users  = await User.find({}, { passwordHash: 0, emailVerifyToken: 0 }).sort({ createdAt: -1 }).lean();
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
                            store.destroy(sess._id || sess.id, () => {});
                    }
                });
            }
        } catch (_) {}

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
        const token    = `${rawToken.slice(0,4)}-${rawToken.slice(4,8)}-${rawToken.slice(8,12)}`;
        const expiry   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

        user.premiumToken       = token;
        user.premiumTokenExpiry = expiry;
        await user.save();

        const emailResult = await sendPremiumTokenEmail(user.email, user.username, token);

        res.json({
            success: true,
            token,
            emailSent:  !emailResult.error,
            emailError: emailResult.error || null,
            message:    emailResult.error
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
        const userIds  = [...new Set(journals.map(j => j.userId.toString()))];
        const users    = await User.find({ _id: { $in: userIds } }, { username: 1 }).lean();
        const userMap  = Object.fromEntries(users.map(u => [u._id.toString(), u.username]));
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
        status:    dbState === 1 ? 'ok' : 'degraded',
        db:        dbState === 1 ? 'connected' : 'disconnected',
        uptime:    Math.floor(process.uptime()),
        queue:     jobQueue.length,
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
            Object.entries(req.headers).map(([k,v]) => `${k}: ${v}`).join('\r\n') +
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
        url:   `http://localhost:${PORT}`,
        mode:  IS_PROD ? 'production' : 'development',
        mongo: MONGO_URI,
        email: resend ? 'enabled' : 'disabled',
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
        } catch (_) {}
    }
    server.close(async () => {
        try { await mongoose.connection.close(); logger.info('Shutdown complete'); } catch (_) {}
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
