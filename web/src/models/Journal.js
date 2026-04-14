const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    keyword: { type: String, index: true },
    source: { type: String, default: 'Unknown' },
    judul: String,
    author_info: String,
    tahun: String,
    abstrak_lengkap: String,
    Kategori: String,
    Relevansi: Number,
    link: String,
    isBook: { type: Boolean, default: false },
    journal: String,
    citationCount: { type: Number, default: 0 },
    isOpenAccess: { type: Boolean, default: false },
    isDuplicateSuspect: String,
    duplicateOf: String,
    Akses: String,
    createdAt: { type: Date, default: Date.now }
});

journalSchema.index({ userId: 1, createdAt: -1 });
journalSchema.index({ userId: 1, Relevansi: -1 });
journalSchema.index({ userId: 1, source: 1 });

module.exports = mongoose.model('Journal', journalSchema);
