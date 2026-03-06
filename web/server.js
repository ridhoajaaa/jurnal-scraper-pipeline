// web/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// Menyajikan file HTML statis
app.use(express.static(path.join(__dirname, 'public')));

// Membuat API Endpoint untuk mengambil data jurnal
app.get('/api/data', (req, res) => {
    const dataPath = path.join(__dirname, '../data/jurnal_bersih.json');
    if (fs.existsSync(dataPath)) {
        const rawData = fs.readFileSync(dataPath);
        res.json(JSON.parse(rawData));
    } else {
        res.status(404).json({ message: "Data belum tersedia." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Web Server berjalan di http://localhost:${PORT}`);
});