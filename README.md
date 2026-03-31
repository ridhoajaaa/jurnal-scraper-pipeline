# LitAssist: Advanced Academic Journal Scraper & AI Assistant

LitAssist is a professional-grade, full-stack automation platform designed to revolutionize the way researchers discover, analyze, and manage academic literature. By combining advanced browser automation with Gemini AI, LitAssist transforms raw search results into actionable research insights.

---

## Key Features

- **Hybrid Scraper v5.0**: Powered by Puppeteer-ready Stealth, bypassing most bot detection to fetch full abstracts directly from publisher portals (OJS, Springer, Oxford, etc.).
- **AI Research Summary**: Automatic generation of research methods, key findings, and context using Google Gemini AI.
- **Real-time Monitoring**: Integrated Socket.IO dashboard to track scraping progress, target goals, and potential CAPTCHA triggers live.
- **CAPTCHA bypass & noVNC**: Built-in Xvfb/noVNC support allows manual CAPTCHA solving directly through your browser, even when deployed in a headless environment.
- **Personal Research Library**: Save journals, generate APA/MLA citations, and filter through your collection with a high-performance React dashboard.
- **Premium Tier System**: Secure authentication with email verification and a token-based premium activation system.
- **Advanced Analytics**: Quantitative analysis of journal trends using a Python-based processing engine.

---

## Modern Architecture

LitAssist is built with a modular, high-performance tech stack:

-   **Frontend**: 
    -   React 19 & TypeScript
    -   Vite for blazing fast builds
    -   Tailwind CSS 4 & Shadcn/UI for a sleek, responsive design
    -   Framer Motion for smooth micro-animations
    -   Zustand for lightweight state management
-   **Backend**: 
    -   Node.js (Express 5)
    -   MongoDB (Mongoose) for robust data persistence
    -   Socket.IO for real-time bidirectional communication
    -   Resend for transactional email support
-   **Scraper Engine**: Node.js + Puppeteer (Stealth Plugin)
-   **Data Processor**: Python 3 + Pandas for statistical transformation

---

## Project Structure

```text
├── web/                    # Express.js API & Backend
│   ├── client/             # React (Vite) Frontend Application
│   │   ├── src/            # Frontend source code (Pages, Components, Stores)
│   │   └── public/         # Frontend static assets
│   ├── tests/              # Integration and unit tests
│   ├── public/             # PWA assets and static icons
│   ├── logger.js           # Centralized logging system (Winston)
│   ├── start.sh            # Production startup script (Xvfb + noVNC + Web)
│   └── server.js           # Main Express server and Socket handlers
├── scraper/                # Node.js browser automation engine
│   ├── config.js           # Quality thresholds and scraper settings
│   └── index.js            # Core Puppeteer scraping logic
├── processor/              # Python data analysis scripts
│   ├── main.py             # Data cleaning and transformation logic
│   └── requirements.txt    # Python dependencies (Pandas, XlsxWriter)
├── scripts/                # Administrative utilities
│   └── backup.sh           # Database and data backup automation
├── backups/                # Storage for automated snapshots
├── data/                   # Persistent storage for JSON & XLSX output
├── Dockerfile              # Universal multi-stage deployment image
└── docker-compose.yml       # Orchestration for Web + MongoDB + Ngrok
```

---

## Quick Start (Docker - Recommended)

The easiest way to run LitAssist is using Docker Compose.

1.  **Clone & Configure**:
    ```bash
    cp .env.example .env
    ```
2.  **Spin up Services**:
    ```bash
    docker-compose up -d
    ```
3.  **Access**:
    -   **Dashboard**: http://localhost:3000
    -   **noVNC (for CAPTCHA)**: http://localhost:6080

---

## Manual Installation

If you prefer to run components separately:

### 1. Web & Client
```bash
cd web
npm install
cd client
npm install && npm run build
cd ..
node server.js
```

### 2. Scraper CLI Reference

For advanced automation, the scraper supports several command-line arguments:

```bash
node index.js [keyword] [deleteOld] [source] [apiKey] [yearFrom] [yearTo] [limit] [jobId]
```

| Argument | Default | Description |
| :--- | :--- | :--- |
| `keyword` | `""` | Search terms for Google Scholar. |
| `deleteOld` | `n` | `y` to clear previous data before starting. |
| `source` | `scholar` | Search engine source (default: `scholar`). |
| `yearFrom` | `2020` | Filter journals starting from this year. |
| `yearTo` | `current` | Filter journals up to this year. |
| `limit` | `10` | Maximum number of journals to scrape (max: 50). |
| `jobId` | `standalone`| Unique identifier for the scraping session. |

### 3. Processor
```bash
cd processor
pip install -r requirements.txt
python main.py
```

---

## Environment Variables

Ensure these are set in your .env file:

| Variable | Description |
| :--- | :--- |
| MONGO_URI | MongoDB connection string (e.g., `mongodb://localhost:27017/litassist`) |
| SESSION_SECRET | Secure string for session encryption |
| GEMINI_API_KEY | API Key from Google AI Studio (Model: Gemini 2.5 Flash) |
| RESEND_API_KEY | API Key from Resend for transactional emails |
| APP_URL | Base URL of your deployment (e.g., `https://litassist.io`) |

---

## Administrator Guide

### Initial Setup
The system follows a **first-come, first-served** admin rule. The **first user to register** an account via the `/api/auth/register` endpoint will automatically be granted the `admin` role. All subsequent registrations will be assigned the `user` role by default.

### Admin Features
- **User Management**: View and manage all registered researchers.
- **Premium Tokens**: Generate unique activation tokens for users.
- **Quota Control**: Monitor and adjust scraping/AI usage limits.
- **System Logs**: Access detailed application logs for troubleshooting.

---

## PWA Support
LitAssist is built as a **Progressive Web App**. Once the web application is running, you can:
- **Install on Desktop/Mobile**: Use the "Add to Home Screen" or "Install App" feature in your browser.
- **Offline Access**: Basic UI elements and cached journals are accessible even without an internet connection.
- **Service Worker Integration**: Automated background updates and asset caching for faster load times.

---

## Optimization & Performance
For production environments, run the performance optimization script:
```bash
cd web
chmod +x setup-perf.sh
./setup-perf.sh
```
This script configures Gzip compression, ETag handling, and static asset caching for maximum efficiency.

---

## Roadmap & Limitations

-   **PDF Parsing**: Currently identifies PDF matches but does not extract internal text (Coming soon).
-   **Publisher Support**: Some publishers (Elsevier, IEEE) require manual intervention via the visible noVNC window.
-   **Database Auto-Sync**: Currently syncing raw JSON to MongoDB via the admin panel.

---
