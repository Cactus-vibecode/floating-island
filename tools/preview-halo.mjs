// 预览"搬动时岛外围一圈提示"的视觉效果（白 / 米色 / 深色桌面各一张）
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bgs = [
  { name: 'white', bg: '#FFFFFF', out: '/tmp/halo_white.png' },
  { name: 'light', bg: '#F2F0EB', out: '/tmp/halo_light.png' },
  { name: 'dark', bg: '#22262B', out: '/tmp/halo_dark.png' },
];
const url = 'file://' + path.resolve(root, 'dist/index.html') + '?widget&season=2&hour=11';

const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  defaultViewport: { width: 600, height: 600 },
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});

for (const { name, bg, out } of bgs) {
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    const p = await b.newPage();
    try {
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise((r) => setTimeout(r, 2400));
      await p.evaluate((bg) => {
        document.documentElement.style.background = bg;
        document.body.style.background = bg;
        const halo = document.getElementById('halo');
        const label = document.getElementById('haloLabel');
        halo.style.left = '34px';
        halo.style.top = '58px';
        halo.style.width = '532px';
        halo.style.height = '470px';
        halo.classList.add('on');
        label.classList.add('on');
        const whint = document.getElementById('whint');
        if (whint) whint.style.opacity = '0';
      }, bg);
      await new Promise((r) => setTimeout(r, 700));
      await p.screenshot({ path: out });
      console.log(name, '->', out);
      ok = true;
    } catch (e) {
      console.log(name, 'retry', attempt, String(e).slice(0, 70));
    } finally {
      await p.close();
    }
  }
}
await b.close();
