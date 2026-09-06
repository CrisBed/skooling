const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || 'page.png';
  const scale = Number(process.argv[3] || 1);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1536 }, deviceScaleFactor: scale });
  await page.goto('file://' + path.join(__dirname, '..', 'GIORNALINO-RUGBY-numero-zero.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  // controllo testi tagliati: elementi che escono dai loro contenitori o dalla pagina
  const overflow = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('div').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > 1024 + 0.5 || r.bottom > 1536 + 0.5) bad.push('fuori pagina: ' + el.textContent.trim().slice(0, 40));
      if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflow !== 'hidden' && el.textContent.trim()) bad.push('trabocca: ' + el.textContent.trim().slice(0, 40) + ' ' + el.scrollHeight + '>' + el.clientHeight);
    });
    return bad;
  });
  console.log('controllo overflow:', overflow.length ? overflow : 'ok');
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1024, height: 1536 } });
  await browser.close();
  console.log('scritto', out);
})();
