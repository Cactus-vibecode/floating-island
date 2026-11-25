// 为「冬季灯笼」设计稿测屏幕位置：给定世界点，输出地形高度 + 620 视口像素坐标
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
  const T = window.__three, cam = window.__cam, ter = window.__terrain;
  // 鸟居/参道基准（与 shrine.js 一致的换算）
  const S = { x: -0.66, z: 0.03, yaw: 0.22 };
  const cs = Math.cos(S.yaw), sn = Math.sin(S.yaw);
  const toW = (lx, lz) => [S.x + lx * cs + lz * sn, S.z - lx * sn + lz * cs];

  const pts = {
    提灯_左: { l: [0.10, 0.248], h: 0.42 },
    提灯_中: { l: [0.00, 0.248], h: 0.42 },
    提灯_右: { l: [-0.10, 0.248], h: 0.42 },
    石灯_左: { w: [0.26, 0.34], h: 0.0 },
    石灯_右: { w: [-0.26, 0.34], h: 0.0 },
    雪洞_左: { w: [-1.30, 1.75], h: 0.0 },
    雪洞_右: { w: [0.35, 1.72], h: 0.0 },
    雪洞_远: { w: [-0.55, 1.95], h: 0.0 },
  };

  const res = {};
  for (const [k, v] of Object.entries(pts)) {
    let x, z;
    if (v.l) { [x, z] = toW(v.l[0], v.l[1]); }
    else { [x, z] = toW(v.w[0], v.w[1]); }
    const y = ter(x, z) + (v.h || 0);
    const pv = new T.Vector3(x, y, z).project(cam);
    res[k] = {
      x: +x.toFixed(3), z: +z.toFixed(3), y: +y.toFixed(3),
      px: Math.round((pv.x * 0.5 + 0.5) * SIZE), py: Math.round((-pv.y * 0.5 + 0.5) * SIZE),
    };
  }
  return res;
}, SIZE);

console.log(JSON.stringify(out, null, 1));
await b.close();
