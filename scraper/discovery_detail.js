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
        const url = 'https://www.semanticscholar.org/paper/Deep-learning-and-computer-vision-in-plant-disease-Upadhyay-Chandel/5596e27d38f47e80b76ae133a0e5768840e1f249';
        console.log('Visiting:', url);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));
        
        const data = await page.evaluate(() => {
            const selectors = [
                '[data-test-id="abstract-text"]',
                '.cl-paper-abstract',
                '.abstract__text',
                '.paper-detail-page__abstract',
                'meta[name="description"]'
            ];
            const results = {};
            selectors.forEach(s => {
                const el = document.querySelector(s);
                results[s] = el ? { text: el.innerText?.slice(0, 100), length: el.innerText?.length } : 'MISSING';
            });
            return results;
        });
        console.log('Selectors Result:', JSON.stringify(data, null, 2));
        
        const html = await page.content();
        const fs = require('fs');
        fs.writeFileSync('detail_dump.html', html);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
}
run();
