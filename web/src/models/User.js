const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'premium', 'admin'], default: 'user' },

    isEmailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, default: null },
    emailVerifyExpiry: { type: Date, default: null },

    quotaUsed: { type: Number, default: 0 },
    quotaLimit: { type: Number, default: 10 },
    dailyScrapedToday: { type: Number, default: 0 },
    dailyLimit: { type: Number, default: 2 },
    lastScrapeDate: { type: String, default: '' },

    premiumToken: { type: String, default: null },
    premiumTokenExpiry: { type: Date, default: null },

    summaryCount: { type: Number, default: 0 },  // lifetime AI Summary usage
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
