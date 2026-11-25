import puppeteer from 'puppeteer-core';
import path from 'node:path';

async function run() {
  const b = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  });
  try {
    const p = await b.newPage();
    await new Promise((r) => setTimeout(r, 250));
    await p.setViewport({ width: 420, height: 420 });
    await p.goto('file://' + path.resolve('dist/index.html') + '?debug&widget&season=1', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise((r) => setTimeout(r, 3000));
    const out = await p.evaluate(() => {
      const r = window.__renderer;
      const info = r.info;
      let flowers = 0;
      const fg = window.__life.groups.flowerGroup;
      fg.traverse((o) => { if (o.isInstancedMesh) flowers += o.count; });
      return { calls: info.render.calls, tris: info.render.triangles, geoms: info.memory.geometries, tex: info.memory.textures, flowers };
    });
    console.log(JSON.stringify(out));
  } finally {
    await b.close();
  }
}
let ok = false;
for (let i = 0; i < 4 && !ok; i++) { try { await run(); ok = true; } catch (e) { console.log('retry', String(e).slice(0, 40)); } }
