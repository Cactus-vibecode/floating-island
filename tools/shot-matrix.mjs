// 一次性渲染 4 季 × 3 时段 的对照图（用于方案确认）
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const outDir = process.argv[2] || '/private/tmp/cmp/matrix';
const size = Number(process.argv[3] || 560);
const hours = [7.5, 13, 21];
const seasons = [0, 1, 2, 3];

fs.mkdirSync(outDir, { recursive: true });

let b;
const shot = async (season, hour) => {
  const p = await b.newPage();
  await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await p.goto(
    'file://' + path.resolve('dist/index.html') + `?widget&clean&season=${season}&hour=${hour}&zoom=1`,
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );
  await new Promise((r) => setTimeout(r, 2600));
  const f = `${outDir}/s${season}_h${hour}.png`;
  await p.screenshot({ path: f });
  await p.close();
  console.log('->', f);
};

for (let attempt = 0; attempt < 3; attempt++) {
  try {
    b = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: 'new',
      args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
    });
    for (const s of seasons) for (const h of hours) await shot(s, h);
    break;
  } catch (e) {
    console.log('retry', String(e).slice(0, 80));
  } finally {
    if (b) await b.close().catch(() => {});
  }
}
