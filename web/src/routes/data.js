const express = require('express');
const router = express.Router();
const Journal = require('../models/Journal');
const SavedJournal = require('../models/SavedJournal');
const logger = require('../../logger');
const { requireAuth } = require('../middlewares/auth');

router.get('/data', requireAuth, async (req, res) => {
    try {
        const journals = await Journal
            .find({ userId: req.session.userId })
            .sort({ Relevansi: -1, createdAt: -1 })
            .limit(300) // SAFETY NET: Batasi max 300 data untuk mencegah OOM Crash
            .lean();

        // Robust backend-side 'isSaved' check
        const savedItems = await SavedJournal.find({ userId: req.session.userId }, 'judul link')
            .limit(1000) // SAFETY NET: Hindari tarik puluhan ribu bookmark
            .lean();
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

router.delete('/data', requireAuth, async (req, res) => {
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

router.get('/saved', requireAuth, async (req, res) => {
    try {
        const saved = await SavedJournal
            .find({ userId: req.session.userId })
            .sort({ savedAt: -1 })
            .limit(500); // SAFETY NET: Batasi memuat list bookmark maksimal 500 terbaru
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch saved journals.' });
    }
});

router.get('/saved/stats', requireAuth, async (req, res) => {
    try {
        // SAFETY NET: lean() membuat DB queries 5x lipat lebih ringan di memory RAM Node.js
        const saved = await SavedJournal.find({ userId: req.session.userId }).lean();
        const byYear = {}, bySource = {}, byCategory = {};

        for (const j of saved) {
            const yr = j.tahun || 'N/A';
            byYear[yr] = (byYear[yr] || 0) + 1;
            const src = j.source || 'Unknown';
            bySource[src] = (bySource[src] || 0) + 1;
            const cats = (j.Kategori || 'Literatur Umum').split('|').map(c => c.trim());
            for (const cat of cats) {
                byCategory[cat] = (byCategory[cat] || 0) + 1;
            }
        }

        res.json({
            total: saved.length,
            byYear: Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k, count: v })),
            bySource: Object.entries(bySource).map(([k, v]) => ({ label: k, count: v })),
            byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: k, count: v }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

router.post('/saved', requireAuth, async (req, res) => {
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

router.patch('/saved/:id/note', requireAuth, async (req, res) => {
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

router.delete('/saved/:id', requireAuth, async (req, res) => {
    try {
        await SavedJournal.deleteOne({ _id: req.params.id, userId: req.session.userId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove bookmark.' });
    }
});

router.post('/activate-premium', requireAuth, async (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== 'string')
        return res.status(400).json({ error: 'Token is required.' });

    try {
        const User = require('../models/User'); // Import just for this or add it to the top
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (user.role === 'premium' || user.role === 'admin')
            return res.json({ success: true, message: 'Akun kamu sudah Premium.' });

        if (!user.premiumToken || user.premiumToken !== token.trim())
            return res.status(400).json({ error: 'Token tidak valid.' });

        if (!user.premiumTokenExpiry || user.premiumTokenExpiry < new Date())
            return res.status(400).json({ error: 'Token sudah kadaluarsa. Hubungi admin untuk generate token baru.' });

        user.role = 'premium';
        user.premiumToken = null;
        user.premiumTokenExpiry = null;
        await user.save();

        req.session.role = 'premium';

        res.json({ success: true, message: ' Akun kamu sekarang Premium! Semua fitur sudah terbuka.' });
    } catch (err) {
        logger.error('Activate premium error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
