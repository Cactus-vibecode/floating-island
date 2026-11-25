import * as THREE from 'three';

const hash2 = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
};

function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f);
    norm += amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return s / norm;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function canvasOf(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  return cv;
}

function paint(size, fn) {
  const cv = canvasOf(size);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const c = fn(x, y);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
      d[i + 3] = c.length > 3 ? c[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { cv, ctx };
}

function toTex(cv, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 地表细节：接近白灰的明度噪声，颜色全部交给顶点色，四季可自由染色
export function groundDetail(size = 256, repeat = 9) {
  const { cv } = paint(size, (x, y) => {
    const n = fbm(x * 0.052, y * 0.052, 4);
    const clump = fbm(x * 0.42, y * 0.42, 2);
    const grain = hash2(x * 1.7, y * 1.3) - 0.5;
    let v = 0.66 + 0.32 * n;
    if (clump > 0.58) v -= (clump - 0.58) * 1.05;
    v += grain * 0.06;
    const q = clamp01(v) * 255;
    return [q, q * 0.995, q * 0.965];
  });
  return toTex(cv, repeat);
}

// 由高度场生成法线贴图（给地表/岩壁一点微观起伏，避免塑料感）
function normalTexFromHeight(H, size, repeat, strength) {
  const { cv } = paint(size, (x, y) => {
    const xm = (x - 1 + size) % size, xp = (x + 1) % size;
    const ym = (y - 1 + size) % size, yp = (y + 1) % size;
    const dx = (H[y * size + xp] - H[y * size + xm]) * strength * 7;
    const dy = (H[yp * size + x] - H[ym * size + x]) * strength * 7;
    const nx = -dx, ny = -dy, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    return [(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255];
  });
  return toTex(cv, repeat, false);
}

export function groundNormal(size = 256, repeat = 9, strength = 1.0) {
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.052, y * 0.052, 4);
      const clump = fbm(x * 0.42, y * 0.42, 2);
      const grain = hash2(x * 1.7, y * 1.3) - 0.5;
      H[y * size + x] = 0.66 + 0.32 * n - Math.max(0, clump - 0.58) * 1.05 + grain * 0.06;
    }
  }
  return normalTexFromHeight(H, size, repeat, strength);
}

export function rockNormal(size = 256, repeat = 1, strength = 1.0) {
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.042, y * 0.022, 3);
      const block = Math.floor(n * 7) / 7;
      const fine = fbm(x * 0.30, y * 0.24, 2);
      H[y * size + x] = 0.30 + 0.44 * block + 0.16 * fine;
    }
  }
  return normalTexFromHeight(H, size, repeat, strength);
}

// 岩石 / 土壁：带水平层理和裂缝
export function rockDetail(size = 256, repeat = 1) {
  const { cv } = paint(size, (x, y) => {
    const n = fbm(x * 0.042, y * 0.022, 3);
    const block = Math.floor(n * 7) / 7;
    const fine = fbm(x * 0.30, y * 0.24, 2);
    const grit = hash2(x * 2.1, y * 1.7) - 0.5;
    let v = 0.30 + 0.44 * block + 0.16 * fine + grit * 0.05;
    const vcrack = Math.abs(fbm(x * 0.055 + 9, y * 0.007 + 3, 2) - 0.5);
    if (vcrack < 0.016) v *= 0.58;
    const hcrack = Math.abs(fbm(x * 0.008 + 4, y * 0.11 + 7, 2) - 0.5);
    if (hcrack < 0.010) v *= 0.72;
    const q = clamp01(v) * 255;
    return [q, q * 0.975, q * 0.945];
  });
  return toTex(cv, repeat);
}

// 树冠：细碎的叶团明暗，让球体看起来是叶子
export function leafMottle(size = 256, repeat = 1) {
  const { cv } = paint(size, (x, y) => {
    const n = fbm(x * 0.075, y * 0.075, 3);
    const fine = fbm(x * 0.34, y * 0.34, 2);
    const hole = fbm(x * 0.12 + 21, y * 0.12 + 7, 2);
    let v = 0.52 + 0.52 * n + 0.22 * (fine - 0.5);
    if (hole > 0.62) v *= 0.78;
    const q = clamp01(v) * 255;
    return [q, q * 0.99, q * 0.93];
  });
  return toTex(cv, repeat);
}

