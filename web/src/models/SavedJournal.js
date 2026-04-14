const mongoose = require('mongoose');

const savedJournalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    judul: String,
    author_info: String,
    tahun: String,
    abstrak_lengkap: String,
    Kategori: String,
    Relevansi: Number,
    citationCount: { type: Number, default: 0 },
    Akses: String,
    link: String,
    source: String,
    isBook: { type: Boolean, default: false },
    keyword: String,
    journal: String,
    isDuplicateSuspect: String,
    note: { type: String, default: '' },
    savedAt: { type: Date, default: Date.now }
});

savedJournalSchema.index({ userId: 1, savedAt: -1 });
savedJournalSchema.index({ userId: 1, judul: 1 });

module.exports = mongoose.model('SavedJournal', savedJournalSchema);
