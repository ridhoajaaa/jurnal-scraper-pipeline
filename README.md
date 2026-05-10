# LitAssist — Academic Journal Scraper & AI Research Assistant

LitAssist is a full-stack platform that helps researchers discover, analyze, and manage academic literature. It combines multi-source browser automation scraping with a quality-scoring engine and Gemini AI to turn raw search results into ranked, categorized, and actionable research insights.

---

## Key Features

- **Multi-Source Scraping**: Fetches journals from Google Scholar (Puppeteer Stealth), Scopus (API), Semantic Scholar (API), and OpenAlex (API) — all run in a single job.
- **Quality-First Scoring Engine**: Python processor scores every paper on keyword relevance (50%), citation impact (25%), abstract quality (15%), and open access status (10%), enhanced with OpenAlex FWCI data.
- **AI Literature Review**: Gemini 2.5 Flash generates cohesive literature review paragraphs with in-text citations from your saved journals (Premium feature).
- **Real-Time Dashboard**: Socket.IO-powered live progress tracking, job queue status, and CAPTCHA alerts.
- **CAPTCHA Handling via noVNC**: Built-in Xvfb + x11vnc + websockify pipeline lets you solve CAPTCHAs through your browser, even in headless/Docker environments.
- **Personal Research Library**: Bookmark journals, add personal notes, and generate citation-ready references.
- **Smart Deduplication**: Exact title matching + Jaccard similarity (72% threshold) across title and abstract tokens to flag and remove duplicates.
- **Role-Based Access**: Three tiers — `user` (quota-limited), `premium` (unlimited + AI), `admin` (full management).
- **Email Verification & Password Reset**: Transactional emails via Resend for account verification, premium token delivery, and password reset.
- **PWA Support**: Installable Progressive Web App with service worker caching.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4, Shadcn/UI (Radix UI), Framer Motion, Zustand, TanStack React Query, React Router v7, Axios, Sonner, Lucide Icons |
| **Backend** | Node.js, Express 5, Mongoose 9 (MongoDB), Socket.IO, express-session + connect-mongo, bcryptjs, Helmet, express-rate-limit, compression, Winston |
| **Email** | Resend |
| **Scraper** | Puppeteer + puppeteer-extra-plugin-stealth |
| **Processor** | Python 3, Pandas, XlsxWriter, pymongo, scrapling |
| **AI** | Google Gemini 2.5 Flash (via REST API) |
| **Infra** | Docker, Docker Compose, Xvfb, x11vnc, websockify/noVNC, Ngrok |

---

## Project Structure

```text
├── web/                        # Backend + Frontend monorepo
│   ├── server.js               # Express server, Socket.IO, API routes, scraper orchestration
│   ├── logger.js               # Structured logging (Winston, JSON in prod, colorized in dev)
│   ├── start.sh                # Docker entrypoint (Xvfb + x11vnc + websockify + Node)
│   ├── setup-perf.sh           # Performance optimization script
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js         # Register, login, logout, email verify, password reset
│   │   │   ├── data.js         # Journal CRUD, saved journals, stats, premium activation
│   │   │   └── profile.js      # Profile get, username/password change
│   │   ├── models/
│   │   │   ├── User.js         # User schema (roles, quotas, tokens)
│   │   │   ├── Journal.js      # Scraped journal schema
│   │   │   └── SavedJournal.js # Bookmarked journal schema
│   │   ├── middlewares/
│   │   │   └── auth.js         # requireAuth, requireAdmin guards
│   │   ├── services/
│   │   │   └── email.js        # Resend email: verification, premium token, password reset
│   │   └── utils/
│   │       └── date.js         # WIB (UTC+7) date utility
│   ├── client/                 # React (Vite) SPA
│   │   ├── src/
│   │   │   ├── pages/          # Landing, Login, Dashboard, Library, AISummary,
│   │   │   │                   #   Stats, Profile, Help, Admin, NotFound
│   │   │   ├── components/     # ui/ (Shadcn), layout/ (Sidebar, MobileNav), shared/
│   │   │   ├── stores/         # Zustand: authStore, scrapeStore, themeStore
│   │   │   ├── hooks/          # queries.ts (React Query), useScrapeManager.ts
│   │   │   ├── services/       # api.ts (all API endpoint wrappers)
│   │   │   └── lib/            # api-client.ts (Axios), socket.ts, utils.ts
│   │   └── vite.config.ts      # Build → ../dist, dev proxy → :3000
│   ├── tests/                  # Jest + Supertest + mongodb-memory-server
│   │   ├── auth.test.js
│   │   ├── admin.test.js
│   │   ├── quota.test.js
│   │   ├── saved.test.js
│   │   └── setup.js
│   └── public/                 # PWA manifest, service worker, icons
├── scraper/                    # Puppeteer scraping engine
│   ├── index.js                # Scholar, Scopus, Semantic Scholar scraping logic
│   └── config.js               # Timeouts, quality thresholds, selectors, browser args
├── processor/                  # Python data processing pipeline
│   ├── main.py                 # Cleaning, scoring, categorization, deduplication, XLSX export
│   ├── openalex_scraper.py     # OpenAlex API scraper (runs parallel with main scraper)
│   └── requirements.txt        # pandas, xlsxwriter, pymongo, scrapling
├── scripts/
│   └── backup.sh               # MongoDB auto-backup with rotation (keeps last 7)
├── data/                       # Runtime: raw JSON, cleaned JSON, XLSX output
├── backups/                    # MongoDB backup snapshots
├── Dockerfile                  # Node 20 + Python 3 + Chromium + Xvfb + noVNC
└── docker-compose.yml          # Web + MongoDB + Ngrok orchestration
```

