/**
 * Discovery Scraper - Unified module for paper/search/detail scraping
 * Replaces: discovery.js, discovery_search.js, discovery_detail.js
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const CONFIG = require('./config');

puppeteer.use(StealthPlugin());

/**
 * Scrape a single paper page
 * @param {string} url - URL to scrape
 * @param {Object} options - Options
 * @param {string} options.outputFile - Output HTML file path
 * @param {number} options.waitTime - Wait time in ms (default: 0)
 * @returns {Promise<number>} - HTML length
 */
async function scrapePaper(url, options = {}) {
    const { outputFile = 'paper_detail.html', waitTime = 0 } = options;

    const browser = await puppeteer.launch({
        headless: CONFIG.BROWSER.HEADLESS,
        args: CONFIG.BROWSER.ARGS
    });

    try {
        const page = await browser.newPage();
        console.log(`[Discovery] Navigating to paper: ${url}`);

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.TIMEOUT.NAVIGATION
        });

        if (waitTime > 0) {
            await new Promise(r => setTimeout(r, waitTime));
        }

        const html = await page.content();
        fs.writeFileSync(outputFile, html);
        console.log(`[Discovery] Saved paper HTML to ${outputFile} (${html.length} chars)`);

        return html.length;
    } catch (err) {
        console.error(`[Discovery] Failed to scrape paper: ${err.message}`);
        throw err;
    } finally {
        await browser.close();
    }
}

/**
 * Scrape search results page
 * @param {string} url - Search URL to scrape
 * @param {Object} options - Options
 * @param {string} options.outputFile - Output HTML file path
 * @param {number} options.waitTime - Wait time in ms (default: 5000)
 * @returns {Promise<number>} - Number of results found
 */
async function scrapeSearch(url, options = {}) {
    const { outputFile = 'search_results.html', waitTime = 5000 } = options;

    const browser = await puppeteer.launch({
        headless: CONFIG.BROWSER.HEADLESS,
        args: CONFIG.BROWSER.ARGS
    });

    try {
        const page = await browser.newPage();
        console.log(`[Discovery] Navigating to search: ${url}`);

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.TIMEOUT.NAVIGATION
        });

        if (waitTime > 0) {
            await new Promise(r => setTimeout(r, waitTime));
        }

        const html = await page.content();
        fs.writeFileSync(outputFile, html);

        // Count results using multiple possible selectors
        const count = await page.evaluate(() => {
            const selectors = [
                '[data-test-id="search-result"]',
                '.cl-paper-row',
                'article',
                '.gs_ri',  // Google Scholar
                '.search-result'
            ];
            for (const sel of selectors) {
                const el = document.querySelectorAll(sel);
                if (el.length > 0) return el.length;
            }
            return 0;
        });

        console.log(`[Discovery] Saved search HTML to ${outputFile} (${html.length} chars)`);
        console.log(`[Discovery] Found ${count} result(s)`);

        return count;
    } catch (err) {
        console.error(`[Discovery] Failed to scrape search: ${err.message}`);
        throw err;
    } finally {
        await browser.close();
    }
}

/**
 * Generic scrape function (legacy compatibility)
 * @param {Object} params - Parameters
 * @param {string} params.type - 'paper' | 'search'
 * @param {string} params.url - URL to scrape
 * @param {string} params.outputFile - Output file
 * @param {number} params.waitTime - Wait time
 */
async function scrape({ type, url, outputFile, waitTime }) {
    if (type === 'paper') {
        return scrapePaper(url, { outputFile, waitTime });
    } else if (type === 'search') {
        return scrapeSearch(url, { outputFile, waitTime });
    } else {
        throw new Error(`Unknown scrape type: ${type}`);
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'paper' && args[1]) {
        scrapePaper(args[1], {
            outputFile: args[2] || 'paper_detail.html',
            waitTime: parseInt(args[3]) || 0
        }).catch(() => process.exit(1));
    } else if (command === 'search' && args[1]) {
        scrapeSearch(args[1], {
            outputFile: args[2] || 'search_results.html',
            waitTime: parseInt(args[3]) || 5000
        }).catch(() => process.exit(1));
    } else {
        console.log('Usage:');
        console.log('  node discovery.js paper <url> [outputFile] [waitTime]');
        console.log('  node discovery.js search <url> [outputFile] [waitTime]');
        console.log('');
        console.log('Examples:');
        console.log('  node discovery.js paper "https://semanticscholar.org/paper/..."');
        console.log('  node discovery.js search "https://semanticscholar.org/search?q=..." results.html 5000');
        process.exit(1);
    }
}

module.exports = { scrape, scrapePaper, scrapeSearch };