// 白桦树皮：奶白 + 横向黑斑
export function birchBark(w = 96, h = 192) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = '#efe9dd';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const len = 6 + Math.random() * 26, th = 1 + Math.random() * 2.2;
    c.fillStyle = `rgba(58,52,44,${0.55 + Math.random() * 0.35})`;
    c.beginPath();
    c.ellipse(x, y, len / 2, th, 0, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(120,112,100,${0.05 + Math.random() * 0.12})`;
    c.fillRect(Math.random() * w, 0, 1 + Math.random() * 3, h);
  }
  const t = toTex(cv, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 深色树皮
export function darkBark(w = 96, h = 192) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = '#6a5b4b';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * w;
    c.strokeStyle = `rgba(${38 + Math.random() * 40},${32 + Math.random() * 34},${26 + Math.random() * 28},${0.12 + Math.random() * 0.3})`;
    c.lineWidth = 0.8 + Math.random() * 2.6;
    c.beginPath();
    c.moveTo(x, 0);
    let xx = x;
    for (let y = 0; y < h; y += 12) {
      xx += (Math.random() - 0.5) * 3;
      c.lineTo(xx, y);
    }
    c.stroke();
  }
  const t = toTex(cv, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 水面法线
export function waterNormal(size = 128) {
  const hmap = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      hmap[y * size + x] = fbm(x * 0.055, y * 0.055, 4) * 0.8 + fbm(x * 0.19, y * 0.19, 2) * 0.2;
    }
  }
  const cv = canvasOf(size);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => hmap[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.4;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2.4;
      const nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 6);
  return t;
}

// 水面颜色：中间深、靠岸浅、边缘带碎泡沫，顺流有细亮纹
export function waterSurface(size = 128) {
  const cv = canvasOf(size);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const deep = [38, 92, 122];
  const mid = [74, 146, 176];
  const foam = [214, 236, 244];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const edge = Math.pow(Math.abs(u - 0.5) * 2, 2.4);
      const streak = fbm(x * 0.06 + 3, y * 0.014 + 7, 3);
      const grain = fbm(x * 0.4 + 11, y * 0.05 + 2, 2);
      const t = Math.min(1, edge * 1.1 + (streak - 0.5) * 0.5);
      let r = deep[0] + (mid[0] - deep[0]) * t;
      let g = deep[1] + (mid[1] - deep[1]) * t;
      let b = deep[2] + (mid[2] - deep[2]) * t;
      const bright = Math.max(0, streak - 0.58) * 42;
      r += bright; g += bright; b += bright;
      const fx = Math.max(0, edge - 0.93) / 0.07;
      if (fx > 0) {
        const fa = Math.min(0.75, fx * (0.3 + grain * 0.8));
        r += (foam[0] - r) * fa;
        g += (foam[1] - g) * fa;
        b += (foam[2] - b) * fa;
      }
      const i = (y * size + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 落在地上的叶子
export function leafCard(size = 64) {
  const cv = canvasOf(size);
  const c = cv.getContext('2d');
  const s = size / 64;
  c.clearRect(0, 0, size, size);
  c.fillStyle = '#ffffff';
  c.beginPath();
  const pts = [[32, 4], [40, 20], [58, 18], [48, 34], [56, 56], [32, 46], [8, 56], [16, 34], [6, 18], [24, 20]];
  c.moveTo(pts[0][0] * s, pts[0][1] * s);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], pr = pts[i - 1];
    c.quadraticCurveTo((p[0] + pr[0]) / 2 * s + 2 * s, (p[1] + pr[1]) / 2 * s, p[0] * s, p[1] * s);
  }
  c.closePath();
  c.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 落地投影
export function contactShadow(size = 256) {
  const cv = canvasOf(size);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, size, size);
  const g = c.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(38,36,32,0.42)');
  g.addColorStop(0.45, 'rgba(38,36,32,0.24)');
  g.addColorStop(0.74, 'rgba(38,36,32,0.07)');
  g.addColorStop(1, 'rgba(38,36,32,0)');
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(size / 2, size / 2, size * 0.5, size * 0.5, 0, 0, Math.PI * 2);
  c.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 叶簇卡片：一团小叶子，带镂空
export function leafClusterCard(size = 128) {
  const cv = canvasOf(size);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, size, size);
  const rnd = (() => { let a = 9137; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const cx = size / 2, cy = size / 2;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = Math.pow(rnd(), 0.6) * size * 0.40;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad * 0.92;
    const w = size * (0.055 + rnd() * 0.055);
    const h = w * (1.5 + rnd() * 0.8);
    const rot = rnd() * Math.PI * 2;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.fillStyle = `rgba(255,255,255,${0.86 + rnd() * 0.14})`;
    c.beginPath();
    c.moveTo(0, -h);
    c.bezierCurveTo(w, -h * 0.45, w * 0.9, h * 0.55, 0, h);
    c.bezierCurveTo(-w * 0.9, h * 0.55, -w, -h * 0.45, 0, -h);
    c.fill();
    c.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 水花（跌水白练/岸边白沫）：竖向拉长的白色条纹，可平铺滚动
export function waterFoam(size = 128) {
  const cv = canvasOf(size);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 5 + Math.random() * 26;
    const a = 0.10 + Math.random() * 0.55;
    ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2.6, y + len);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 柔白雾团（瀑布脚下的水汽）
export function mistPuff(size = 64) {
  const cv = canvasOf(size);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(248,253,255,0.34)');
  g.addColorStop(1, 'rgba(240,250,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