---

## Data Flow

```
User (Dashboard)
  │
  ▼
POST /api/scrape ──► Job Queue (1 active, FIFO)
  │
  ├──► Scraper (Scholar / Scopus / Semantic Scholar)
  │       └──► jurnal_mentah_{jobId}.json
  │
  ├──► OpenAlex Scraper (parallel)
  │       └──► openalex_raw_{jobId}.json
  │
  └──► Python Processor (after both finish)
          ├── Merge all sources
          ├── Clean (HTML entities, authors, abstracts)
          ├── Enrich with OpenAlex FWCI scores
          ├── Score (keyword 50% + citation 25% + abstract 15% + access 10%)
          ├── Categorize (12 bilingual categories)
          ├── Deduplicate (exact + Jaccard similarity)
          ├──► jurnal_bersih_{jobId}.json
          └──► jurnal_siap_skripsi_{jobId}.xlsx

                  │
                  ▼
          MongoDB (Journal collection)
                  │
                  ▼
          Socket.IO → Client (scrape-done)
```

---

## Quick Start (Docker — Recommended)

1.  **Clone & Configure**:
    ```bash
    git clone <repo-url>
    cd jurnal-scraper-pipeline
    cp .env.example .env
    # Edit .env with your actual keys
    ```

2.  **Start Services**:
    ```bash
    docker-compose up -d
    ```

3.  **Access**:
    -   **Dashboard**: http://localhost:3000
    -   **noVNC (CAPTCHA)**: http://localhost:3000/novnc/vnc.html (proxied via WebSocket)
    -   **Ngrok Panel**: http://localhost:4040

---

## Manual Installation

### 1. Backend & Frontend

```bash
# Install backend dependencies
cd web
npm install

# Build frontend
cd client
npm install
npm run build    # Outputs to web/dist/
cd ..

# Start server
node server.js
```

### 2. Processor

```bash
cd processor
pip install -r requirements.txt
```

### 3. Scraper CLI (Standalone)

The scraper can be run independently for testing:

```bash
cd scraper
npm install
node index.js -- <keyword> <deleteOld> <source> <apiKey> <yearFrom> <yearTo> <target> <jobId>
```

| Argument | Default | Description |
| :--- | :--- | :--- |
| `keyword` | `""` | Search terms |
| `deleteOld` | `n` | `y` to clear previous data file before starting |
| `source` | `scholar` | `scholar`, `scopus`, or `semantic` |
| `apiKey` | `""` | Required for Scopus only |
| `yearFrom` | `2020` | Filter: publication year start |
| `yearTo` | current year | Filter: publication year end |
| `target` | `10` | Max journals to collect (capped at 50) |
| `jobId` | `standalone` | Unique identifier for output files |

> **Note**: The `--` separator before arguments is required when launched from the web server. When running standalone, it's optional.

---

## Environment Variables

