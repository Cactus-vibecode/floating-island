// 按指定 hour 截四季（模拟桌面摆件真实光照），每季独立浏览器 + 重试
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const out = process.argv[2] || '/tmp/cmp';
const hour = process.argv[3] || '16.3';
const size = Number(process.argv[4] || 700);
const only = process.argv[5];

for (let s = 0; s < 4; s++) {
  if (only !== undefined && String(s) !== only) continue;
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    let b;
    try {
      b = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: 'new',
        args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
      });
      const p = await b.newPage();
      p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 160)));
      await p.setViewport({ width: size, height: size });
      await new Promise((r) => setTimeout(r, 180));
      await p.goto(
        'file://' + path.resolve('dist/index.html') + `?widget&season=${s}&hour=${hour}&zoom=1`,
        { waitUntil: 'domcontentloaded', timeout: 25000 }
      );
      await new Promise((r) => setTimeout(r, 2400));
      const f = `${out}/h${hour}_s${s}.png`;
      await p.screenshot({ path: f });
      console.log('->', f);
      ok = true;
    } catch (e) {
      console.log('retry', s, String(e).slice(0, 60));
    } finally {
      if (b) await b.close().catch(() => {});
    }
  }
}
