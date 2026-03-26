const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    try {
        const searchUrl = 'https://www.semanticscholar.org/search?q=deep+learning&sort=relevance&year%5B0%5D=2024&year%5B1%5D=2026';
        console.log('Navigating to:', searchUrl);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));
        const html = await page.content();
        console.log('HTML Length:', html.length);
        const fs = require('fs');
        fs.writeFileSync('search_results.html', html);
        
        const count = await page.evaluate(() => {
            return document.querySelectorAll('[data-test-id="search-result"], .cl-paper-row, article').length;
        });
        console.log('Candidate Count:', count);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
}
run();
