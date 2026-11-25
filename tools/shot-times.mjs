// 按多个时间点截同一季节，用于评估"日出/日落/夜晚"效果
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const season = process.argv[2] || '1';
const hourList = (process.argv[3] || '6.4,7.2,17.9,19.2,21.5').split(',');
const outDir = process.argv[4] || '/tmp/cmp/times';
const size = Number(process.argv[5] || 620);

import fs from 'node:fs';
fs.mkdirSync(outDir, { recursive: true });

for (const hour of hourList) {
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
      await p.setViewport({ width: size, height: size });
      await new Promise((r) => setTimeout(r, 200));
      await p.goto(
        'file://' + path.resolve('dist/index.html') + `?widget&season=${season}&hour=${hour}&zoom=1`,
        { waitUntil: 'domcontentloaded', timeout: 25000 }
      );
      await new Promise((r) => setTimeout(r, 2400));
      const f = `${outDir}/s${season}_h${hour}.png`;
      await p.screenshot({ path: f });
      console.log('->', f);
      ok = true;
    } catch (e) {
      console.log('retry', hour, String(e).slice(0, 50));
    } finally {
      if (b) await b.close().catch(() => {});
    }
  }
}
