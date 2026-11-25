import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath:process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({width:800,height:800});
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&clean&debug&season=3&hour=20.2&zoom=1', {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,2200));
// A: 隐藏夜空 DOM
await p.evaluate(() => { const e=document.getElementById('nightSky'); if(e) e.style.display='none'; });
await new Promise(r=>setTimeout(r,400));
await p.screenshot({ path:'/tmp/moon_noSky.png', omitBackground:true });
// B: 恢复夜空，隐藏冬季灯笼
await p.evaluate(() => { const e=document.getElementById('nightSky'); if(e) e.style.display=''; if(window.__winter) window.__winter.group.visible=false; });
await new Promise(r=>setTimeout(r,400));
await p.screenshot({ path:'/tmp/moon_noWinter.png', omitBackground:true });
// C: 只隐藏灯串
await p.evaluate(() => { if(window.__winter) window.__winter.group.visible=true; if(window.__lanterns) window.__lanterns.group.visible=false; });
await new Promise(r=>setTimeout(r,400));
await p.screenshot({ path:'/tmp/moon_noLampStr.png', omitBackground:true });
console.log('done');
await b.close();
