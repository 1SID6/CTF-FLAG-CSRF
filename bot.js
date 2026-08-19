const puppeteer = require('puppeteer');

async function visitUrl(url) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote'
        ]
    });

    try {
        const page = await browser.newPage();
        
        // Log in as admin
        const port = process.env.PORT || 3000;
        await page.goto(`http://127.0.0.1:${port}/login`);
        await page.type('input[name="username"]', 'admin');
        await page.type('input[name="password"]', 'password');
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]'),
        ]);

        // Visit the target URL
        console.log(`Bot visiting: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 5000 });
        
        // Give it a second to execute any JS or redirects
        await new Promise(resolve => setTimeout(resolve, 1000));
        
    } catch (err) {
        console.error(`Error in bot: ${err.message}`);
        throw err;
    } finally {
        await browser.close();
    }
}

module.exports = { visitUrl };
