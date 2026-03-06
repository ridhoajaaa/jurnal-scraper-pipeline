# Journal Scraper Pipeline & Dashboard

A full-stack automation tool designed to collect, extract, analyze, and visualize academic journal data from Google Scholar and various publisher portals.

## Overview
This project uses a three-stage pipeline to assist in literature reviews for academic research:
1. **Scraper (Node.js + Puppeteer):** An interactive script that searches for journals, navigates to publisher websites, and extracts deep abstracts while bypassing snippets.
2. **Processor (Python + Pandas):** A data processing script that cleans raw JSON data, removes duplicates, categorizes key points (Methods, Results, Context), and generates both Excel and cleaned JSON files.
3. **Web Dashboard (Node.js + Express + Tailwind CSS):** A modern, interactive web interface to explore, filter, and compare collected literature with built-in Dark Mode support.

## Key Features
- **Deep Scraping v5.0:** Automatically navigates into publisher pages (OJS, Springer, Oxford, etc.) to fetch full abstracts.
- **Intelligent Filtering:** Automatically separates academic journals from book previews and citations.
- **Bilingual Analysis:** Flagging research methods and findings in both English and Indonesian using keyword heuristics.
- **Interactive Dashboard:** 
    - Real-time search and year filtering.
    - Specialized tabs for Journals and Books.
    - Automatic Citation Generator (APA Style).
    - Responsive design with **Dark Mode** persistence.
- **Safety Features:** Built-in CAPTCHA detection and random delays to prevent IP blocking.

## Tech Stack
- **Backend/Scraper:** Node.js, Puppeteer, Express.js
- **Data Science:** Python 3, Pandas, XlsxWriter
- **Frontend:** HTML5, Tailwind CSS, Alpine.js (for UI interactivity)
- **Data Interchange:** JSON & XLSX

## Project Structure
- `/scraper`: Node.js source code for the browser automation engine.
- `/processor`: Python scripts for data transformation and categorical analysis.
- `/web`: Express server and public frontend assets (Dashboard).
- `/data`: Storage for raw and processed datasets.

## Installation & Usage

### 1. Scraper Setup

```bash
cd scraper
npm install
node index.js
```

### 2. Processor Setup

```bash
cd processor
pip install pandas xlsxwriter
python main.py
```

### 3. Web Dashboard Setup

```bash
cd web
npm install
node server.js
```

## Limitations

- `Access Restrictions`: Some high-security publishers (e.g., Elsevier, IEEE) may enforce CAPTCHA or paywalls that require manual intervention via the visible browser window.
- `PDF Scoping`: The current engine identifies direct PDF links but does not perform internal text parsing on PDF files.
- `Metadata Fallback`: If a deep abstract is blocked by a server, the tool automatically falls back to the Google Scholar snippet to maintain dataset continuity.