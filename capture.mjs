import puppeteer from 'puppeteer-core';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = Number(process.env.W || 600);
const H = Number(process.env.H || 600);
const FPS = Number(process.env.FPS || 10);
const FRAMES = Number(process.env.FRAMES || 120);
const OUT = process.env.OUT || 'dist/cactus-card.gif';
const FRAME_DIR = process.env.FRAME_DIR || 'build/frames2';

fs.mkdirSync(FRAME_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('file://' + path.resolve('dist/index.html') + '?capture', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 700));

const ok = await page.evaluate(() => typeof window.__warm === 'function');
if (!ok) throw new Error('capture hooks missing');
await page.evaluate(() => window.__warm(260));

const t0 = Date.now();
for (let i = 0; i < FRAMES; i++) {
  await page.evaluate((n) => window.__step(n), i);
  await page.screenshot({ path: path.join(FRAME_DIR, `${String(i).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  if (i % 20 === 0) process.stdout.write(`  frame ${i}/${FRAMES}\r`);
}
await browser.close();
console.log(`\nrendered ${FRAMES} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const sample = [];
for (let i = 0; i < FRAMES; i += 6) {
  const png = PNG.sync.read(fs.readFileSync(path.join(FRAME_DIR, `${String(i).padStart(4, '0')}.png`)));
  sample.push(png.data);
}
const merged = Buffer.concat(sample);
const palette = quantize(merged, Number(process.env.COLORS || 256), { format: 'rgb565' });
console.log(`palette: ${palette.length} colors from ${sample.length} samples`);

const gif = GIFEncoder();
const delay = Math.round(1000 / FPS);
for (let i = 0; i < FRAMES; i++) {
  const png = PNG.sync.read(fs.readFileSync(path.join(FRAME_DIR, `${String(i).padStart(4, '0')}.png`)));
  const index = applyPalette(png.data, palette, 'rgb565');
  gif.writeFrame(index, W, H, { palette: i === 0 ? palette : undefined, delay, repeat: 0, dispose: 1 });
}
gif.finish();
const bytes = gif.bytes();
fs.writeFileSync(OUT, bytes);
console.log(`${OUT}  ${(bytes.length / 1024 / 1024).toFixed(2)} MB  ${W}x${H} @${FPS}fps ${FRAMES}f`);
