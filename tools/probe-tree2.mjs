// 输出冬季树的位置 + 620 视口像素坐标，用于设计稿里标注「树挂挑杆灯笼」
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const SIZE = Number(process.argv[2] || 620);
const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: SIZE, height: SIZE });
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=3&hour=8&zoom=1', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 2200));

const out = await p.evaluate((SIZE) => {
  const T = window.__three, cam = window.__cam, isl = window.__isl;
  return (isl?.trees || []).map((t) => {
    const pv = new T.Vector3(t.x, t.y + 0.62 * t.s, t.z).project(cam);
    return {
      x: +t.x.toFixed(2), z: +t.z.toFixed(2), sp: t.sp, s: +t.s.toFixed(2),
      px: Math.round((pv.x * 0.5 + 0.5) * SIZE), py: Math.round((-pv.y * 0.5 + 0.5) * SIZE),
      u: +((pv.x * 0.5 + 0.5)).toFixed(3), v: +((-pv.y * 0.5 + 0.5)).toFixed(3),
    };
  });
}, SIZE);

console.log(JSON.stringify(out));
await b.close();
