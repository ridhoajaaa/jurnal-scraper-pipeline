# LitAssist — Security & Code Quality Fixes
> Hasil Code Review oleh BrowserOS Agent — 23 Mar 2026
> File: `server.js`

---

## 🔴 CRITICAL — Perbaiki Sebelum Deploy

- [ ] **[Baris 40-41] Hardcoded Fallback Secret**
  - `SESSION_SECRET` punya fallback hardcoded
  - Fix: throw error jika `SESSION_SECRET` tidak di-set di env, hapus fallback

- [ ] **[Baris 774-834] Command Injection — `fetchPageContent()`**
  - URL di-inject ke inline script via `JSON.stringify()` tanpa validasi ketat
  - Fix: validasi URL strict (cek protocol http/https, hostname whitelist) sebelum spawn

- [ ] **[Baris 1076-1087] Command Injection — `runScraper()`**
  - `keyword`, `apiKey`, dan parameter lain dipass ke command line tanpa sanitasi
  - Fix: validasi keyword hanya alphanumeric + spasi, gunakan `--` separator

- [ ] **[Baris 1148-1152] Command Injection — Python Processor**
  - `keyword` langsung dipass ke command line
  - Fix: validasi dan escape sama seperti `runScraper()`

---

## 🟡 WARNING — Sebaiknya Diperbaiki

- [ ] **[Baris 196-207] CORS Origin Check — Case Sensitivity**
  - Cek origin case-sensitive, tidak handle protocol variations
  - Fix: normalize URL sebelum compare, atau pakai library `cors`

- [ ] **[Baris 285] JSON Body Limit Terlalu Besar**
  - Limit 2MB rentan DoS attack
  - Fix: turunkan ke 100KB kecuali endpoint tertentu memang butuh large payload

- [ ] **[Baris 293-297] Cookie `secure: false`**
  - Cookie bisa di-sniff di network
  - Fix: set `secure: IS_PROD` agar production wajib HTTPS

- [ ] **[Baris 365] Race Condition pada Register**
  - 2 request bersamaan bisa lolos duplicate check
  - Fix: catch `MongoError code 11000` di error handler (unique index sudah ada, tinggal handle error-nya)

- [ ] **[Baris 1244-1247] Keyword Validation — Tidak Ada Karakter Whitelist**
  - Tidak ada validasi karakter berbahaya untuk shell injection
  - Fix: tambah regex `/^[a-zA-Z0-9\s\-_.,'"()]+$/`

- [ ] **[Baris 1372-1373] CAPTCHA Resume — `jobId` Tidak Divalidasi**
  - `jobId` langsung dipakai tanpa validasi format dan kepemilikan
  - Fix: validasi format jobId (hex, 12 chars) dan kepemilikan sebelum write ke stdin

- [ ] **[Baris 1537-1551] WebSocket Proxy Error Tidak Di-log**
  - Error handler tidak log — debugging sulit
  - Fix: tambah Winston log di setiap error handler

---

## 🟢 INFO — Saran Improvement (Opsional)

- [ ] **[Baris 161-163] Index MongoDB — Bisa Lebih Optimal**
  - Tambah composite index `{ userId: 1, keyword: 1 }` untuk query yang sering dipakai

- [ ] **[Baris 676-692] Delete Bulk tanpa Soft-Delete**
  - Pertimbangkan soft-delete (`deletedAt` field) untuk strict consistency

- [ ] **[Baris 1044-1062] Job Queue — Memory Leak Potential**
  - Queue hilang saat server restart
  - Pertimbangkan Redis-backed queue untuk production scale

- [ ] **[Baris 1220-1226] DB Operation tanpa Transaction**
  - `user.save()` + `deleteMany` + `insertMany` tidak atomic
  - Fix: gunakan MongoDB session/transaction agar konsisten

---

## Prioritas Pengerjaan

1. Selesaikan semua 🔴 CRITICAL sebelum deploy ke Railway
2. Selesaikan 🟡 WARNING setelah CRITICAL beres
3. 🟢 INFO bisa dikerjakan kapan saja saat ada waktu