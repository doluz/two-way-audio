const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // <-- run in non-headless for now
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',  // <-- enables mic access without prompt
      '--use-fake-device-for-media-stream', // optional: mock audio input
    ]
  });

  const page = await browser.newPage();

  page.on('console', msg => console.log('🧠 BROWSER:', msg.text()));
  page.on('pageerror', err => console.error('🔴 PAGE ERROR:', err));

  await page.goto('https://www.rime.ai/', { waitUntil: 'networkidle2' });

  console.log("✅ Page loaded. Clicking button...");

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.textContent.toLowerCase().includes('live chat'));
    if (btn) btn.click();
  });

  console.log("✅ Live Chat button clicked. Evaluating audio script...");

  // Debug version of evaluate
  await page.evaluate(() => {
    console.log("✅ Starting browser-side WebSocket + audio init...");
  });

  console.log("✅ evaluate() completed.");

})();
