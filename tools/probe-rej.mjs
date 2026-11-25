import puppeteer from 'puppeteer-core';
import path from 'node:path';
const b = await puppeteer.launch({ executablePath:process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.setViewport({width:600,height:600});
await p.goto('file://' + path.resolve('dist/index.html') + '?widget&debug&season=1&hour=13', {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,1200));
console.log(JSON.stringify(await p.evaluate(() => window.__treeRej||[])));
await b.close();
