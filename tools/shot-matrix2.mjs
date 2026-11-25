// 四季 × 三时段 12 态透明底渲染（用于设计确认板合成）
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const SIZE = Number(process.argv[2] || 800);
const outDir = process.argv[3] || '/tmp/m12';
fs.mkdirSync(outDir, { recursive: true });

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const PERIODS = [
  ['morning', '7.2'],
  ['noon', '12.5'],
  ['night', '20.2'],
];

for (let s = 0; s < 4; s++) {
  for (const [pk, hour] of PERIODS) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      let b;
      try {
        b = await puppeteer.launch({
          executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          headless: 'new',
          args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
        });
        const p = await b.newPage();
        p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 120)));
        await p.setViewport({ width: SIZE, height: SIZE });
        await new Promise((r) => setTimeout(r, 180));
        await p.goto(
          'file://' + path.resolve('dist/index.html') + `?widget&clean&season=${s}&hour=${hour}&zoom=1`,
          { waitUntil: 'domcontentloaded', timeout: 25000 }
        );
        await new Promise((r) => setTimeout(r, 2600));
        const f = `${outDir}/island_${SEASONS[s]}_${pk}.png`;
        await p.screenshot({ path: f, omitBackground: true });
        console.log('->', f);
        ok = true;
      } catch (e) {
        console.log('retry', SEASONS[s], pk, String(e).slice(0, 50));
      } finally {
        if (b) await b.close().catch(() => {});
      }
    }
  }
}
