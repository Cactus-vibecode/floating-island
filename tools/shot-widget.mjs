// 用 puppeteer 预览"摆件模式"（比反复启 Electron 稳）
import puppeteer from 'puppeteer-core';
import path from 'node:path';
const [,, out = 'shots/wzoom.png', size = '700', query = 'widget&season=2&hour=10'] = process.argv;
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: +size, height: +size });
await p.goto('file://' + path.resolve('dist/index.html') + '?' + query, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1800));
await p.screenshot({ path: out, omitBackground: true });
await b.close();
console.log('->', out);
