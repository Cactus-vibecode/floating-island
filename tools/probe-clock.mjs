// 校验「不传 hour 时是否跟随系统时钟」：读回 nightSky 不透明度（= lamp 强度）
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const b = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 700, height: 700 });
await p.goto('file://' + path.join(root, 'dist/index.html') + '?widget&debug&season=2', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 2200));

const out = await p.evaluate(() => ({
  href: location.search,
  lampOpacity: +(document.getElementById('nightSky')?.style.opacity || 0),
  hour: window.__light ? +window.__light().hour.toFixed(2) : null,
  exposure: window.__light ? +window.__light().exposure.toFixed(3) : null,
  key: window.__light ? +window.__light().key.toFixed(2) : null,
}));
const sys = new Date();
const sysHour = +(sys.getHours() + sys.getMinutes() / 60).toFixed(2);
console.log(JSON.stringify({ ...out, sysHour, diff: out.hour === null ? null : +(out.hour - sysHour).toFixed(2) }, null, 1));
await p.screenshot({ path: '/tmp/clock_now.png', omitBackground: true });
await b.close();
