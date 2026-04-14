const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const logger = require('../../logger');
const { requireAuth } = require('../middlewares/auth');

const { getTodayWIB } = require('../utils/date');

router.get('/', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId, { passwordHash: 0, emailVerifyToken: 0, premiumToken: 0 }).lean();
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const todayWIB = getTodayWIB();
        const isPremium = user.role === 'premium' || user.role === 'admin';

        res.json({
            username: user.username,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            createdAt: user.createdAt,

            quotaUsed: user.quotaUsed,
            quotaLimit: user.quotaLimit,
            quotaRemaining: Math.max(0, user.quotaLimit - user.quotaUsed),
            quotaExhausted: !isPremium && user.quotaUsed >= user.quotaLimit,

            dailyScrapedToday: user.lastScrapeDate === todayWIB ? user.dailyScrapedToday : 0,
            dailyLimit: user.dailyLimit,

            isPremium,
            summaryCount: user.summaryCount || 0
        });
    } catch (err) {
        logger.error('Profile fetch error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
});

router.patch('/username', requireAuth, async (req, res) => {
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

router.patch('/password', requireAuth, async (req, res) => {
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

module.exports = router;
