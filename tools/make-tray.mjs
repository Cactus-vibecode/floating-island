// 生成托盘用的模板图标（黑色剪影 + 透明底，macOS 会自动反色）
import fs from 'node:fs';
import { PNG } from 'pngjs';

const S = 36;
const png = new PNG({ width: S, height: S });
png.data.fill(0);

function px(x, y, a = 1) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  png.data[i] = 0;
  png.data[i + 1] = 0;
  png.data[i + 2] = 0;
  png.data[i + 3] = Math.round(255 * a);
}

// 圆角矩形（半径 r），超采样 3x3 抗锯齿
function roundRect(x0, y0, x1, y1, r) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let hit = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const px_ = x + (sx + 0.5) / 3;
          const py = y + (sy + 0.5) / 3;
          const cx = Math.min(Math.max(px_, x0 + r), x1 - r);
          const cy = Math.min(Math.max(py, y0 + r), y1 - r);
          if ((px_ - cx) ** 2 + (py - cy) ** 2 <= r * r) hit++;
        }
      }
      if (hit) px(x, y, hit / 9);
    }
  }
}

// 仙人掌：主干 + 左右各一支 + 盆沿
roundRect(15, 5, 21, 28, 2.4);
roundRect(9, 13, 12, 21, 1.4);
roundRect(9, 18, 16, 21, 1.4);
roundRect(24, 9, 27, 17, 1.4);
roundRect(20, 14, 27, 17, 1.4);
roundRect(10, 28, 26, 31, 1.2);

const out = PNG.sync.write(png);
fs.mkdirSync(new URL('../widget/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../widget/tray.png', import.meta.url), out);
console.log('widget/tray.png', out.length, 'bytes');
