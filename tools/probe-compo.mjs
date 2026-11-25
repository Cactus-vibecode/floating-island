// 输出「正视图 + 构图关键点投影」：同一帧内冻结旋转、投影、截图，保证标注与画面严格对齐
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const SIZE = Number(process.argv[2] || 1000);
const OUT = process.argv[3] || '/tmp/compo';
fs.mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: SIZE, height: SIZE });
await p.goto(
  'file://' + path.resolve('dist/index.html') + '?widget&clean&debug&season=0&hour=12.5&zoom=1',
  { waitUntil: 'domcontentloaded' }
);
await new Promise((r) => setTimeout(r, 2600));

const pts = await p.evaluate((SIZE) => {
  const g = window.__isl.group;
  g.rotation.y = 0; // 冻结正视图，配色与投影都基于这一帧

  const T = window.__three, cam = window.__cam, terrain = window.__terrain;
  const P = [
    ['peak', -1.16, -1.00, -0.13],
    ['shrine', -0.60, 0.03, 0.60],
    ['torii', -0.50, 0.76, 0.44],
    ['stream', 1.42, 1.20, 0.02],
    ['meadow', -0.55, 1.62, 0.02],
    ['rim', 2.70, 1.42, -0.22],
  ];
  return P.map(([k, x, z, dy]) => {
    const v = new T.Vector3(x, terrain(x, z) + dy, z).project(cam);
    return { k, px: Math.round((v.x * 0.5 + 0.5) * SIZE), py: Math.round((-v.y * 0.5 + 0.5) * SIZE) };
  });
}, SIZE);

await p.screenshot({ path: path.join(OUT, 'base.png'), omitBackground: true });
console.log(JSON.stringify(pts));
fs.writeFileSync(path.join(OUT, 'pts.json'), JSON.stringify(pts));
await b.close();
