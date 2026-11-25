import * as THREE from 'three';
import {
  fbm, groundDetail, rockDetail, leafMottle, birchBark, darkBark,
  waterNormal, leafCard, leafClusterCard, groundNormal, rockNormal, waterSurface,
  waterFoam, mistPuff,
} from './textures.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const R = 3.2;
export const rimR = (a) => R * (0.945 + 0.10 * Math.sin(a * 2.3 + 0.8) + 0.058 * Math.sin(a * 4.9 + 2.5) + 0.026 * Math.sin(a * 8.7 + 1.2));

// 神社用地：山脚左岸的一块台地。植被/石块在生成时就避开，免得穿模
export const SHRINE_SITE = { x: -0.66, z: 0.03, yaw: 0.22, r: 0.84 };

function gauss(x, z, cx, cz, h, r) {
  const d = Math.hypot(x - cx, z - cz) / r;
  if (d >= 1) return 0;
  const k = 1 - d;
  return h * k * k * (3 - 2 * k);
}

// ---------- 溪流 ----------
const PATH_PTS = [
  [-0.92, -1.34], [-0.58, -1.02], [-0.22, -0.64], [0.20, -0.20],
  [0.62, 0.32], [1.02, 0.88], [1.42, 1.42], [1.86, 1.84], [2.34, 2.32],
];

function samplePath(pts, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (pts.length - 1);
    const k = Math.min(pts.length - 2, Math.floor(t));
    const u = t - k;
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
    const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
    out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

const STREAM_RAW = samplePath(PATH_PTS, 176);

export function distToStream(x, z) {
  let best = 1e9, bi = 0;
  for (let i = 0; i < STREAM_RAW.length; i++) {
    const dx = x - STREAM_RAW[i][0], dz = z - STREAM_RAW[i][1];
    const d = dx * dx + dz * dz;
    if (d < best) { best = d; bi = i; }
  }
  return { d: Math.sqrt(best), i: bi };
}

function baseHeight(x, z) {
  let y = 0;
  y += gauss(x, z, -1.16, -1.00, 2.18, 1.18);
  y += gauss(x, z, -0.10, -1.60, 1.05, 1.15);
  y += gauss(x, z, 1.10, -0.68, 0.58, 1.24);
  y += gauss(x, z, -1.90, 0.36, 0.46, 1.06);
  y += gauss(x, z, 0.46, 1.26, 0.16, 1.20);
  y += gauss(x, z, -2.10, -0.62, 0.28, 0.82);
  // 山峰的棱线：只在主峰范围内叠加脊状噪声，避免变成光滑圆锥
  const pk = gauss(x, z, -1.16, -1.00, 1, 1.02);
  if (pk > 0.002) {
    const rid = 1 - Math.abs(fbm(x * 2.1 + 13, z * 2.1 + 4, 3) * 2 - 1);
    const rid2 = 1 - Math.abs(fbm(x * 4.6 + 31, z * 4.6 + 17, 2) * 2 - 1);
    y += pk * ((rid - 0.5) * 0.50 + (rid2 - 0.5) * 0.17);
  }
  y += (fbm(x * 1.05 + 3, z * 1.05 + 7, 3) - 0.5) * 0.30;
  y += (fbm(x * 2.6 + 9, z * 2.6 + 1, 2) - 0.5) * 0.14;
  y += (fbm(x * 5.4 + 2, z * 5.4 + 6, 2) - 0.5) * 0.05;
  return y;
}

export function terrain(x, z) {
  const r = Math.hypot(x, z);
  const rr = rimR(Math.atan2(z, x));
  let y = baseHeight(x, z);
  const { d, i } = distToStream(x, z);
  const w = 0.40 + 0.10 * (i / STREAM_RAW.length);
  const k = 1 - smoothstep(0, w, d);
  const k2 = 1 - smoothstep(w, w * 2.4, d);
  y -= 0.205 * k * k + 0.05 * k2;
  const edge = smoothstep(rr - 0.85, rr, r);
  y -= 0.26 * edge * edge;
  return y;
}

// ---------- 工具 ----------
function mergeGeos(list) {
  let total = 0;
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of geos) total += g.attributes.position.count;
  const hasColor = geos.some((g) => g.attributes.color);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const col = hasColor ? new Float32Array(total * 3).fill(1) : null;
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col && g.attributes.color) col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

// 给单个几何整体刷一个亮度系数（写进顶点色），用来做树冠的上亮下暗
function tintGeo(geo, v) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = v; arr[i * 3 + 1] = v; arr[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// 叶片的明暗：高度（下暗上亮）× 朝向主光的法线（受光面亮、背光面暗）
const _leafL = new THREE.Vector3(-6.4, 6.2, 6.0).normalize();
function leafShade(geo, y0, y1) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const cnt = p.count;
  let sumY = 0, sumDot = 0;
  for (let i = 0; i < cnt; i++) {
    sumY += p.getY(i);
    sumDot += n.getX(i) * _leafL.x + n.getY(i) * _leafL.y + n.getZ(i) * _leafL.z;
  }
  const t = clamp((sumY / cnt - y0) / Math.max(0.001, y1 - y0), 0, 1);
  const hf = 0.86 + 0.30 * t * t * (3 - 2 * t);
  const lf = 0.82 + 0.34 * Math.max(0, sumDot / cnt);
  return tintGeo(geo, Math.min(1.26, hf * lf));
}

// 顶点色只负责明暗对比，整体平均亮度归一化到 1，避免把树冠整体压暗
function normalizeTint(geo) {
  const c = geo.attributes.color;
  if (!c) return geo;
  const a = c.array;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  const k = a.length / Math.max(1e-6, s);
  for (let i = 0; i < a.length; i++) a[i] = Math.min(1.26, a[i] * k);
  c.needsUpdate = true;
  return geo;
}

function jitterVerts(geo, rnd, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(
      i,
      p.getX(i) * (1 + (rnd() - 0.5) * amt),
      p.getY(i) * (1 + (rnd() - 0.5) * amt),
      p.getZ(i) * (1 + (rnd() - 0.5) * amt)
    );
  }
  return geo;
}

// 树冠：枝条末端散布带透明通道的叶簇卡片
function makeCrown(seed, opt) {
  const r = mulberry32(seed);
  const parts = [];
  const nb = opt.branches;
  for (let b = 0; b < nb; b++) {
    const ang = (b / nb) * Math.PI * 2 + (r() - 0.5) * 0.65;
    const tilt = opt.tilt0 + r() * opt.tilt1;
    const len = opt.len * (0.7 + r() * 0.5);
    const bx = Math.cos(ang) * Math.sin(tilt) * len;
    const bz = Math.sin(ang) * Math.sin(tilt) * len;
    const by = Math.cos(tilt) * len * opt.rise;
    for (let k = 0; k < opt.per; k++) {
      const t = 0.30 + (k / Math.max(1, opt.per - 1)) * 0.7;
      const px = bx * t, py = opt.baseY + by * t, pz = bz * t;
      for (let q = 0; q < opt.quads; q++) {
        const size = opt.q0 + r() * (opt.q1 - opt.q0);
        const g = new THREE.PlaneGeometry(size, size, 1, 1);
        g.rotateX((r() - 0.5) * 2.4);
        g.rotateY(r() * Math.PI * 2);
        g.rotateZ((r() - 0.5) * 1.4);
        g.translate(
          px + (r() - 0.5) * opt.jit,
          py + (r() - 0.5) * opt.jit,
          pz + (r() - 0.5) * opt.jit
        );
        parts.push(leafShade(g, opt.baseY - 0.06, opt.baseY + 0.55));
      }
    }
  }
  for (let k = 0; k < opt.core; k++) {
    const size = opt.q0 * (0.9 + r() * 0.5);
    const g = new THREE.PlaneGeometry(size, size, 1, 1);
    g.rotateX((r() - 0.5) * 2.4);
    g.rotateY(r() * Math.PI * 2);
    const a = r() * Math.PI * 2, rad = r() * opt.len * 0.45;
    g.translate(Math.cos(a) * rad, opt.baseY + opt.coreY + (r() - 0.5) * 0.12, Math.sin(a) * rad);
    parts.push(leafShade(g, opt.baseY - 0.06, opt.baseY + 0.55));
  }
  return normalizeTint(mergeGeos(parts));
}

