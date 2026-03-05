# Journal Scraper Pipeline

A hybrid automation tool designed to collect, extract, and analyze academic journal data from Google Scholar and various publisher portals.

## Overview
This project uses a two-stage pipeline to assist in literature reviews:
1. **Scraper (Node.js + Puppeteer):** An interactive script that searches for journals based on user input, navigates to publisher websites, and extracts full abstracts.
2. **Processor (Python + Pandas):** A data processing script that cleans the raw JSON data, categorizes key points (Methods, Results, Context), and exports the results into a formatted Excel file.

## Features
- **Interactive CLI:** Input search keywords directly in the terminal.
- **Deep Scraping:** Attempts to bypass snippets to fetch full abstracts from source websites (OJS, Springer, Oxford, etc.).
- **Metadata Extraction:** Automatically identifies the publication year and identifies direct PDF links.
- **Automated Categorization:** Uses keyword matching to flag research methods and findings in both English and Indonesian.
- **Formatted Output:** Generates an Excel file with optimized column widths and text wrapping for readability.

## Tech Stack
- **Node.js:** Puppeteer (Browser automation)
- **Python:** Pandas (Data manipulation), XlsxWriter (Excel formatting)
- **Data Interchange:** JSON

## Project Structure
- `/scraper`: Contains the Node.js source code and dependencies.
- `/processor`: Contains the Python script for data transformation.
- `/data`: Storage for the intermediate `jurnal_mentah.json` and the final `jurnal_siap_skripsi.xlsx`.

## Limitations
- `Bot Protection`: Some high-security publishers (e.g., Elsevier, IEEE) may block automated access or require CAPTCHA.
- `PDF Extraction`: The tool identifies PDF links but does not parse text directly from PDF files.
- `Data Availability`: If a full abstract is not found on the landing page, the tool will fall back to the Google Scholar snippet.