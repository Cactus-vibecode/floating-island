// 超高倍局部：node tools/zoom-hi.mjs <season> <cx> <cy> <size> <scale> [out]
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const [, , season = '1', cx = '350', cy = '400', size = '60', scale = '6', out = '/tmp/hi.png'] = process.argv;

async function run() {
  const b = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });
  const p = await b.newPage();
  await new Promise((r) => setTimeout(r, 250));
  await p.setViewport({ width: 700, height: 700, deviceScaleFactor: +scale });
  await p.goto('file://' + path.resolve('dist/index.html') + `?widget&season=${season}&hour=11`, {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });
  await new Promise((r) => setTimeout(r, 3200));
  await p.evaluate(() => {
    document.documentElement.style.background = '#EDEAE3';
    document.body.style.background = '#EDEAE3';
    const wh = document.getElementById('whint');
    if (wh) wh.style.opacity = '0';
  });
  await new Promise((r) => setTimeout(r, 300));
  await p.screenshot({
    path: out,
    clip: { x: +cx - +size / 2, y: +cy - +size / 2, width: +size, height: +size },
  });
  await b.close();
}

let done = false;
for (let i = 0; i < 4 && !done; i++) {
  try { await run(); console.log('->', out); done = true; } catch (e) { console.log('retry', String(e).slice(0, 40)); }
}
