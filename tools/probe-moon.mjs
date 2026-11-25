import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath:process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({width:800,height:800});
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&clean&debug&season=3&hour=20.2&zoom=1', {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,2200));
const out = await p.evaluate(() => {
  const m = document.querySelector('#nightSky .moon');
  const r = m?.getBoundingClientRect();
  const T = window.__three, cam = window.__cam;
  // 场景里所有 sprite 的屏幕位置
  const sprites = [];
  window.__scene.traverse(o => {
    if (o.isSprite) {
      const v = o.getWorldPosition(new T.Vector3()).project(cam);
      sprites.push({ x: Math.round((v.x*0.5+0.5)*800), y: Math.round((-v.y*0.5+0.5)*800), s: +o.scale.x.toFixed(3), op: +(o.material.opacity||0).toFixed(2) });
    }
  });
  return { moon: r && {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}, opacity: getComputedStyle(document.getElementById('nightSky')).opacity, sprites: sprites.filter(s=>s.op>0.05).slice(0,15) };
});
console.log(JSON.stringify(out,null,1));
await b.close();
