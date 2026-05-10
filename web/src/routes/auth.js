const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../../logger');
const { sendVerificationEmail } = require('../services/email');

const { getTodayWIB } = require('../utils/date');

router.post('/register', async (req, res) => {
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

        const passwordHash = await bcrypt.hash(password, 12);
        const userCount = await User.countDocuments();
        const role = userCount === 0 ? 'admin' : 'user';

        const isEmailVerified = role === 'admin';
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
            req.session.userId = user._id;
            req.session.username = user.username;
            req.session.role = user.role;
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

router.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect('/?error=invalid_token');

    try {
        const user = await User.findOne({
            emailVerifyToken: token,
            emailVerifyExpiry: { $gt: new Date() }
        });

        if (!user) return res.redirect('/?error=token_expired');

        user.isEmailVerified = true;
        user.emailVerifyToken = null;
        user.emailVerifyExpiry = null;
        await user.save();

        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.role = user.role;

        req.session.save(err => {
            if (err) return res.redirect('/?error=session_error');
            res.redirect('/index.html?verified=1');
        });
    } catch (err) {
        logger.error('Verify email error', { error: err.message });
        res.redirect('/?error=server_error');
    }
});

router.post('/resend-verify', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'Email not found.' });
        if (user.isEmailVerified) return res.json({ success: true, message: 'Akun sudah terverifikasi.' });

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.emailVerifyToken = token;
        user.emailVerifyExpiry = expiry;
        await user.save();

        await sendVerificationEmail(user.email, user.username, token);
        res.json({ success: true, message: 'Email verifikasi sudah dikirim ulang.' });
    } catch (err) {
        logger.error('Resend verify error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

        const isPrivileged = user.role === 'admin' || user.role === 'premium';
        if (!user.isEmailVerified && !isPrivileged) {
            return res.status(403).json({
                error: 'Email belum diverifikasi.',
                notVerified: true,
                message: 'Cek inbox atau spam kamu, lalu klik link verifikasi. Atau minta kirim ulang.'
            });
        }
        
        if (isPrivileged && !user.isEmailVerified) {
            user.isEmailVerified = true;
            await user.save();
        }

        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.role = user.role;
        if (!rememberMe) req.session.cookie.maxAge = null;

        const isPremium = user.role === 'premium' || user.role === 'admin';
        const todayWIB = getTodayWIB();

        req.session.save(err => {
            if (err) {
                logger.error('Session save error', { error: err.message });
                return res.status(500).json({ error: 'Session save failed.' });
            }
            res.json({
                success: true,
                username: user.username,
                role: user.role,
                isPremium,
                quotaUsed: user.quotaUsed || 0,
                quotaLimit: user.quotaLimit || 10,
                quotaRemaining: Math.max(0, (user.quotaLimit || 10) - (user.quotaUsed || 0)),
                quotaExhausted: !isPremium && (user.quotaUsed || 0) >= (user.quotaLimit || 10),
                dailyScrapedToday: user.lastScrapeDate === todayWIB ? (user.dailyScrapedToday || 0) : 0,
                dailyLimit: user.dailyLimit || 2,
            });
        });
    } catch (err) {
        logger.error('Login error', { error: err.message });
        res.status(500).json({ error: 'Server error during login.' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Logout failed.' });
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

router.get('/me', async (req, res) => {
    if (!req.session.userId) return res.json({ loggedIn: false });
    try {
        const user = await User.findById(req.session.userId).lean();
        if (!user) { req.session.destroy(() => { }); return res.json({ loggedIn: false }); }
        res.json({ loggedIn: true, username: req.session.username, role: req.session.role || 'user' });
    } catch { res.json({ loggedIn: false }); }
});


router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.json({ success: true });
        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();
        const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
        const resetLink = `${APP_URL}/reset-password?token=${token}`;
        try {
            const { sendPasswordResetEmail } = require('../services/email');
            const result = await sendPasswordResetEmail(user.email, user.username, token);
            if (result.error) throw new Error(result.error);
        } catch (emailErr) {
            logger.warn('Reset email failed, link logged', { email: user.email, resetLink, error: emailErr.message });
        }
        res.json({ success: true });
    } catch (err) {
        logger.error('Forgot password error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    try {
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpiry: { $gt: new Date() } });
        if (!user) return res.status(400).json({ error: 'Invalid or expired reset token.' });
        user.passwordHash = await bcrypt.hash(password, 12);
        user.resetPasswordToken = null;
        user.resetPasswordExpiry = null;
        await user.save();
        res.json({ success: true, message: 'Password berhasil diubah. Silakan login.' });
    } catch (err) {
        logger.error('Reset password error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
