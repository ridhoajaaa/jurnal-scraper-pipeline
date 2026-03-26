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
        console.log('Navigating to paper page...');
        await page.goto('https://www.semanticscholar.org/paper/10.1109/CVPR.2016.91', { waitUntil: 'networkidle2', timeout: 60000 });
        const html = await page.content();
        console.log('HTML Length:', html.length);
        const fs = require('fs');
        fs.writeFileSync('paper_detail.html', html);
        console.log('Saved HTML to paper_detail.html');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
}
run();