| Variable | Required | Description |
| :--- | :--- | :--- |
| `MONGO_URI` | Yes | MongoDB connection string (default: `mongodb://localhost:27017/literature_assistant`) |
| `SESSION_SECRET` | **Yes** | Secure random string for session encryption — server will crash without it |
| `GEMINI_API_KEY` | No | Google Gemini API key for AI Summary (from [AI Studio](https://aistudio.google.com/)) |
| `RESEND_API_KEY` | No | Resend API key for transactional emails (from [resend.com](https://resend.com/)) |
| `APP_URL` | No | Public URL of your deployment (default: `http://localhost:3000`) |
| `NGROK_AUTHTOKEN` | No | Ngrok auth token for tunnel (Docker only) |
| `NODE_ENV` | No | `production` for JSON logs + security headers |
| `LOG_LEVEL` | No | Winston log level (default: `info` in prod, `debug` in dev) |

---

## API Reference

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/register` | Create account (first user → admin) |
| POST | `/login` | Login with email + password |
| POST | `/logout` | Destroy session |
| GET | `/me` | Check login status |
| GET | `/verify-email?token=` | Verify email via link |
| POST | `/resend-verify` | Resend verification email |
| POST | `/forgot-password` | Request password reset email |
| POST | `/reset-password` | Reset password with token |

### Profile (`/api/profile`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/` | Get user profile + quota info |
| PATCH | `/username` | Change username |
| PATCH | `/password` | Change password |

### Data (`/api`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/data` | Get scraped journals (max 300, sorted by relevance) |
| DELETE | `/data` | Delete journals (by IDs or all) |
| GET | `/saved` | Get bookmarked journals (max 500) |
| POST | `/saved` | Bookmark a journal |
| DELETE | `/saved/:id` | Remove bookmark |
| PATCH | `/saved/:id/note` | Update personal note |
| GET | `/saved/stats` | Get library statistics (by year, source, category) |
| POST | `/activate-premium` | Activate premium with token |

### Scraping (`/api/scrape`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/` | Start scrape job (queued, 1 per user) |
| GET | `/my-active-job` | Restore UI state after page reload |
| POST | `/:jobId/cancel` | Cancel running job |

### AI Summary (`/api/summary`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/` | Generate literature review from saved journals (Premium only, max 15) |

### Admin (`/api/admin`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/users` | List all users |
| DELETE | `/users/:id` | Delete user + all data |
| PATCH | `/users/:id/verify` | Manually verify email |
| PATCH | `/users/:id/promote` | Promote to admin |
| POST | `/users/:id/generate-token` | Generate premium activation token (emailed) |
| GET | `/journals` | List all journals (max 200) |
| DELETE | `/journals/:id` | Delete single journal |
| DELETE | `/journals/all` | Delete all journals |

### Health

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/health` | Server status, DB state, uptime, queue info |

---

## Quality Scoring System

The processor (`processor/main.py`) scores each paper on a 0–100 scale:

| Component | Weight | Description |
| :--- | :--- | :--- |
| Keyword Relevance | 50% | Token matching in title (3x) + abstract (1x), phrase bonus, position bonus |
| Citation Score | 25% | Log-normalized citation velocity (citations/year), recency bonus for new papers, FWCI boost from OpenAlex |
| Abstract Quality | 15% | Existence + length + academic signal words (e.g., "this study", "results show") |
| Access Bonus | 10% | Open access domains, PDF links, or inferred from abstract availability |

**Academic Categories** (12 bilingual EN/ID categories):
Metode Penelitian, Hasil & Temuan, Tinjauan Literatur, Studi Empiris, Kerangka Teori, Teknologi & Sistem, Data & Kecerdasan Buatan, Kebijakan & Tata Kelola, Pendidikan & Pembelajaran, Kesehatan & Biomedis, Bisnis & Ekonomi, Keamanan & Privasi.

---

## Administrator Guide

### First-Time Setup
The **first user to register** automatically becomes `admin`. All subsequent registrations are assigned the `user` role. Admin accounts are auto-verified (no email verification required).

### Admin Capabilities
- **User Management**: View all users, delete users (cascades to all their data + sessions), manually verify emails, promote to admin.
- **Premium Tokens**: Generate time-limited tokens (7-day expiry, format: `XXXX-XXXX-XXXX`) — automatically emailed to the user.
- **Journal Management**: View and delete scraped journals across all users.
- **Quota System**: Free users get a lifetime quota (`quotaLimit`, default: 10) and daily limit (`dailyLimit`, default: 2 journals/day, resets at 00:00 WIB). Premium and admin users have unlimited access.

---

## Security

- **Helmet**: CSP, HSTS, X-Content-Type-Options, Permissions-Policy, and more.
- **Rate Limiting**: API (200/15min), Auth (20/15min), Scrape (10/hour, skipped for premium/admin).
- **Session**: HTTP-only cookies, 7-day expiry, stored in MongoDB via connect-mongo.
- **Password**: bcrypt with 12 salt rounds.
- **Input Sanitization**: Keyword, year, source, and API key inputs are sanitized before passing to child processes.
- **Static File Security**: Server source files are not exposed; only `dist/` and `public/` are served.

---

## Database Backup

Automated MongoDB backup with rotation:

```bash
# Setup (one-time)
chmod +x scripts/backup.sh

# Manual backup
./scripts/backup.sh

# Cron job (daily at 02:00)
crontab -e
0 2 * * * /bin/bash /path/to/jurnal-scraper-pipeline/scripts/backup.sh >> /path/to/backups/backup.log 2>&1
```

Runs `mongodump` inside the `literature_mongodb` container, saves to `./backups/YYYY-MM-DD_HH-MM/`, and keeps the last 7 backups.

---

## Testing

```bash
cd web
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

Tests use `mongodb-memory-server` for an isolated in-memory MongoDB instance. Test suites cover authentication, admin operations, quota enforcement, and saved journals.

---

## Frontend Development

```bash
cd web/client
npm install
npm run dev              # Vite dev server on :5173, proxies /api → :3000
```

The Vite dev server proxies both `/api` and `/socket.io` to the backend on port 3000. The production build outputs to `web/dist/` and is served by Express as static files with SPA fallback routing.

---

## Roadmap & Limitations

- **PDF Parsing**: Identifies PDF links but does not extract text from PDFs internally.
- **Publisher Restrictions**: Some publishers (Elsevier, IEEE) may trigger CAPTCHAs requiring manual solving via noVNC.
- **Scopus**: Requires a personal API key from Elsevier Developer Portal.
- **Semantic Scholar**: Subject to rate limits (429 responses handled with exponential backoff).
- **Scraper Concurrency**: Only one scrape job runs at a time (FIFO queue). Each user is limited to one active/queued job.

---

## License

ISC
