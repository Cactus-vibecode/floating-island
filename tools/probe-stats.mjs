// 统计场景规模：绘制调用、三角形、实例数、树/草/花数量
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const b = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 900, height: 900 });
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&clean&debug&season=3&hour=20.2&zoom=1', {
  waitUntil: 'domcontentloaded',
});
await new Promise((r) => setTimeout(r, 2600));
const out = await p.evaluate(() => {
  const info = window.__renderer.info;
  let instanced = 0, meshes = 0, sprites = 0, lights = 0;
  window.__scene.traverse((o) => {
    if (o.isInstancedMesh) instanced += o.count;
    else if (o.isMesh) meshes++;
    else if (o.isSprite) sprites++;
    if (o.isLight) lights++;
  });
  const isl = window.__isl;
  return {
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    programs: info.programs?.length ?? null,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    instancedTotal: instanced,
    meshes, sprites, lights,
    trees: isl.trees?.length ?? null,
  };
});
console.log(JSON.stringify(out, null, 1));
await b.close();
