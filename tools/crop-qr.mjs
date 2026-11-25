import { PNG } from 'pngjs';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SRC = process.argv[2];
const OUT = process.argv[3] || 'assets/qr.png';

execSync(`sips -s format png "${SRC}" --out assets/_qr_src.png`, { stdio: 'ignore' });
const png = PNG.sync.read(fs.readFileSync('assets/_qr_src.png'));
const { width: W, height: H, data } = png;

let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (W * y + x) << 2;
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const alpha = data[i + 3];
    if (alpha > 20 && lum < 235) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
}

const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.055);
x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);

const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
const side = Math.max(cw, ch);
const out = new PNG({ width: side, height: side });
out.data.fill(255);
const ox = Math.round((side - cw) / 2), oy = Math.round((side - ch) / 2);
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const s = ((y0 + y) * W + (x0 + x)) << 2;
    const d = ((oy + y) * side + (ox + x)) << 2;
    out.data[d] = data[s]; out.data[d + 1] = data[s + 1]; out.data[d + 2] = data[s + 2]; out.data[d + 3] = 255;
  }
}
fs.writeFileSync(OUT, PNG.sync.write(out, { colorType: 6 }));
fs.unlinkSync('assets/_qr_src.png');
console.log(`qr cropped -> ${OUT}  ${side}x${side} (from ${W}x${H}, bbox ${cw}x${ch})`);
