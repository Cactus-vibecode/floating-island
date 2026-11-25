// 四季总览截图（每季独立开一个浏览器，避免连续 WebGL 页面把渲染进程拖崩）
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const out = process.argv[2] || '/tmp';
const size = Number(process.argv[3] || 760);
const zoom = process.argv[4] || '1';
const only = process.argv[5];

for (let s = 0; s < 4; s++) {
  if (only && String(s) !== only) continue;
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    const b = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: 'new',
      args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
    });
    try {
      const p = await b.newPage();
      p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
      await p.setViewport({ width: size, height: size });
      await p.goto('file://' + path.resolve('dist/index.html') + `?widget&season=${s}&hour=11&zoom=${zoom}`, {
        waitUntil: 'domcontentloaded', timeout: 25000,
      });
      await new Promise((r) => setTimeout(r, 2800));
      await p.evaluate(() => {
        document.documentElement.style.background = '#EDEAE3';
        document.body.style.background = '#EDEAE3';
        const wh = document.getElementById('whint');
        if (wh) wh.style.opacity = '0';
      });
      await new Promise((r) => setTimeout(r, 400));
      const f = `${out}/life_s${s}.png`;
      await p.screenshot({ path: f });
      console.log('->', f);
      ok = true;
    } catch (e) {
      console.log('retry', s, String(e).slice(0, 50));
    } finally {
      await b.close();
    }
  }
}