// ---------- 建造 ----------
export function buildIsland(seed = 21) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const SEG = 128;
  const RING = 32;

  const rimRad = new Float32Array(SEG);
  for (let j = 0; j < SEG; j++) rimRad[j] = rimR((j / SEG) * Math.PI * 2);

  // ===== 地表 =====
  const vCount = 1 + RING * SEG;
  const positions = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);
  const gInfo = [];
  const y0 = terrain(0, 0);
  positions[1] = y0;
  uvs[0] = 0.5; uvs[1] = 0.5;
  gInfo.push({ dirt: 0.06, var: 0.5, slope: 0, wet: 0 });

  let vi = 1;
  const gridIndex = [];
  for (let i = 1; i <= RING; i++) {
    const row = [];
    const t = i / RING;
    for (let j = 0; j < SEG; j++) {
      const a = (j / SEG) * Math.PI * 2;
      const jr = (fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + t * 3, 2) - 0.5) * 0.10 * t * t;
      const rr = Math.max(0.02, rimRad[j] * t + jr);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const y = terrain(x, z);
      const idx = vi++;
      row.push(idx);
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
      uvs[idx * 2] = x / (2 * R) + 0.5;
      uvs[idx * 2 + 1] = z / (2 * R) + 0.5;

      const sx = (terrain(x + 0.1, z) - y) / 0.1;
      const sz = (terrain(x, z + 0.1) - y) / 0.1;
      const slope = Math.hypot(sx, sz);
      const { d } = distToStream(x, z);
      const dirt = clamp(smoothstep(0.46, 0.10, d) * 0.9 + smoothstep(0.55, 1.1, slope) * 0.5, 0, 1);
      gInfo.push({ dirt, var: fbm(x * 1.9 + 4, z * 1.9 + 8, 3), slope, wet: smoothstep(0.22, 0.06, d) });
    }
    gridIndex.push(row);
  }

  const idxArr = [];
  for (let j = 0; j < SEG; j++) {
    const j2 = (j + 1) % SEG;
    idxArr.push(0, gridIndex[0][j], gridIndex[0][j2]);
  }
  for (let i = 0; i < RING - 1; i++) {
    for (let j = 0; j < SEG; j++) {
      const j2 = (j + 1) % SEG;
      const a = gridIndex[i][j], b = gridIndex[i][j2], c = gridIndex[i + 1][j2], d = gridIndex[i + 1][j];
      idxArr.push(a, b, c, a, c, d);
    }
  }

  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  groundGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  groundGeo.setIndex(idxArr);
  groundGeo.computeVertexNormals();
  const colorArr = new Float32Array(vCount * 3);
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));

  const groundMat = new THREE.MeshStandardMaterial({
    map: groundDetail(256, 9),
    normalMap: groundNormal(256, 9, 1.1),
    normalScale: new THREE.Vector2(0.7, 0.7),
    vertexColors: true,
    roughness: 0.97,
    metalness: 0,
    envMapIntensity: 0.3,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = 'ground';
  ground.receiveShadow = true;
  group.add(ground);

  const snowGeo = groundGeo.clone();
  const sp = snowGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setY(i, sp.getY(i) + 0.011);
  snowGeo.computeVertexNormals();
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.7, metalness: 0, transparent: true, opacity: 0,
    envMapIntensity: 0.7,
  });
  const snowLayer = new THREE.Mesh(snowGeo, snowMat);
  snowLayer.name = 'snow';
  snowLayer.receiveShadow = true;
  snowLayer.visible = false;
  group.add(snowLayer);

  // ===== 岩基 =====
  const KN = 10;
  const skirt = [];
  const topY = [];
  for (let j = 0; j < SEG; j++) {
    const a = (j / SEG) * Math.PI * 2;
    topY.push(terrain(Math.cos(a) * rimRad[j], Math.sin(a) * rimRad[j]));
  }
  const DEPTH = 1.36;
  for (let k = 0; k <= KN; k++) {
    const row = [];
    const f = k / KN;
    for (let j = 0; j < SEG; j++) {
      const a = (j / SEG) * Math.PI * 2;
      const rib = fbm(Math.cos(a) * 3.2 + 11, Math.sin(a) * 3.2 + 4, 3) - 0.5;
      const rib2 = fbm(Math.cos(a) * 7.5 + 2, Math.sin(a) * 7.5 + f * 4, 2) - 0.5;
      const wob = 1 + rib * (0.10 + f * 0.22) + rib2 * 0.075;
      const rr = k === 0 ? rimRad[j] * 1.004 : rimRad[j] * (1 - 0.30 * Math.pow(f, 0.8)) * wob;
      const ledge = (fbm(Math.cos(a) * 4.5 + 3, Math.sin(a) * 4.5 + 9 + f * 6, 2) - 0.5) * 0.18;
      const y = topY[j] - DEPTH * Math.pow(f, 0.94) + (k === 0 ? 0.004 : ledge);
      row.push({ x: Math.cos(a) * rr, y, z: Math.sin(a) * rr, f });
    }
    skirt.push(row);
  }

  const rPos = [], rInfo = [];
  const rTri = (a, b, c, f) => {
    rPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const n = 0.86 + rnd() * 0.24;
    rInfo.push(f, n, f, n, f, n);
  };
  for (let k = 0; k < KN; k++) {
    const f = (k + 0.55) / KN;
    for (let j = 0; j < SEG; j++) {
      const j2 = (j + 1) % SEG;
      const a = skirt[k][j], b = skirt[k][j2], c = skirt[k + 1][j2], d = skirt[k + 1][j];
      rTri(a, c, b, f);
      rTri(a, d, c, f);
    }
  }
  // 底部：向内收成不规则的底盘
  const BOT_RINGS = 4;
  let prevRing = skirt[KN];
  for (let m = 1; m <= BOT_RINGS; m++) {
    const g = m / BOT_RINGS;
    const row = [];
    for (let j = 0; j < SEG; j++) {
      const a = (j / SEG) * Math.PI * 2;
      const base = skirt[KN][j];
      const shrink = 1 - 0.62 * Math.pow(g, 0.85);
      const droop = 0.30 * Math.pow(g, 0.9) + (fbm(Math.cos(a) * 5 + 21, Math.sin(a) * 5 + g * 4, 2) - 0.5) * 0.16 * g;
      row.push({
        x: base.x * shrink,
        y: base.y - droop,
        z: base.z * shrink,
        f: 1 + g * 0.2,
      });
    }
    for (let j = 0; j < SEG; j++) {
      const j2 = (j + 1) % SEG;
      const a = prevRing[j], b = prevRing[j2], c = row[j2], d = row[j];
      rTri(a, c, b, 1.05);
      rTri(a, d, c, 1.05);
    }
    prevRing = row;
  }
  const bc = new THREE.Vector3(0.02, prevRing[0].y - 0.10, -0.02);
  for (let j = 0; j < SEG; j++) {
    const j2 = (j + 1) % SEG;
    const a = prevRing[j], b = prevRing[j2];
    rPos.push(a.x, a.y, a.z, bc.x, bc.y, bc.z, b.x, b.y, b.z);
    rInfo.push(1.2, 0.6, 1.2, 0.6, 1.3, 0.55);
  }

  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  const ruv = new Float32Array((rPos.length / 3) * 2);
  for (let i = 0; i < rPos.length / 3; i++) {
    const a = Math.atan2(rPos[i * 3 + 2], rPos[i * 3]);
    // 横向层理：u 沿高度走，v 沿圆周走
    ruv[i * 2] = rInfo[i * 2] * 5.2;
    ruv[i * 2 + 1] = (a / (Math.PI * 2)) * 2.2;
  }
  rockGeo.setAttribute('uv', new THREE.BufferAttribute(ruv, 2));
  rockGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((rPos.length / 3) * 3), 3));
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    map: rockDetail(256, 1),
    normalMap: rockNormal(256, 1, 1.3),
    normalScale: new THREE.Vector2(0.85, 0.85),
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.12,
    side: THREE.DoubleSide,
  });
  const rockMesh = new THREE.Mesh(rockGeo, rockMat);
  rockMesh.name = 'rockBase';
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  group.add(rockMesh);

  // ===== 山体岩层皮肤（覆盖高海拔的地表三角面）=====
  const PEAK = { x: -1.16, z: -1.00, r: 0.9, h: 1.9 };
  const srcIdx = groundGeo.index.array;
  const srcPos = groundGeo.attributes.position.array;
  const skinPos = [], skinInfo = [], skinUv = [];
  const H_START = 0.92;
  for (let i = 0; i < srcIdx.length; i += 3) {
    const ia = srcIdx[i], ib = srcIdx[i + 1], ic = srcIdx[i + 2];
    const ys = [srcPos[ia * 3 + 1], srcPos[ib * 3 + 1], srcPos[ic * 3 + 1]];
    const avgY = (ys[0] + ys[1] + ys[2]) / 3;
    const jitter = (fbm((srcPos[ia * 3]) * 3.1 + 7, (srcPos[ia * 3 + 2]) * 3.1 + 2, 2) - 0.5) * 0.26;
    if (avgY < H_START + jitter) continue;
    for (const id of [ia, ib, ic]) {
      const x = srcPos[id * 3], y = srcPos[id * 3 + 1], z = srcPos[id * 3 + 2];
      skinPos.push(x, y + 0.006, z);
      skinUv.push(x * 0.55 + z * 0.2, y * 0.55);
      skinInfo.push(y, fbm(x * 2.2 + 3, z * 2.2 + 1, 2));
    }
  }
  const skinGeo = new THREE.BufferGeometry();
  skinGeo.setAttribute('position', new THREE.Float32BufferAttribute(skinPos, 3));
  skinGeo.setAttribute('uv', new THREE.Float32BufferAttribute(skinUv, 2));
  skinGeo.computeVertexNormals();
  skinGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((skinPos.length / 3) * 4), 4));
  const skinMat = new THREE.MeshStandardMaterial({
    map: rockDetail(256, 1),
    vertexColors: true,
    transparent: true,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const peakMesh = new THREE.Mesh(skinGeo, skinMat);
  peakMesh.name = 'peak';
  peakMesh.castShadow = true;
  peakMesh.receiveShadow = true;
  group.add(peakMesh);

  // ===== 雪帽（独立网格，白得干净，不被岩石贴图压灰）=====
  const snowPos = [], snowInfo = [], snowUv = [];
  for (let i = 0; i < srcIdx.length; i += 3) {
    const ia = srcIdx[i], ib = srcIdx[i + 1], ic = srcIdx[i + 2];
    const ys = [srcPos[ia * 3 + 1], srcPos[ib * 3 + 1], srcPos[ic * 3 + 1]];
    const avgY = (ys[0] + ys[1] + ys[2]) / 3;
    const jit = (fbm(srcPos[ia * 3] * 4.3 + 11, srcPos[ia * 3 + 2] * 4.3 + 5, 2) - 0.5) * 0.16;
    if (avgY < 1.60 + jit) continue;
    for (const id of [ia, ib, ic]) {
      const x = srcPos[id * 3], y = srcPos[id * 3 + 1], z = srcPos[id * 3 + 2];
      snowPos.push(x, y + 0.016, z);
      snowUv.push(x * 0.5, z * 0.5);
      snowInfo.push(y, fbm(x * 3.1 + 21, z * 3.1 + 9, 2));
    }
  }
  const capGeo = new THREE.BufferGeometry();
  capGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3));
  capGeo.setAttribute('uv', new THREE.Float32BufferAttribute(snowUv, 2));
  capGeo.computeVertexNormals();
  capGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((snowPos.length / 3) * 4), 4));
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.95,
    roughness: 0.62, metalness: 0, envMapIntensity: 0.5,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const snowMesh = new THREE.Mesh(capGeo, capMat);
  snowMesh.name = 'snowcap';
  snowMesh.castShadow = true;
  snowMesh.receiveShadow = true;
  snowMesh.renderOrder = 1;
  group.add(snowMesh);
  const capColors = () => {
    const sc = capGeo.attributes.color;
    for (let i = 0; i < sc.count; i++) {
      const y = snowInfo[i * 2], n = snowInfo[i * 2 + 1];
      const a = 0.12 + 0.88 * smoothstep(1.58, 1.98, y + (n - 0.5) * 0.24);
      const g = 0.9 + 0.1 * n;
      const br = 0.9 + 0.22 * fbm(y * 7.5 + 5, n * 5.2 + 11, 2);
      sc.setXYZW(i, 0.97 * g + 0.03, 0.98 * g + 0.02, 1.0 * g, Math.min(1, a * br));
    }
    sc.needsUpdate = true;
  };
  capColors();

  // ===== 溪水 =====
  const STREAM = [];
  {
    const rc = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3();
    const sampleGround = (x, z, fallback) => {
      origin.set(x, 6, z);
      rc.set(origin, down);
      const hit = rc.intersectObject(ground, false)[0];
      return hit ? hit.point.y : fallback;
    };
    for (let i = 10; i < STREAM_RAW.length; i++) {
      const [x, z] = STREAM_RAW[i];
      const prev = STREAM_RAW[Math.max(0, i - 1)], next = STREAM_RAW[Math.min(STREAM_RAW.length - 1, i + 1)];
      let tx = next[0] - prev[0], tz = next[1] - prev[1];
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      const nx = -tz, nz = tx;
      const taper = 0.70 + 0.30 * Math.min(1, (i / STREAM_RAW.length) / 0.32);
      const hw = (0.205 + 0.095 * (i / STREAM_RAW.length)) * taper + (fbm(i * 0.32, 2, 2) - 0.5) * 0.022;
      // 水面取河宽内的最高点，保证不会钻到地表网格下面（网格比解析地形粗）
      let top = -9;
      for (let k = -2; k <= 2; k++) {
        const off = (k / 2) * hw;
        const gx = x + nx * off, gz = z + nz * off;
        top = Math.max(top, sampleGround(gx, gz, terrain(gx, gz)));
      }
      STREAM.push({ x, z, nx, nz, hw, y: top + 0.024 });
    }
  }
  const wPos = [], wUv = [], wCol = [], wIdx = [];
  for (let i = 0; i < STREAM.length; i++) {
    const p = STREAM[i];
    wPos.push(p.x + p.nx * p.hw, p.y - 0.002, p.z + p.nz * p.hw);
    wPos.push(p.x, p.y - 0.012, p.z);
    wPos.push(p.x - p.nx * p.hw, p.y - 0.002, p.z - p.nz * p.hw);
    const v = (i / STREAM.length) * 5;
    wUv.push(0, v, 0.5, v, 1, v);
    wCol.push(1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0);
    if (i < STREAM.length - 1) {
      const a = i * 3, b = a + 3;
      wIdx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  // ===== 岸边的跌水：跟着岩壁垂下去，让"河"有个出口 =====
  {
    const nS = STREAM.length;
    const end = STREAM[nS - 1], back = STREAM[Math.max(0, nS - 4)];
    let dx = end.x - back.x, dz = end.z - back.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    const nx = -dz, nz = dx;
    const FALL = 12;
    const baseIdx = nS;
    let inx = -end.x, inz = -end.z;
    const il = Math.hypot(inx, inz) || 1;
    inx /= il; inz /= il;
    for (let k = 1; k <= FALL; k++) {
      const t = k / FALL;
      // 顺着岩壁往里收，跌到岩石腰部就散掉，不要拖成一条飘带
      const y = end.y - Math.pow(t, 1.3) * 0.92;
      const w = end.hw * (0.88 - 0.62 * t);
      const pull = 0.30 * Math.pow(t, 1.25);
      const cx = end.x + dx * 0.02 * t + inx * pull;
      const cz = end.z + dz * 0.02 * t + inz * pull;
      wPos.push(cx + nx * w, y, cz + nz * w);
      wPos.push(cx, y - 0.004, cz);
      wPos.push(cx - nx * w, y, cz - nz * w);
      const v = 5 + t * 3.4;
      wUv.push(0, v, 0.5, v, 1, v);
      const bri = 1.15 + 0.6 * t;
      const al = Math.max(0, 1 - Math.pow(t, 0.8) * 1.3);
      wCol.push(bri, bri * 1.04, bri * 1.06, 0, bri, bri * 1.04, bri * 1.06, al, bri, bri * 1.04, bri * 1.06, 0);
      if (k < FALL) {
        const a = (k === 1 ? nS - 1 : baseIdx + k - 2) * 3, b = a + 3;
        wIdx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      }
    }
  }

  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wUv, 2));
  waterGeo.setAttribute('color', new THREE.Float32BufferAttribute(wCol, 4));
  waterGeo.setIndex(wIdx);
  waterGeo.computeVertexNormals();
  const waterMap = waterNormal(128);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: waterSurface(128),
    vertexColors: true,
    roughness: 0.22,
    metalness: 0,
    transparent: true,
    opacity: 0.96,
    normalMap: waterMap,
    normalScale: new THREE.Vector2(0.14, 0.14),
    envMapIntensity: 0.34,
    clearcoat: 0.10,
    clearcoatRoughness: 0.2,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.name = 'water';
  water.receiveShadow = true;
  water.renderOrder = 2;
  group.add(water);

  // ===== 跌水白练：坡度陡的段落压一层会流动的白花 =====
  const foamTex = waterFoam(128);
  foamTex.repeat.set(1, 6);
  const foamMat = new THREE.MeshBasicMaterial({
    map: foamTex, color: 0xF4FCFF, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });
  {
    const fPos = [], fUv = [], fCol = [], fIdx = [];
    let fv = 0;
    for (let i = 0; i < STREAM.length - 1; i++) {
      const p = STREAM[i], q = STREAM[i + 1];
      const ds = Math.hypot(q.x - p.x, q.z - p.z) || 1e-4;
      const drop = p.y - q.y;
      const slope = drop / ds;
      const steep = smoothstep(0.22, 0.85, slope);
      if (steep < 0.02) continue;
      const w = p.hw * 0.92;
      fPos.push(p.x + p.nx * w, p.y + 0.007, p.z + p.nz * w);
      fPos.push(p.x, p.y + 0.009, p.z);
      fPos.push(p.x - p.nx * w, p.y + 0.007, p.z - p.nz * w);
      const v0 = i * 0.55;
      fUv.push(0, v0, 0.5, v0, 1, v0);
      const a = 0.55 + 0.45 * steep;
      fCol.push(1, 1, 1, a * 0.55, 1, 1, 1, a, 1, 1, 1, a * 0.55);
      if (i < STREAM.length - 2) {
        const A = fv, B = fv + 3;
        fIdx.push(A, B, A + 1, A + 1, B, B + 1, A + 1, B + 1, A + 2, A + 2, B + 1, B + 2);
      }
      fv += 3;
    }
    if (fPos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(fUv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(fCol, 4));
      g.setIndex(fIdx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, foamMat);
      m.name = 'foam';
      m.renderOrder = 3;
      group.add(m);
    }
  }

  // ===== 水汽：跌水落点附近飘几团白雾 =====
  const mistMat = new THREE.PointsMaterial({
    map: mistPuff(64), color: 0xFFFFFF, size: 0.30, sizeAttenuation: true,
    transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  });
  {
    const mp = [];
    for (let i = 6; i < STREAM.length - 1; i++) {
      const p = STREAM[i], q = STREAM[i + 1];
      const ds = Math.hypot(q.x - p.x, q.z - p.z) || 1e-4;
      if ((p.y - q.y) / ds < 0.5) continue;
      for (let k = 0; k < 3; k++) {
        mp.push(
          p.x + (Math.random() - 0.5) * p.hw * 2.2,
          p.y + 0.01 + Math.random() * 0.09,
          p.z + (Math.random() - 0.5) * p.hw * 2.2
        );
      }
    }
    if (mp.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
      const pts = new THREE.Points(g, mistMat);
      pts.name = 'mist';
      pts.frustumCulled = false;
      group.add(pts);
    }
  }

  // ===== 雪堆：雪季贴着地面起伏的小雪丘 =====
  let driftMesh = null, driftMat = null;
  {
    const dg = new THREE.IcosahedronGeometry(0.085, 0);
    dg.scale(1, 0.30, 1);
    jitterVerts(dg, rnd, 0.30);
    dg.computeVertexNormals();
    driftMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.78, metalness: 0, flatShading: true,
      transparent: true, opacity: 0, envMapIntensity: 0.7,
    });
    const list = [];
    let tries = 0;
    while (list.length < 120 && tries < 4000) {
      tries++;
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * 2.9;
      if (rr > rimRad[Math.floor(((a / (Math.PI * 2)) * SEG + SEG) % SEG)] - 0.13) continue;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const y = terrain(x, z);
      if (y > 1.35) continue;
      list.push({ x, y, z, s: 0.7 + rnd() * 1.5, r: rnd() * 6.28 });
    }
    driftMesh = new THREE.InstancedMesh(dg, driftMat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    list.forEach((t, i) => {
      e.set(0, t.r, 0); q.setFromEuler(e);
      sv.set(t.s, t.s * (0.5 + rnd() * 0.4), t.s * (0.8 + rnd() * 0.4));
      pv.set(t.x, t.y - 0.012, t.z);
      m.compose(pv, q, sv);
      driftMesh.setMatrixAt(i, m);
    });
    driftMesh.instanceMatrix.needsUpdate = true;
    driftMesh.receiveShadow = true;
    driftMesh.visible = false;
    group.add(driftMesh);
  }

  // ===== 踏石小径：从神社石阶前斜穿草甸（参考图里那条浅灰石径）=====
  const pathStones = [];
  {
    const ctrl = [
      [-0.34, 0.60], [-0.02, 0.86], [0.34, 1.02], [0.74, 1.16], [1.16, 1.36],
    ].map(([x, z]) => new THREE.Vector3(x, terrain(x, z), z));
    const curve = new THREE.CatmullRomCurve3(ctrl);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const pt = curve.getPoint(t);
      const jx = (rnd() - 0.5) * 0.05, jz = (rnd() - 0.5) * 0.05;
      const x = pt.x + jx, z = pt.z + jz;
      if (Math.hypot(x, z) > rimRad[Math.floor(((Math.atan2(z, x) / (Math.PI * 2) + 1) % 1) * SEG)] - 0.12) continue;
      if (distToStream(x, z).d < 0.30) continue;
      pathStones.push({ x, y: terrain(x, z), z, s: 0.85 + rnd() * 0.5, r: rnd() * 6.28, c: rnd() });
    }
  }
  if (pathStones.length) {
    const pg = new THREE.IcosahedronGeometry(0.062, 0);
    pg.scale(1, 0.30, 0.86);
    jitterVerts(pg, rnd, 0.22);
    pg.computeVertexNormals();
    const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true, envMapIntensity: 0.34 });
    const mesh = new THREE.InstancedMesh(pg, pm, pathStones.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    const col = new THREE.Color();
    pathStones.forEach((t, i) => {
      e.set((rnd() - 0.5) * 0.08, t.r, (rnd() - 0.5) * 0.08); q.setFromEuler(e);
      sv.set(t.s, t.s * (0.8 + rnd() * 0.3), t.s);
      pv.set(t.x, t.y + 0.010, t.z);
      m.compose(pv, q, sv);
      mesh.setMatrixAt(i, m);
      col.setHSL(0.10, 0.07, 0.62 + t.c * 0.12);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.name = 'pathStones';
    group.add(mesh);
  }

  // ===== 岛缘垂下的树根（参考图崖壁上那几根细根）=====
  {
    const rootMat = new THREE.MeshStandardMaterial({ color: 0x5A4029, roughness: 1, metalness: 0 });
    const rg = new THREE.CylinderGeometry(0.0028, 0.0016, 1, 4);
    rg.translate(0, -0.5, 0);
    const roots = [];
    for (let j = 0; j < SEG; j += 3) {
      if (rnd() > 0.34) continue;
      const a = (j / SEG) * Math.PI * 2;
      const rr = rimRad[j] * 0.985;
      roots.push({
        x: Math.cos(a) * rr, y: topY[j] + 0.01, z: Math.sin(a) * rr,
        len: 0.10 + rnd() * 0.22, tilt: (rnd() - 0.5) * 0.28, yaw: a,
      });
    }
    const rm = new THREE.InstancedMesh(rg, rootMat, roots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    roots.forEach((r, i) => {
      e.set(r.tilt, r.yaw, r.tilt * 0.5); q.setFromEuler(e);
      sv.set(1, r.len, 1);
      pv.set(r.x, r.y, r.z);
      m.compose(pv, q, sv);
      rm.setMatrixAt(i, m);
    });
    rm.instanceMatrix.needsUpdate = true;
    rm.castShadow = false;
    group.add(rm);
  }

  // ===== 冬季冰柱：雪季从岛缘垂下 =====
  let iceMat = null, iceMesh = null;
  {
    const ig = new THREE.ConeGeometry(0.016, 1, 5);
    ig.rotateX(Math.PI);
    ig.translate(0, -0.5, 0);
    iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xCFEAF8, roughness: 0.12, metalness: 0, transparent: true, opacity: 0,
      envMapIntensity: 1.1, clearcoat: 0.6, side: THREE.DoubleSide,
    });
    const list = [];
    for (let j = 0; j < SEG; j += 1) {
      if (rnd() > 0.62) continue;
      const a = (j / SEG) * Math.PI * 2;
      const rr = rimRad[j] * (0.94 + rnd() * 0.05);
      list.push({
        x: Math.cos(a) * rr, y: topY[j] - 0.02 - rnd() * 0.04, z: Math.sin(a) * rr,
        len: 0.10 + rnd() * 0.22, w: 0.75 + rnd() * 1.1,
      });
    }
    iceMesh = new THREE.InstancedMesh(ig, iceMat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    list.forEach((t, i) => {
      e.set((rnd() - 0.5) * 0.12, rnd() * 6.28, (rnd() - 0.5) * 0.12); q.setFromEuler(e);
      sv.set(t.w, t.len, t.w);
      pv.set(t.x, t.y, t.z);
      m.compose(pv, q, sv);
      iceMesh.setMatrixAt(i, m);
    });
    iceMesh.instanceMatrix.needsUpdate = true;
    iceMesh.visible = false;
    group.add(iceMesh);
  }

  // ===== 草丛 =====
  const tuftParts = [];
  for (let b = 0; b < 5; b++) {
    const ang = (b / 5) * Math.PI * 2 + rnd() * 0.6;
    const h = 0.052 + rnd() * 0.050;
    const w = 0.006 + rnd() * 0.004;
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute([
      -w, 0, 0, w, 0, 0, (rnd() - 0.5) * 0.04, h, (rnd() - 0.5) * 0.04,
    ], 3));
    bg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    bg.computeVertexNormals();
    bg.rotateY(ang);
    bg.translate((rnd() - 0.5) * 0.05, 0, (rnd() - 0.5) * 0.05);
    tuftParts.push(bg);
  }
  const tuftGeo = mergeGeos(tuftParts);
  const tuftMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.3,
  });
  const tufts = [];
  let tg = 0;
  while (tufts.length < 11500 && tg < 120000) {
    tg++;
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * 2.95;
    if (rr > rimRad[Math.floor(((a / (Math.PI * 2)) * SEG + SEG) % SEG)] - 0.10) continue;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const y = terrain(x, z);
    if (y > 1.28) continue;
    const { d } = distToStream(x, z);
    if (d < 0.26) continue;
    if (Math.hypot(x - SHRINE_SITE.x, z - SHRINE_SITE.z) < SHRINE_SITE.r * 0.72) continue;
    const sl = Math.hypot((terrain(x + 0.1, z) - y) / 0.1, (terrain(x, z + 0.1) - y) / 0.1);
    if (sl > 0.7) continue;
    tufts.push({ x, y, z, s: 0.74 + rnd() * 0.95, r: rnd() * 6.28, c: rnd() });
  }
  const tuftMesh = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length);
  tuftMesh.name = 'tufts';
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    tufts.forEach((t, i) => {
      e.set(0, t.r, 0); q.setFromEuler(e);
      sv.set(t.s, t.s * (0.8 + rnd() * 0.6), t.s);
      pv.set(t.x, t.y - 0.005, t.z);
      m.compose(pv, q, sv);
      tuftMesh.setMatrixAt(i, m);
    });
    tuftMesh.instanceMatrix.needsUpdate = true;
    tuftMesh.castShadow = false;
    tuftMesh.receiveShadow = true;
  }
  group.add(tuftMesh);

  // ===== 苔藓团 =====
  const mossGeo = new THREE.IcosahedronGeometry(0.1, 1);
  jitterVerts(mossGeo, rnd, 0.45);
  mossGeo.scale(1, 0.5, 1);
  mossGeo.computeVertexNormals();
  const mossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true, envMapIntensity: 0.25 });
  const mosses = [];
  let mg = 0;
  while (mosses.length < 130 && mg < 4000) {
    mg++;
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * 2.9;
    if (rr > rimRad[Math.floor(((a / (Math.PI * 2)) * SEG + SEG) % SEG)] - 0.16) continue;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const y = terrain(x, z);
    if (y > 1.2) continue;
    const { d } = distToStream(x, z);
    if (d < 0.36) continue;
    if (Math.hypot(x - SHRINE_SITE.x, z - SHRINE_SITE.z) < SHRINE_SITE.r * 0.7) continue;
    const sl = Math.hypot((terrain(x + 0.1, z) - y) / 0.1, (terrain(x, z + 0.1) - y) / 0.1);
    if (sl > 0.6) continue;
    mosses.push({ x, y, z, s: 0.5 + rnd() * 0.85, r: rnd() * 6.28, c: rnd() });
  }
  const mossMesh = new THREE.InstancedMesh(mossGeo, mossMat, mosses.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    mosses.forEach((t, i) => {
      e.set(0, t.r, 0); q.setFromEuler(e);
      sv.set(t.s, t.s * (0.6 + rnd() * 0.7), t.s);
      pv.set(t.x, t.y - 0.02, t.z);
      m.compose(pv, q, sv);
      mossMesh.setMatrixAt(i, m);
    });
    mossMesh.instanceMatrix.needsUpdate = true;
    mossMesh.castShadow = true;
    mossMesh.receiveShadow = true;
  }
  group.add(mossMesh);

  // ===== 岩石 =====
  const rockGeo2 = new THREE.DodecahedronGeometry(0.13, 0);
  jitterVerts(rockGeo2, rnd, 0.55);
  rockGeo2.computeVertexNormals();
  const rockMat2 = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true, envMapIntensity: 0.3 });
  const rocks = [];
  let rg = 0;
  while (rocks.length < 46 && rg < 4000) {
    rg++;
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * 2.92;
    if (rr > rimRad[Math.floor(((a / (Math.PI * 2)) * SEG + SEG) % SEG)] - 0.13) continue;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const y = terrain(x, z);
    if (y > 1.28) continue;
    const { d } = distToStream(x, z);
    if (d < 0.34) continue;
    rocks.push({ x, y, z, s: 0.3 + rnd() * 0.8, r: rnd() * 6.28, c: rnd() });
  }
  // 沿溪谷散布的鹅卵石（让水沟读成溪床而不是一道刻痕）
  for (let i = 3; i < STREAM.length - 1; i += 2) {
    const p0 = STREAM[i];
    const pv0 = STREAM[i - 1], nx0 = STREAM[Math.min(STREAM.length - 1, i + 1)];
    let tx0 = nx0.x - pv0.x, tz0 = nx0.z - pv0.z;
    const tl0 = Math.hypot(tx0, tz0) || 1;
    tx0 /= tl0; tz0 /= tl0;
    const nb = [-tz0, tx0];
    for (let side = -1; side <= 1; side++) {
      for (let q = 0; q < 2; q++) {
        if (side === 0) continue;
        if (rnd() > 0.7) continue;
        const off = side === 0 ? 0 : side * (0.13 + rnd() * 0.13);
        const x = p0.x + nb[0] * off, z = p0.z + nb[1] * off;
        const y = terrain(x, z);
        rocks.push({
          x, y, z,
          s: 0.16 + rnd() * 0.42,
          r: rnd() * 6.28,
          c: rnd() * 0.7,
        });
      }
    }
  }
  const rocksNear = rocks.filter(
    (t) => Math.hypot(t.x - SHRINE_SITE.x, t.z - SHRINE_SITE.z) > SHRINE_SITE.r * 0.62
  );
  const rockMesh2 = new THREE.InstancedMesh(rockGeo2, rockMat2, rocksNear.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    rocksNear.forEach((t, i) => {
      e.set(rnd() * 0.5, t.r, rnd() * 0.5); q.setFromEuler(e);
      sv.set(t.s, t.s * (0.5 + rnd() * 0.45), t.s * (0.8 + rnd() * 0.5));
      pv.set(t.x, t.y - 0.03, t.z);
      m.compose(pv, q, sv);
      rockMesh2.setMatrixAt(i, m);
    });
    rockMesh2.instanceMatrix.needsUpdate = true;
    rockMesh2.castShadow = true;
    rockMesh2.receiveShadow = true;
  }
  group.add(rockMesh2);

  // ===== 树木（成簇分布）=====
  const trees = [];
  const MEADOW = { x: -0.15, z: 1.18, r: 0.92 };

  // 鸟居正前的视线走廊（神社本地坐标）：走廊内不长树，保证牌坊、台阶通透
  const T_FWD = { x: Math.sin(SHRINE_SITE.yaw), z: Math.cos(SHRINE_SITE.yaw) };
  const T_SIDE = { x: T_FWD.z, z: -T_FWD.x };
  const toriiFrame = (x, z) => {
    const dx = x - SHRINE_SITE.x, dz = z - SHRINE_SITE.z;
    return { f: dx * T_FWD.x + dz * T_FWD.z, l: dx * T_SIDE.x + dz * T_SIDE.z };
  };
  const inToriiClear = (x, z, lat = 1.00, near = -0.25, far = 1.72) => {
    const { f, l } = toriiFrame(x, z);
    return f > near && f < far && Math.abs(l) < lat;
  };

  const canPlant = (x, z) => {
    const rr = Math.hypot(x, z);
    const rimHere = rimR(Math.atan2(z, x));
    if (rr > rimHere - 0.22) return null;
    const y = terrain(x, z);
    if (y > 1.30) return null;
    if (Math.hypot(x - PEAK.x, z - PEAK.z) < 0.86) return null;
    if (Math.hypot(x - SHRINE_SITE.x, z - SHRINE_SITE.z) < SHRINE_SITE.r) return null;
    // 神社正前方不种树：牌坊、台阶、参道要能看见
    if (inToriiClear(x, z)) return null;
    if (Math.hypot(x - MEADOW.x, z - MEADOW.z) < MEADOW.r) return null;
    const { d } = distToStream(x, z);
    if (d < 0.46) return null;
    const sx = (terrain(x + 0.14, z) - y) / 0.14;
    const sz = (terrain(x, z + 0.14) - y) / 0.14;
    const slope = Math.hypot(sx, sz);
    if (slope > 0.62) return null;
    const drop = Math.max(
      y - terrain(x + 0.26, z), y - terrain(x - 0.26, z),
      y - terrain(x, z + 0.26), y - terrain(x, z - 0.26)
    );
    if (drop > 0.42) return null;
    for (const t of trees) if ((t.x - x) ** 2 + (t.z - z) ** 2 < 0.038) return null;
    return { y, slope };
  };

  const pushTree = (x, z, forced) => {
    const hit = canPlant(x, z);
    if (!hit) return false;
    let sp = forced;
    if (!sp) {
      const high = hit.y > 0.82 || Math.hypot(x - PEAK.x, z - PEAK.z) < 1.45;
      if (high) sp = rnd() < 0.76 ? 'conifer' : 'birch';
      else sp = rnd() < 0.42 ? 'birch' : rnd() < 0.62 ? 'maple' : rnd() < 0.8 ? 'asp' : 'conifer';
    }
    trees.push({
      x, y: hit.y - 0.02, z, sp,
      s: 0.76 + rnd() * 0.54,
      rot: rnd() * Math.PI * 2,
      ci: Math.floor(rnd() * 4),
      tint: rnd(),
    });
    return true;
  };

  const clusters = [];
  let cg = 0;
  while (clusters.length < 22 && cg < 9000) {
    cg++;
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * 2.86;
    if (rr > rimRad[Math.floor(((a / (Math.PI * 2)) * SEG + SEG) % SEG)] - 0.5) continue;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (clusters.some((c) => Math.hypot(c.x - x, c.z - z) < 0.62)) continue;
    if (Math.hypot(x - MEADOW.x, z - MEADOW.z) < MEADOW.r + 0.1) continue;
    if (Math.hypot(x - PEAK.x, z - PEAK.z) < 1.15) continue;
    const { d } = distToStream(x, z);
    if (d < 0.6) continue;
    const y = terrain(x, z);
    if (y > 1.55) continue;
    clusters.push({ x, z, r: 0.26 + rnd() * 0.34, y });
  }

  for (const c of clusters) {
    const high = c.y > 0.85 || Math.hypot(c.x - PEAK.x, c.z - PEAK.z) < 1.6;
    const roll = rnd();
    const dominant = high
      ? rnd() < 0.72 ? 'conifer' : 'birch'
      : roll < 0.34 ? 'birch' : roll < 0.56 ? 'maple' : roll < 0.72 ? 'asp' : roll < 0.84 ? 'conifer' : null;
    const n = 2 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const rad = Math.sqrt(rnd()) * c.r;
      let sp = rnd() < 0.76 ? dominant : null;
      if (sp === null) sp = rnd() < 0.5 ? 'birch' : rnd() < 0.7 ? 'maple' : 'asp';
      pushTree(c.x + Math.cos(a) * rad, c.z + Math.sin(a) * rad, sp);
    }
  }
  for (let i = 0; i < 120; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * 2.95;
    pushTree(Math.cos(a) * rr, Math.sin(a) * rr);
  }

  // 补植：左前方和岛缘偏空，按参考图补几丛（边缘也让它长树，别留一圈秃边）
  const EXTRA = [
    [-2.10, 0.42, 0.34], [-1.86, 0.86, 0.32], [-1.56, 1.30, 0.30],
    [-2.20, -0.10, 0.30], [-1.42, 0.32, 0.28], [-1.92, 1.62, 0.24],
    [-1.10, 1.05, 0.22], [1.92, 0.30, 0.30], [2.10, 0.86, 0.26],
    [1.60, -0.55, 0.24],
    // 左前方岛缘那一带（参考图里这边是成片的树）
    [-2.05, 1.55, 0.30], [-1.75, 1.88, 0.32], [-1.35, 1.98, 0.30],
    [-2.30, 1.12, 0.26], [-1.52, 2.14, 0.22], [-2.20, 1.95, 0.22],
    [-2.42, 2.10, 0.24], [-1.95, 2.35, 0.26], [-1.25, 2.45, 0.24],
  ];
  for (const [ex, ez, rad] of EXTRA) {
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * rad;
      pushTree(ex + Math.cos(a) * rr, ez + Math.sin(a) * rr);
    }
  }

  // ===== 鸟居正前挡住视线的树：移到河岸边（顺着溪流长成一排）=====
  {
    const blocked = trees.filter((t) => inToriiClear(t.x, t.z, 1.16, -0.10, 1.86));
    for (const tr of blocked) {
      const { i } = distToStream(tr.x, tr.z);
      const p = STREAM_RAW[i];
      const q = STREAM_RAW[Math.min(STREAM_RAW.length - 1, i + 3)];
      const tx = q[0] - p[0], tz = q[1] - p[1];
      const tl = Math.hypot(tx, tz) || 1;
      const nx = -tz / tl, nz = tx / tl;
      let best = null, bestD = -1;
      for (const sgn of [1, -1]) {
        for (const off of [0.60, 0.76, 0.92, 1.08]) {
          const cx = p[0] + nx * off * sgn, cz = p[1] + nz * off * sgn;
          const rr = Math.hypot(cx, cz);
          if (rr > rimR(Math.atan2(cz, cx)) - 0.30) continue;
          if (inToriiClear(cx, cz, 1.06, -0.20, 1.78)) continue;
          if (Math.hypot(cx - PEAK.x, cz - PEAK.z) < 0.90) continue;
          if (Math.hypot(cx - SHRINE_SITE.x, cz - SHRINE_SITE.z) < SHRINE_SITE.r + 0.10) continue;
          const y = terrain(cx, cz);
          if (y > 1.30) continue;
          const sco = Math.hypot(terrain(cx + 0.14, cz) - y, terrain(cx, cz + 0.14) - y) / 0.14;
          if (sco > 0.78) continue;
          let clash = false;
          for (const o of trees) {
            if (o === tr) continue;
            if ((o.x - cx) ** 2 + (o.z - cz) ** 2 < 0.052) { clash = true; break; }
          }
          if (clash) continue;
          // 优先挪到离牌坊更远的一侧河岸（等于挪过了河），别又挡在视线上
          const dTorii = Math.hypot(cx - SHRINE_SITE.x, cz - SHRINE_SITE.z);
          if (dTorii > bestD) { bestD = dTorii; best = { x: cx, z: cz, y }; }
        }
      }
      if (best) {
        tr.x = best.x;
        tr.z = best.z;
        tr.y = best.y - 0.02;
        tr.moved = true;
      } else {
        tr.gone = true;
      }
    }
    for (let i = trees.length - 1; i >= 0; i--) if (trees[i].gone) trees.splice(i, 1);

    if (typeof window !== 'undefined' && window.__islandDebug) {
      window.__islandDebug.relocated = blocked.map((t) => [+t.x.toFixed(2), +t.z.toFixed(2)]);
    }
  }

  // ===== 构图微调：鸟居正前方留白，删掉挡在草地上的几棵（按坐标定点）=====
  {
    const PRUNE = [
      [0.47, 2.13], [0.45, 2.47], [0.80, 2.25], [0.79, 2.47],
    ];
    for (let i = trees.length - 1; i >= 0; i--) {
      const t = trees[i];
      if (PRUNE.some(([px, pz]) => Math.hypot(t.x - px, t.z - pz) < 0.14)) trees.splice(i, 1);
    }
  }

  // 树冠下的接触阴影（近似 AO）
  for (let i = 0; i < vCount; i++) {
    const x = positions[i * 3], z = positions[i * 3 + 2];
    let near = 9;
    for (const t of trees) {
      const d = (t.x - x) * (t.x - x) + (t.z - z) * (t.z - z);
      if (d < near) near = d;
    }
    gInfo[i].ao = Math.exp(-Math.sqrt(near) / 0.26) * 0.75;
  }

  const trunkGeo = (() => {
    const parts = [];
    const t = new THREE.CylinderGeometry(0.018, 0.042, 0.82, 6, 4);
    t.translate(0, 0.41, 0);
    parts.push(t);
    const branchSpec = [[0.42, 0.3, 0.30, 0.85], [0.56, 2.5, 0.28, 0.75], [0.68, 4.3, 0.24, 0.6], [0.78, 5.4, 0.2, 0.5]];
    for (const [y, ang, len, tilt] of branchSpec) {
      const b = new THREE.CylinderGeometry(0.004, 0.009, len, 4, 1);
      b.translate(0, len / 2, 0);
      b.rotateZ(tilt);
      b.rotateY(ang);
      b.translate(0, y, 0);
      parts.push(b);
    }
    return mergeGeos(parts);
  })();

  const birchCrownGeo = makeCrown(31, {
    branches: 7, per: 4, quads: 5, len: 0.42, tilt0: 0.36, tilt1: 0.5,
    baseY: 0.70, rise: 0.92, q0: 0.13, q1: 0.22, jit: 0.10, core: 14, coreY: 0.10,
  });
  const mapleCrownGeo = makeCrown(57, {
    branches: 8, per: 4, quads: 5, len: 0.52, tilt0: 0.42, tilt1: 0.56,
    baseY: 0.56, rise: 0.95, q0: 0.16, q1: 0.25, jit: 0.12, core: 16, coreY: 0.11,
  });
  const coniferParts = [];
  {
    const r2 = mulberry32(73);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const rad = 0.23 * (1 - t * 0.78) * (0.9 + r2() * 0.2);
      const hh = 0.24 * (1 - t * 0.22);
      const c = new THREE.ConeGeometry(rad, hh, 8, 1);
      jitterVerts(c, r2, 0.22);
      c.translate(0, 0.58 + t * 0.46 + hh / 2, 0);
      tintGeo(c, 0.70 + t * 0.52);
      coniferParts.push(c);
    }
  }
  const coniferCrownGeo = mergeGeos(coniferParts);

  const canopyMatDecid = new THREE.MeshStandardMaterial({
    map: leafClusterCard(128), color: 0xffffff, roughness: 0.9, metalness: 0,
    alphaTest: 0.42, side: THREE.DoubleSide, envMapIntensity: 0.5,
    vertexColors: true,
  });
  const canopyMatConifer = new THREE.MeshStandardMaterial({
    map: leafMottle(256, 2.0), color: 0xffffff, roughness: 0.94, metalness: 0,
    flatShading: true, envMapIntensity: 0.34, vertexColors: true,
  });

  const birchTrunkMat = new THREE.MeshStandardMaterial({
    map: birchBark(), color: 0xe6ddcd, roughness: 0.88, metalness: 0, envMapIntensity: 0.3,
  });
  const darkTrunkMat = new THREE.MeshStandardMaterial({
    map: darkBark(), color: 0x9c8b76, roughness: 0.94, metalness: 0, envMapIntensity: 0.2,
  });

  const bySpecies = { birch: [], maple: [], asp: [], conifer: [] };
  trees.forEach((t) => bySpecies[t.sp].push(t));

  const mkTrunkMesh = (list, mat) => {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(trunkGeo, mat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    list.forEach((t, i) => {
      e.set(0, t.rot, 0); q.setFromEuler(e);
      sv.set(t.s, t.s * (t.sp === 'conifer' ? 1.1 : 1), t.s);
      pv.set(t.x, t.y, t.z);
      m.compose(pv, q, sv);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const mkCanopyMesh = (list, geo, mat, rotJitter) => {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    mesh.userData.items = [];
    list.forEach((t, i) => {
      e.set(0, t.rot + (rnd() - 0.5) * rotJitter, 0); q.setFromEuler(e);
      const sc = t.s;
      sv.set(sc * (0.92 + rnd() * 0.16), sc * (0.9 + rnd() * 0.22), sc * (0.92 + rnd() * 0.16));
      pv.set(t.x, t.y, t.z);
      m.compose(pv, q, sv);
      mesh.setMatrixAt(i, m);
      mesh.userData.items.push({ ci: t.ci, tint: t.tint });
      mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    // 树冠不接收别的树冠投下的阴影：密集树林里会互相压黑，丢掉透亮感
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  };

  mkTrunkMesh([...bySpecies.birch, ...bySpecies.asp], birchTrunkMat);
  mkTrunkMesh([...bySpecies.maple, ...bySpecies.conifer], darkTrunkMat);
  const birchCanopy = mkCanopyMesh(bySpecies.birch, birchCrownGeo, canopyMatDecid.clone(), 1.4);
  const mapleCanopy = mkCanopyMesh(bySpecies.maple, mapleCrownGeo, canopyMatDecid.clone(), 1.6);
  const aspCanopy = mkCanopyMesh(bySpecies.asp, mapleCrownGeo, canopyMatDecid.clone(), 1.6);
  const coniferCanopy = mkCanopyMesh(bySpecies.conifer, coniferCrownGeo, canopyMatConifer, 1.4);
  const canopies = [birchCanopy, mapleCanopy, aspCanopy, coniferCanopy].filter(Boolean);

  // ===== 落叶 =====
  const leafTex = leafCard(64);
  const leafGeo = new THREE.PlaneGeometry(0.06, 0.06);
  leafGeo.rotateX(-Math.PI / 2);
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide,
    roughness: 0.85, metalness: 0, depthWrite: false, opacity: 0,
  });
  const leafSpots = [];
  for (const t of trees) {
    if (t.sp === 'conifer') continue;
    const n = 4 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const rr = 0.08 + rnd() * 0.5;
      const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
      leafSpots.push({ x, y: terrain(x, z) + 0.01, z, r: rnd() * 6.28, s: 0.6 + rnd() * 0.8, c: rnd() });
    }
  }
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafSpots.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    leafSpots.forEach((t, i) => {
      e.set((rnd() - 0.5) * 0.1, t.r, (rnd() - 0.5) * 0.1); q.setFromEuler(e);
      sv.set(t.s, 1, t.s);
      pv.set(t.x, t.y, t.z);
      m.compose(pv, q, sv);
      leafMesh.setMatrixAt(i, m);
    });
    leafMesh.instanceMatrix.needsUpdate = true;
    leafMesh.castShadow = false;
    leafMesh.receiveShadow = true;
  }
  group.add(leafMesh);

  // ===== 岩壁凸起 + 垂根 + 边缘草披 =====
  const cliffRocks = [];
  const cliffGeo = new THREE.DodecahedronGeometry(0.2, 0);
  jitterVerts(cliffGeo, rnd, 0.55);
  cliffGeo.computeVertexNormals();
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true, envMapIntensity: 0.2 });
  for (let i = 0; i < 26; i++) {
    const j = Math.floor(rnd() * SEG);
    const f = 0.06 + rnd() * 0.82;
    const a = (j / SEG) * Math.PI * 2;
    const k = Math.min(KN, Math.max(1, Math.round(f * KN)));
    const base = skirt[k][j];
    const out = 0.7 + rnd() * 0.5;
    cliffRocks.push({
      x: base.x * (0.995 + 0.006 * out),
      y: base.y + (rnd() - 0.5) * 0.07,
      z: base.z * (0.995 + 0.006 * out),
      s: 0.22 + rnd() * 0.45,
      r: rnd() * 6.28,
      c: rnd(),
      f,
    });
  }
  const cliffMesh = new THREE.InstancedMesh(cliffGeo, cliffMat, cliffRocks.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    cliffRocks.forEach((t, i) => {
      e.set(rnd() * 2.5, t.r, rnd() * 2.5); q.setFromEuler(e);
      sv.set(t.s * (0.7 + rnd() * 0.7), t.s * (0.5 + rnd() * 0.6), t.s * (0.7 + rnd() * 0.7));
      pv.set(t.x, t.y, t.z);
      m.compose(pv, q, sv);
      cliffMesh.setMatrixAt(i, m);
    });
    cliffMesh.instanceMatrix.needsUpdate = true;
    cliffMesh.castShadow = true;
    cliffMesh.receiveShadow = true;
  }
  cliffMesh.name = 'cliffRocks';
  group.add(cliffMesh);

  // 垂下的根系
  const rootGeo = new THREE.CylinderGeometry(0.004, 0.011, 1, 4, 1);
  rootGeo.translate(0, -0.5, 0);
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x5b4630, roughness: 0.95, metalness: 0 });
  const roots = [];
  for (let i = 0; i < 26; i++) {
    const j = Math.floor(rnd() * SEG);
    const a = (j / SEG) * Math.PI * 2;
    const base = skirt[1][j];
    roots.push({ x: base.x * 0.996, y: base.y + 0.02, z: base.z * 0.996, len: 0.10 + rnd() * 0.26, r: rnd() * 6.28, tilt: (rnd() - 0.5) * 0.5 });
  }
  const rootMesh = new THREE.InstancedMesh(rootGeo, rootMat, roots.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    roots.forEach((t, i) => {
      e.set(t.tilt, t.r, t.tilt * 0.6); q.setFromEuler(e);
      sv.set(1, t.len, 1);
      pv.set(t.x, t.y, t.z);
      m.compose(pv, q, sv);
      rootMesh.setMatrixAt(i, m);
    });
    rootMesh.instanceMatrix.needsUpdate = true;
  }
  rootMesh.name = 'roots';
  group.add(rootMesh);

  // 边缘草披
  const fringe = [];
  for (let i = 0; i < 420; i++) {
    const j = Math.floor(rnd() * SEG);
    const a = (j / SEG) * Math.PI * 2;
    const rr = rimRad[j] * (0.965 + rnd() * 0.045);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    fringe.push({ x, y: terrain(x, z) - 0.01, z, s: 0.7 + rnd() * 0.7, r: rnd() * 6.28, tilt: 0.5 + rnd() * 0.6, out: a });
  }
  const fringeMesh = new THREE.InstancedMesh(tuftGeo, tuftMat, fringe.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    fringe.forEach((t, i) => {
      e.set(t.tilt, t.r, 0); q.setFromEuler(e);
      sv.set(t.s, t.s * 0.9, t.s);
      pv.set(t.x, t.y, t.z);
      m.compose(pv, q, sv);
      fringeMesh.setMatrixAt(i, m);
    });
    fringeMesh.instanceMatrix.needsUpdate = true;
    fringeMesh.receiveShadow = true;
  }
  fringeMesh.name = 'fringe';
  group.add(fringeMesh);

  // ===== 悬浮碎石 =====
  const floaters = [];
  const floaterMat = new THREE.MeshStandardMaterial({ color: 0x8d8375, roughness: 1, metalness: 0, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.DodecahedronGeometry(0.05 + rnd() * 0.045, 0);
    jitterVerts(geo, rnd, 0.4);
    const mesh = new THREE.Mesh(geo, floaterMat);
    const a = Math.PI + (rnd() - 0.5) * 1.4;
    const rr = 0.5 + rnd() * 0.65;
    mesh.position.set(Math.cos(a) * rr, -1.7 - rnd() * 0.45, Math.sin(a) * rr);
    mesh.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    mesh.userData.spin = (rnd() - 0.5) * 0.2;
    mesh.userData.phase = rnd() * 6.28;
    mesh.userData.baseY = mesh.position.y;
    group.add(mesh);
    floaters.push(mesh);
  }

  // ===== 四季着色 =====
  const SNOWC2 = new THREE.Color(0xf8fbfc);
  const SNOWC3 = new THREE.Color(0xeff5f8);
  const WHITE = new THREE.Color(0xffffff);
  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  const cc = new THREE.Color();

  function apply(p) {
    const gc = groundGeo.attributes.color;
    for (let i = 0; i < vCount; i++) {
      const info = gInfo[i];
      const patch = fbm(info.var * 6.1 + info.slope, info.dirt * 5.3 + 2, 2);
      const gx = positions[i * 3], gz = positions[i * 3 + 2];
      const macro = fbm(gx * 0.92 + 4, gz * 0.92 + 9, 3);
      const fine = fbm(gx * 4.4 + 17, gz * 4.4 + 3, 2);
      tmp.copy(p.grass[0]).lerp(p.grass[1], clamp(info.var * 0.85 + (patch - 0.5) * 0.7 + (macro - 0.5) * 0.75, 0, 1));
      tmp.offsetHSL((macro - 0.5) * 0.025, (patch - 0.5) * 0.14 + (macro - 0.5) * 0.1, (fine - 0.5) * 0.08);
      tmp2.copy(p.dirt).multiplyScalar(0.9 + info.var * 0.18);
      tmp.lerp(tmp2, clamp(info.dirt, 0, 1) * 0.85);
      if (info.wet > 0.001) tmp.multiplyScalar(1 - info.wet * 0.16).lerp(p.dirt, info.wet * 0.28);
      if (info.ao) tmp.multiplyScalar(1 - info.ao);
      if (p.snow > 0.01) tmp.lerp(SNOWC2, p.snow * (0.32 + 0.55 * (1 - clamp(info.slope, 0, 1))));
      gc.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    gc.needsUpdate = true;

    const rc = rockGeo.attributes.color;
    for (let i = 0; i < rc.count; i++) {
      const f = rInfo[i * 2];
      const n = rInfo[i * 2 + 1];
      tmp.copy(p.dirt).multiplyScalar(0.46 + n * 0.22);
      tmp.lerp(p.rock[0], smoothstep(0.10, 0.55, f) * 0.60);
      tmp.lerp(p.rock[1], smoothstep(0.35, 1.00, f) * 0.52);
      const band = fbm(f * 11.5 + 2, n * 3.5 + 1, 2);
      tmp.multiplyScalar((1 - 0.09 * f) * (0.78 + band * 0.46));
      if (f < 0.055) tmp.lerp(p.moss, 0.6 * (1 - f / 0.055));
      if (p.snow > 0.01) tmp.lerp(SNOWC3, p.snow * (f < 0.2 ? 0.6 : 0.12) * n);
      rc.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    rc.needsUpdate = true;

    const pc = skinGeo.attributes.color;
    for (let i = 0; i < pc.count; i++) {
      const y = skinInfo[i * 2];
      const n = skinInfo[i * 2 + 1];
      const strata = fbm(y * 6.2 + 3, n * 4.1 + 7, 2);
      tmp.setRGB(0.31, 0.305, 0.285).lerp(p.rock[1], 0.45).multiplyScalar((0.8 + n * 0.34) * (0.84 + strata * 0.34));
      const snowLine = 1.30 - p.snow * 0.40 + (n - 0.5) * 0.17;
      const sAmt = smoothstep(snowLine, snowLine + 0.17, y);
      tmp.lerp(SNOWC2, sAmt * 0.14);
      const fade = smoothstep(0.86, 1.16, y);
      pc.setXYZW(i, tmp.r, tmp.g, tmp.b, fade);
    }
    pc.needsUpdate = true;

    for (const mesh of canopies) {
      const items = mesh.userData.items;
      const isCon = mesh === coniferCanopy;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const arr = isCon ? p.conifer : p.canopy;
        cc.copy(arr[it.ci % arr.length]);
        cc.offsetHSL(0, 0, (it.tint - 0.5) * 0.09);
        if (p.snow > 0.01) cc.lerp(SNOWC3, p.snow * (isCon ? 0.4 : 0.58));
        mesh.setColorAt(i, cc);
      }
      mesh.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < tufts.length; i++) {
      const t = tufts[i];
      cc.copy(p.grass[1]).lerp(p.grass[0], t.c).multiplyScalar(0.88 + t.c * 0.2);
      if (p.snow > 0.01) cc.lerp(SNOWC2, p.snow * 0.78);
      tuftMesh.setColorAt(i, cc);
    }
    if (tuftMesh.instanceColor) tuftMesh.instanceColor.needsUpdate = true;

    for (let i = 0; i < mosses.length; i++) {
      const t = mosses[i];
      cc.copy(p.moss).multiplyScalar(0.8 + t.c * 0.32);
      if (p.snow > 0.01) cc.lerp(SNOWC2, p.snow * 0.66);
      mossMesh.setColorAt(i, cc);
    }
    if (mossMesh.instanceColor) mossMesh.instanceColor.needsUpdate = true;

    for (let i = 0; i < rocks.length; i++) {
      const t = rocks[i];
      cc.copy(p.rock[1]).lerp(p.rock[0], t.c * 0.55).multiplyScalar(0.64 + t.c * 0.26);
      if (p.snow > 0.01) cc.lerp(SNOWC3, p.snow * 0.5);
      rockMesh2.setColorAt(i, cc);
    }
    if (rockMesh2.instanceColor) rockMesh2.instanceColor.needsUpdate = true;

    if (p.particle === 'leaf') {
      for (let i = 0; i < leafSpots.length; i++) {
        const t = leafSpots[i];
        cc.copy(p.canopy[0]).lerp(p.canopy[2], t.c).multiplyScalar(0.85 + t.c * 0.2);
        leafMesh.setColorAt(i, cc);
      }
      if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < cliffRocks.length; i++) {
      const t = cliffRocks[i];
      cc.copy(p.rock[1]).lerp(p.rock[0], t.c * 0.6).multiplyScalar(0.58 + t.c * 0.24);
      if (fbm(t.x * 2, t.z * 2, 2) > 0.55) cc.lerp(p.moss, 0.25);
      if (p.snow > 0.01) cc.lerp(SNOWC3, p.snow * 0.45);
      cliffMesh.setColorAt(i, cc);
    }
    if (cliffMesh.instanceColor) cliffMesh.instanceColor.needsUpdate = true;
    for (let i = 0; i < fringe.length; i++) {
      const t = fringe[i];
      cc.copy(p.grass[1]).lerp(p.grass[0], t.s % 1).multiplyScalar(0.82 + (t.s % 0.3));
      if (p.snow > 0.01) cc.lerp(SNOWC2, p.snow * 0.7);
      fringeMesh.setColorAt(i, cc);
    }
    if (fringeMesh.instanceColor) fringeMesh.instanceColor.needsUpdate = true;


    waterMat.color.copy(WHITE).lerp(p.water, 0.40);
    waterMat.emissive.copy(p.water).multiplyScalar(0.44);
    waterMat.roughness = Math.max(0.2, p.waterRough);
    waterMat.envMapIntensity = 0.34;
    waterMat.opacity = 0.95 - p.snow * 0.2;
    foamMat.opacity = 0.42 + p.snow * 0.30;
    if (iceMesh) {
      iceMat.opacity = p.snow * 0.9;
      iceMesh.visible = p.snow > 0.02;
    }
    if (driftMesh) {
      driftMat.opacity = Math.min(1, p.snow * 1.1);
      driftMesh.visible = p.snow > 0.03;
    }
    mistMat.opacity = 0.16 + p.snow * 0.10;
    snowMat.opacity = p.snow * 0.95;
    snowLayer.visible = p.snow > 0.02;
  }

  function setLeaf(v) {
    leafMat.opacity = v;
    leafMesh.visible = v > 0.02;
  }
  setLeaf(0);

  return {
    group, apply, setLeaf, ground, groundGeo, snowLayer, snowMat,
    rockMesh, rockGeo, peakMesh, skinGeo,
    canopies, coniferCanopy, trees, floaters, waterMat, waterMap, foamMat, foamTex, mistMat,
    rimRad, SEG, PEAK, water, streamList: STREAM, tuftMesh, tufts,
  };
}

export function updateCanopyColor() {}
