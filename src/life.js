import * as THREE from 'three';
import { terrain, rimR, SHRINE_SITE } from './island.js';
import { buildShrine } from './shrine.js';

// ============================================================
// 岛上生活：夏天的花与人、秋天的狗、冬天的冰上玩伴
// 全部用最省的几何体拼，靠体态和动作说话（沙盘尺度，人物约 0.2 高）
// ============================================================

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// 沙盘里人物/狗略微夸张，否则在 400px 的摆件窗口里读不出来
const SC = 2.05;   // 儿童
const DS = 2.45;   // 狗
const lerp = (a, b, t) => a + (b - a) * t;

// 鸟居正前方那片草地（神社本地坐标 lx 0.10 / lz 1.00 → 世界坐标）
// 夏天野餐的垫子固定放这里：牌坊、石阶都看得见，不会被树挡住；
// 花甸生成时也在这里留空，免得野花从垫子里穿出来。
const PICNIC = { x: -0.68, z: 1.09 };

function M(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.82,
    metalness: 0,
    flatShading: o.flat !== false,
    side: o.side ?? THREE.FrontSide,
    envMapIntensity: 0.3,
  });
}

function put(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// 整组透明度：权重满时回到不透明，省掉无谓的透明排序
function fade(root, w) {
  const vis = w > 0.015;
  root.visible = vis;
  if (!vis) return;
  const solid = w > 0.985;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (!m || o.userData.keepMat || m.userData.keepMat) return;
    if (solid) {
      if (m.transparent) {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
        m.needsUpdate = true;
      }
    } else if (!m.transparent || m.opacity !== w) {
      m.transparent = true;
      m.opacity = w;
      m.depthWrite = w > 0.72;
      m.needsUpdate = true;
    }
  });
}

// ---------- 布纹（野餐垫） ----------
function blanketTex(a = '#E9DCC2', b = '#C1594A', c = '#F1EADA') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = a;
  g.fillRect(0, 0, 96, 96);
  for (let i = 0; i < 96; i += 16) {
    g.fillStyle = b;
    g.fillRect(i, 0, 8, 96);
    g.globalAlpha = 0.5;
    g.fillStyle = c;
    g.fillRect(i, 0, 2, 96);
    g.globalAlpha = 1;
  }
  for (let i = 0; i < 96; i += 32) {
    g.globalAlpha = 0.45;
    g.fillStyle = c;
    g.fillRect(0, i, 96, 4);
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// ============================================================
// 人物：面朝 +Z
// ============================================================
function makeChild(o = {}) {
  const g = new THREE.Group();
  const skin = M(o.skin ?? 0xF3C9A4, { rough: 0.7 });
  const shirt = M(o.shirt ?? 0xE4572E, { rough: 0.8 });
  const pants = M(o.pants ?? 0x3B4A63, { rough: 0.85 });
  const shoe = M(o.shoe ?? 0x35302B, { rough: 0.9 });
  const hairM = M(o.hair ?? 0x2C231C, { rough: 0.92 });

  const hipY = 0.082;
  const legLen = 0.082;
  const legGeo = new THREE.CylinderGeometry(0.0115, 0.0092, legLen, 5);
  legGeo.translate(0, -legLen / 2, 0);
  const footGeo = new THREE.BoxGeometry(0.020, 0.013, 0.031);
  footGeo.translate(0, -legLen + 0.005, 0.007);

  const legs = [];
  for (const s of [-1, 1]) {
    const lg = new THREE.Group();
    lg.position.set(s * 0.0155, hipY, 0);
    put(lg, legGeo, pants);
    put(lg, footGeo, shoe);
    g.add(lg);
    legs.push(lg);
  }

  put(g, new THREE.CapsuleGeometry(0.0265, 0.048, 3, 8), shirt, 0, hipY + 0.050, 0);

  const armLen = 0.056;
  const armGeo = new THREE.CylinderGeometry(0.0098, 0.0078, armLen, 5);
  armGeo.translate(0, -armLen / 2, 0);
  const handGeo = new THREE.SphereGeometry(0.0092, 6, 5);
  const arms = [];
  for (const s of [-1, 1]) {
    const ag = new THREE.Group();
    ag.position.set(s * 0.0275, hipY + 0.072, 0);
    put(ag, armGeo, shirt);
    put(ag, handGeo, skin, 0, -armLen, 0);
    g.add(ag);
    arms.push(ag);
  }

  const headG = new THREE.Group();
  headG.position.set(0, hipY + 0.075 + 0.032, 0);
  put(headG, new THREE.SphereGeometry(0.0248, 10, 8), skin);
  const hair = put(headG, new THREE.SphereGeometry(0.0258, 10, 8), hairM, 0, 0.002, -0.004);
  hair.scale.set(1, 0.9, 1);
  g.add(headG);

  if (o.hat === 'sun') {
    const hatM = M(o.hatColor ?? 0xF2C230, { rough: 0.78 });
    put(headG, new THREE.CylinderGeometry(0.050, 0.053, 0.0038, 14), hatM, 0, 0.015, 0);
    put(headG, new THREE.CylinderGeometry(0.0235, 0.0275, 0.017, 12), hatM, 0, 0.025, 0);
    put(headG, new THREE.TorusGeometry(0.0246, 0.0026, 4, 12), hatM, 0, 0.030, 0).rotation.x = Math.PI / 2;
    hair.visible = false;
  } else if (o.hat === 'cap') {
    const hatM = M(o.hatColor ?? 0x2F6DB5, { rough: 0.78 });
    const dome = put(headG, new THREE.SphereGeometry(0.0258, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), hatM, 0, 0.005, 0);
    dome.scale.set(1, 0.88, 1);
    const brim = put(headG, new THREE.BoxGeometry(0.040, 0.004, 0.026), hatM, 0, 0.010, 0.024);
    brim.rotation.x = -0.14;
    hair.visible = false;
  }

  g.scale.setScalar(o.scale ?? SC);
  return { g, legs, arms, head: headG, hipY };
}

// ============================================================
// 狗：面朝 +X
// ============================================================
function makeDog(o = {}) {
  const g = new THREE.Group();
  const sc = o.size ?? 1;
  const furM = M(o.fur ?? 0xC8944E, { rough: 0.93 });
  const fur2M = M(o.fur2 ?? o.fur ?? 0xC8944E, { rough: 0.93 });
  const noseM = M(0x2B2622, { rough: 0.5 });

  const bodyR = 0.0195 * sc;
  const bodyL = 0.050 * sc;
  const bodyGeo = new THREE.CapsuleGeometry(bodyR, bodyL, 3, 8);
  bodyGeo.rotateZ(Math.PI / 2);
  put(g, bodyGeo, furM, 0, 0.036 * sc, 0);

  if (o.fluff) {
    for (let i = 0; i < 5; i++) {
      const b = put(g, new THREE.SphereGeometry(bodyR * (0.66 + (i % 2) * 0.2), 6, 5), fur2M,
        (i / 4 - 0.5) * bodyL * 1.0, 0.040 * sc + (i % 2) * 0.004 * sc, (i % 3 - 1) * bodyR * 0.5);
      b.scale.set(1, 0.95, 1);
    }
  }

  const legLen = 0.031 * sc;
  const legGeo = new THREE.CylinderGeometry(0.0058 * sc, 0.0052 * sc, legLen, 5);
  legGeo.translate(0, -legLen / 2, 0);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const lg = new THREE.Group();
    lg.position.set(((i >> 1) - 0.5) * 2 * bodyL * 0.36, 0.032 * sc, (((i & 1) - 0.5) * 2) * bodyR * 0.62);
    put(lg, legGeo, fur2M);
    g.add(lg);
    legs.push(lg);
  }

  const headG = new THREE.Group();
  headG.position.set(bodyL * 0.5 + bodyR * 0.55, 0.047 * sc, 0);
  put(headG, new THREE.SphereGeometry(bodyR * 0.92, 8, 7), furM);
  const muzzleL = (o.longMuzzle ? 0.024 : 0.014) * sc;
  put(headG, new THREE.BoxGeometry(muzzleL, bodyR * 0.62, bodyR * 0.7), fur2M, muzzleL * 0.55, -0.004 * sc, 0);
  put(headG, new THREE.SphereGeometry(0.0042 * sc, 5, 4), noseM, muzzleL * 1.02, -0.003 * sc, 0);
  const earGeo = new THREE.BoxGeometry(0.005, 0.024 * sc, 0.013 * sc);
  earGeo.translate(0, -0.011 * sc, 0);
  for (const s of [-1, 1]) {
    const ear = put(headG, earGeo, fur2M, -0.003 * sc, 0.010 * sc, s * bodyR * 0.84);
    ear.rotation.x = s * 0.34;
    ear.rotation.z = -0.26;
  }
  // 项圈
  const collar = put(headG, new THREE.TorusGeometry(bodyR * 0.66, 0.0028 * sc, 4, 10), M(o.collar ?? 0xC24A38, { rough: 0.55 }), -bodyR * 0.55, -0.002 * sc, 0);
  collar.rotation.y = Math.PI / 2;
  g.add(headG);

  const tailG = new THREE.Group();
  tailG.position.set(-bodyL * 0.52, 0.043 * sc, 0);
  const tailGeo = new THREE.ConeGeometry(0.0065 * sc, o.fluff ? 0.026 : 0.032, 6);
  tailGeo.translate(0, 0.014 * sc, 0);
  const tail = put(tailG, tailGeo, fur2M);
  tail.rotation.x = -0.5;
  g.add(tailG);

  g.scale.setScalar(DS);
  return { g, legs, head: headG, tail: tailG, sc };
}

// ============================================================
// 主构建
// ============================================================
export function buildLife(island, seed = 5) {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const group = new THREE.Group();
  const stream = island.streamList || [];
  const trees = island.trees || [];

  const nearTree = (x, z, r) => {
    for (const t of trees) if (Math.hypot(t.x - x, t.z - z) < r) return true;
    return false;
  };
  const slopeAt = (x, z) =>
    Math.hypot(
      (terrain(x + 0.08, z) - terrain(x - 0.08, z)) / 0.16,
      (terrain(x, z + 0.08) - terrain(x, z - 0.08)) / 0.16
    );

  // 直接扫 stream 数组，避开 distToStream 索引偏移的问题
  const tuftsMesh = island.tuftMesh;
  const tuftsList = island.tufts;
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
  function clearGrass(x, z, r) {
    if (!tuftsMesh || !tuftsList) return;
    let dirty = false;
    for (let i = 0; i < tuftsList.length; i++) {
      const t = tuftsList[i];
      if (Math.hypot(t.x - x, t.z - z) < r) {
        tuftsMesh.setMatrixAt(i, zeroM);
        dirty = true;
      }
    }
    if (dirty) tuftsMesh.instanceMatrix.needsUpdate = true;
  }

  function streamDist(x, z) {
    let best = 1e9, hw = 0.2;
    for (let i = 0; i < stream.length; i++) {
      const p = stream[i];
      const dx = x - p.x, dz = z - p.z;
      const d = dx * dx + dz * dz;
      if (d < best) { best = d; hw = p.hw; }
    }
    return { d: Math.sqrt(best), hw };
  }

  function pickSpot({ cx = 0, cz = 0.9, rx = 1.0, rz = 0.8, streamGap = 0.42, treeGap = 0.26, maxSlope = 0.45, tries = 400 }) {
    let best = null, bestScore = -1e9;
    for (let i = 0; i < tries; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      const x = cx + Math.cos(a) * rx * r;
      const z = cz + Math.sin(a) * rz * r;
      if (Math.hypot(x, z) > rimR(Math.atan2(z, x)) * 0.86) continue;
      const ds = streamDist(x, z);
      if (ds.d < ds.hw + streamGap) continue;
      if (nearTree(x, z, treeGap)) continue;
      const sl = slopeAt(x, z);
      if (sl > maxSlope) continue;
      const y = terrain(x, z);
      if (y > 1.02 || y < -0.12) continue;
      const score = z * 0.55 - sl * 1.6 - ds.d * 0.06 + rnd() * 0.25;
      if (score > bestScore) { bestScore = score; best = { x, z, y, sl }; }
    }
    return best;
  }

  // 花用均匀撒点（不做评分），否则 pickSpot 每次都会挑同一片最舒服的草地
  function meadowSpot(minTree = 0.13, maxY = 1.15) {
    for (let i = 0; i < 36; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 2.62;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x, z) > rimR(Math.atan2(z, x)) * 0.9) continue;
      const ds = streamDist(x, z);
      if (ds.d < ds.hw + 0.06) continue;
      const y = terrain(x, z);
      if (y > maxY || y < -0.2) continue;
      if (slopeAt(x, z) > 1.35) continue;
      if (nearTree(x, z, minTree)) continue;
      return { x, z, y };
    }
    return null;
  }

  function streamPoint(u, side = 0, extra = 0) {
    const n = stream.length;
    const f = clamp01(u) * (n - 1);
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    const a = stream[i], b = stream[Math.min(n - 1, i + 1)];
    const cx = lerp(a.x, b.x, k), cz = lerp(a.z, b.z, k), y = lerp(a.y, b.y, k);
    const nx = lerp(a.nx, b.nx, k), nz = lerp(a.nz, b.nz, k);
    const hw = lerp(a.hw, b.hw, k);
    const off = hw * side + extra * side;
    return { x: cx + nx * off, z: cz + nz * off, cx, cz, y, hw, nx, nz };
  }

  // ============================================================
  // 1) 高山花甸：成片生长、多花型（夏最盛）
  // ============================================================
  const flowerGroup = new THREE.Group();
  {
    // ---- 合并带顶点色的几何 ----
    function mergeColored(list) {
      const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
      let n = 0;
      flat.forEach((g) => { n += g.attributes.position.count; });
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
      let o = 0;
      for (const g of flat) {
        const cnt = g.attributes.position.count;
        P.set(g.attributes.position.array, o * 3);
        N.set(g.attributes.normal.array, o * 3);
        C.set(g.attributes.color.array, o * 3);
        o += cnt;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
      return geo;
    }

    const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _ct = new THREE.Color();
    // 沿花瓣方向做明暗渐变：根部深沉、瓣尖透亮 —— 这是「花瓣质感」的来源
    function paintGrad(geo, y0, y1, dark = 0.66, light = 1.0) {
      const pos = geo.attributes.position;
      const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const t = clamp01((pos.getY(i) - y0) / Math.max(1e-5, y1 - y0));
        const v = dark + (light - dark) * Math.pow(t, 0.65);
        col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    }

    function petalGeo(len, wid, cup, pointy) {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      if (pointy) {
        sh.bezierCurveTo(wid * 0.70, len * 0.10, wid * 0.34, len * 0.48, 0, len);
        sh.bezierCurveTo(-wid * 0.34, len * 0.48, -wid * 0.70, len * 0.10, 0, 0);
      } else {
        sh.bezierCurveTo(wid * 0.74, len * 0.16, wid * 0.62, len * 0.68, 0, len);
        sh.bezierCurveTo(-wid * 0.62, len * 0.68, -wid * 0.74, len * 0.16, 0, 0);
      }
      const g = new THREE.ShapeGeometry(sh, 3);
      paintGrad(g, 0, len, pointy ? 0.6 : 0.72, 1.0);
      g.rotateX(-Math.PI / 2 + cup);   // 放平，瓣尖微微上翘成浅碗
      return g;
    }

    function headGeo(sp) {
      const parts = [];
      for (let i = 0; i < sp.petals; i++) {
        const g = petalGeo(sp.len, sp.wid, sp.cup, sp.pointy);
        const jr = 1 + (rnd() - 0.5) * 0.16;
        g.scale(jr, jr, jr);
        g.rotateY((i / sp.petals) * Math.PI * 2 + (rnd() - 0.5) * 0.18);
        g.translate(0, 0, 0);
        parts.push(g);
      }
      return mergeColored(parts);
    }

    // ---- 花种 ----
    // cols: 单朵花的取色池；cR: 花心半径；h: 花头离地高度；s: 花头大小
    const SPECIES = [
      {
        id: 'daisy', petals: 9, len: 0.0165, wid: 0.0058, cup: 0.10, pointy: false,
        cols: [0xFFFFFF, 0xFDFBEE, 0xF6F2E2], cR: 0.0038, cCols: [0xE8A81C, 0xF2C53C],
        h: [0.085, 0.128], s: [0.85, 1.25], w: 3,
      },
      {
        id: 'cosmos', petals: 6, len: 0.0215, wid: 0.0135, cup: 0.26, pointy: false,
        cols: [0xF2913C, 0xF7C13E, 0xE9623C, 0xF0A83C], cR: 0.0040, cCols: [0x8B5220, 0xA9631F],
        h: [0.100, 0.150], s: [0.9, 1.3], w: 3,
      },
      {
        id: 'iris', petals: 5, len: 0.0195, wid: 0.0092, cup: 0.30, pointy: true,
        cols: [0x3E56C2, 0x5B4AC6, 0x2F63C8, 0x6A5AD0], cR: 0.0026, cCols: [0xE8D46A, 0xD9BE52],
        h: [0.095, 0.145], s: [0.85, 1.2], w: 3,
      },
      {
        id: 'pink', petals: 5, len: 0.0135, wid: 0.0105, cup: 0.20, pointy: false,
        cols: [0xF07FA8, 0xE86FA0, 0xF59CBB, 0xE280B0], cR: 0.0032, cCols: [0xF6E6A8, 0xE8CF7A],
        h: [0.075, 0.115], s: [0.85, 1.2], w: 2,
      },
      {
        id: 'snow', petals: 5, len: 0.0105, wid: 0.0062, cup: 0.14, pointy: false,
        cols: [0xFDFDF6, 0xF4F2E4, 0xFFFFFF], cR: 0.0024, cCols: [0xEAD46A, 0xDFC44E],
        h: [0.062, 0.095], s: [0.8, 1.1], w: 2,
      },
      {
        id: 'violet', petals: 6, len: 0.0125, wid: 0.0068, cup: 0.24, pointy: true,
        cols: [0x8A5FC8, 0x9B6BD6, 0x7A4FBE], cR: 0.0022, cCols: [0xE4D06A],
        h: [0.070, 0.105], s: [0.8, 1.1], w: 2,
      },
    ];

    // ---- 成片分布 ----
    // 先撒「花甸」中心，再在甸内密集生长；甸与甸之间留出草皮，读起来才像野花群落
    const patches = [];
    for (let i = 0; i < 178; i++) {
      const c = meadowSpot(0.10, 1.30);
      if (!c) continue;
      if (Math.hypot(c.x - SHRINE_SITE.x, c.z - SHRINE_SITE.z) < 0.66) continue;
      const nearWater = streamDist(c.x, c.z).d < 0.58;
      const pool = nearWater
        ? ['iris', 'pink', 'iris', 'daisy']
        : ['daisy', 'daisy', 'iris', 'snow', 'violet', 'cosmos', 'pink', 'cosmos'];
      patches.push({
        x: c.x, z: c.z,
        r: 0.17 + rnd() * 0.30,
        main: pool[Math.floor(rnd() * pool.length)],
        pool,
        n: 38 + Math.floor(rnd() * 56),
      });
    }

    // 前景草甸补几片（镜头左前方那片偏空）
    for (const [px, pz, pr, pm, pn] of [
      [-1.55, 1.85, 0.34, 'daisy', 74],
      [-1.05, 2.05, 0.32, 'iris', 64],
      [-2.02, 1.52, 0.26, 'pink', 46],
      [-1.30, 1.35, 0.26, 'cosmos', 40],
    ]) {
      patches.push({
        x: px, z: pz, r: pr, main: pm,
        pool: ['daisy', 'iris', 'pink', 'cosmos', 'snow', pm],
        n: pn,
      });
    }

    // 前景草甸补几片（镜头左前方那片偏空）
    for (const [px, pz, pr, pm, pn] of [
      [-1.55, 1.85, 0.34, 'daisy', 74],
      [-1.05, 2.05, 0.32, 'iris', 64],
      [-2.02, 1.52, 0.26, 'pink', 46],
      [-1.30, 1.35, 0.26, 'cosmos', 40],
    ]) {
      patches.push({
        x: px, z: pz, r: pr, main: pm,
        pool: ['daisy', 'iris', 'pink', 'cosmos', 'snow', pm],
        n: pn,
      });
    }

    const bySp = {};
    SPECIES.forEach((sp) => { bySp[sp.id] = []; });
    const centersList = [];
    const stemsList = [];

    for (const p of patches) {
      for (let k = 0; k < p.n; k++) {
        const a = rnd() * Math.PI * 2;
        const rr = Math.pow(rnd(), 0.58) * p.r;
        if (rnd() > 1 - Math.pow(rr / p.r, 1.7) * 0.5) continue;   // 外缘稀疏
        const x = p.x + Math.cos(a) * rr;
        const z = p.z + Math.sin(a) * rr;
        if (Math.hypot(x, z) > rimR(Math.atan2(z, x)) * 0.92) continue;
        const ds = streamDist(x, z);
        if (ds.d < ds.hw + 0.035) continue;
        if (Math.hypot(x - SHRINE_SITE.x, z - SHRINE_SITE.z) < 0.50) continue;
        if (Math.hypot(x - PICNIC.x, z - PICNIC.z) < 0.33) continue;
        const spId = rnd() < 0.74 ? p.main : p.pool[Math.floor(rnd() * p.pool.length)];
        const sp = SPECIES.find((q) => q.id === spId);
        if (!sp) continue;
        const y = terrain(x, z);
        if (y > 1.18 || y < -0.24) continue;
        if (slopeAt(x, z) > 1.5) continue;
        const h = lerp(sp.h[0], sp.h[1], rnd() * rnd());
        const sc = lerp(sp.s[0], sp.s[1], rnd());
        headHelper(sp, x, y, z, h, sc);
      }
    }

    // 沿溪岸补一圈鸢尾/粉色（参考图里水边那一带）
    for (let u = 0.18; u < 0.95; u += 0.055) {
      for (const side of [-1, 1]) {
        const q = streamPoint(u, side, 0.10 + rnd() * 0.12);
        if (Math.hypot(q.x - SHRINE_SITE.x, q.z - SHRINE_SITE.z) < 0.52) continue;
        if (Math.hypot(q.x - PICNIC.x, q.z - PICNIC.z) < 0.33) continue;
        const wantId = rnd() < 0.55 ? 'iris' : 'pink';
        const sp = SPECIES.find((s2) => s2.id === wantId);
        if (!sp) continue;
        const y = terrain(q.x, q.z);
        if (y > 1.1) continue;
        headHelper(sp, q.x, y, q.z, lerp(sp.h[0], sp.h[1], rnd()), lerp(sp.s[0], sp.s[1], rnd()));
      }
    }

    function headHelper(sp, x, y, z, h, sc) {
      const col = sp.cols[Math.floor(rnd() * sp.cols.length)];
      bySp[sp.id].push({
        x, z, y, h, sc,
        rot: rnd() * Math.PI * 2,
        tiltX: (rnd() - 0.5) * 0.30,
        tiltZ: (rnd() - 0.5) * 0.30,
        col,
      });
      centersList.push({
        x, z, y: y + h, r: sp.cR * sc,
        col: sp.cCols[Math.floor(rnd() * sp.cCols.length)],
      });
      stemsList.push({ x, z, y, h });
    }

    // ---- 实例化 ----
    const dummy = new THREE.Object3D();
    const cc = new THREE.Color();
    const petalMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.48, metalness: 0,
      side: THREE.DoubleSide, envMapIntensity: 0.55,
    });

    for (const sp of SPECIES) {
      const list = bySp[sp.id];
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(headGeo(sp), petalMat, list.length);
      mesh.frustumCulled = false;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        dummy.position.set(it.x, it.y + it.h, it.z);
        dummy.rotation.set(it.tiltX, it.rot, it.tiltZ);
        dummy.scale.setScalar(it.sc);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        cc.setHex(it.col);
        // 每朵花再抖一点明暗，整片才不呆板
        const v = 0.90 + rnd() * 0.18;
        cc.multiplyScalar(v);
        mesh.setColorAt(i, cc);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      flowerGroup.add(mesh);
    }

    // 花心
    {
      const cg = new THREE.CircleGeometry(1, 10);
      cg.rotateX(-Math.PI / 2);
      const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0 });
      const mesh = new THREE.InstancedMesh(cg, cm, centersList.length);
      mesh.frustumCulled = false;
      for (let i = 0; i < centersList.length; i++) {
        const it = centersList[i];
        dummy.position.set(it.x, it.y + 0.0009, it.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(it.r, 1, it.r);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        cc.setHex(it.col);
        mesh.setColorAt(i, cc);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      flowerGroup.add(mesh);
    }

    // 花茎
    {
      const sg = new THREE.CylinderGeometry(0.0015, 0.0019, 1, 4);
      sg.translate(0, 0.5, 0);
      const sm = new THREE.MeshStandardMaterial({ color: 0x4A7A34, roughness: 0.9, metalness: 0 });
      const mesh = new THREE.InstancedMesh(sg, sm, stemsList.length);
      mesh.frustumCulled = false;
      for (let i = 0; i < stemsList.length; i++) {
        const it = stemsList[i];
        dummy.position.set(it.x, it.y - 0.005, it.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, it.h, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      flowerGroup.add(mesh);
    }

    // ---- 穗状花：鲁冰花 / 薰衣草 ----
    {
      const parts = [];
      const N = 11;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const rad = 0.0105 * (1 - t * 0.72) + 0.0012;
        const g = new THREE.IcosahedronGeometry(rad, 0);
        g.translate((rnd() - 0.5) * 0.006, 0.018 + t * 0.095, (rnd() - 0.5) * 0.006);
        paintGrad(g, 0.015, 0.115, 0.62, 1.06);
        parts.push(g);
      }
      const spikeGeo = mergeColored(parts);
      const m = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.55, metalness: 0, flatShading: true, envMapIntensity: 0.4,
      });
      const pts = [];
      for (let i = 0; i < 120; i++) {
        const c = meadowSpot(0.16, 1.12);
        if (!c) continue;
        if (Math.hypot(c.x - SHRINE_SITE.x, c.z - SHRINE_SITE.z) < 0.58) continue;
        const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * 0.16;
        pts.push({ x: c.x + Math.cos(a) * rr, z: c.z + Math.sin(a) * rr, rot: rnd() * 6.28, s: 0.8 + rnd() * 0.6 });
      }
      const mesh = new THREE.InstancedMesh(spikeGeo, m, pts.length);
      mesh.frustumCulled = false;
      const SP_COL = [0x7A5BC6, 0x6C63D0, 0x4E6BC8, 0x9A6FCB, 0xC97FB8];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const gy = terrain(p.x, p.z);
        dummy.position.set(p.x, gy, p.z);
        dummy.rotation.set((rnd() - 0.5) * 0.1, p.rot, (rnd() - 0.5) * 0.1);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        cc.setHex(SP_COL[i % SP_COL.length]);
        cc.multiplyScalar(0.94 + rnd() * 0.14);
        mesh.setColorAt(i, cc);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      flowerGroup.add(mesh);
    }

    // ---- 细碎小白花（满天星那种）----
    {
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const r = 0.0028 + rnd() * 0.0022;
        const g = new THREE.IcosahedronGeometry(r, 0);
        g.translate((rnd() - 0.5) * 0.022, 0.03 + rnd() * 0.030, (rnd() - 0.5) * 0.022);
        paintGrad(g, 0.02, 0.07, 0.86, 1.0);
        parts.push(g);
      }
      const bg = mergeColored(parts);
      const bm = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.6, metalness: 0, flatShading: true, envMapIntensity: 0.4,
      });
      const pts = [];
      for (let i = 0; i < 170; i++) {
        const c = meadowSpot(0.15, 1.15);
        if (!c) continue;
        if (Math.hypot(c.x - SHRINE_SITE.x, c.z - SHRINE_SITE.z) < 0.55) continue;
        const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * 0.13;
        pts.push({ x: c.x + Math.cos(a) * rr, z: c.z + Math.sin(a) * rr, rot: rnd() * 6.28, s: 0.75 + rnd() * 0.55 });
      }
      const mesh = new THREE.InstancedMesh(bg, bm, pts.length);
      mesh.frustumCulled = false;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const gy = terrain(p.x, p.z);
        dummy.position.set(p.x, gy, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        cc.setHex(i % 9 === 0 ? 0xF6E9A6 : 0xFBFBF2);
        mesh.setColorAt(i, cc);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      flowerGroup.add(mesh);
    }

    group.add(flowerGroup);
  }

  // ============================================================
  // 1.5) 山脚神社（四季常在，冬天屋顶积雪）
  // ============================================================
  const shrine = buildShrine(terrain, SHRINE_SITE);
  group.add(shrine.group);
  clearGrass(SHRINE_SITE.x, SHRINE_SITE.z, 0.60);

  // ============================================================
  // 2) 夏天：河边钓鱼的孩子 + 野餐看书的孩子
  // ============================================================
  const folkGroup = new THREE.Group();
  group.add(folkGroup);
  const fishers = [];
  const ripples = [];

  function addRipple(x, y, z) {
    const g = new THREE.RingGeometry(0.006, 0.0082, 14);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    });
    mat.userData.keepMat = true;
    const r = new THREE.Mesh(g, mat);
    r.position.set(x, y, z);
    r.renderOrder = 4;
    folkGroup.add(r);
    ripples.push({ m: r, phase: rnd() * 6.28 });
    return r;
  }

  function addFisher({ u, side, shirt, hatColor, skin }) {
    const sp = streamPoint(u, side, 0.055);
    const gy = terrain(sp.x, sp.z);
    const g = new THREE.Group();
    g.position.set(sp.x, gy - 0.055 * SC, sp.z);
    clearGrass(sp.x, sp.z, 0.15);
    const fx = sp.cx - sp.x, fz = sp.cz - sp.z;
    g.rotation.y = Math.atan2(fx, fz);

    // 坐的石块
    const rock = put(g, new THREE.DodecahedronGeometry(0.055 * SC, 0), M(0x9C907C, { rough: 0.95 }), 0, 0.006 * SC, -0.012 * SC);
    rock.scale.set(1.2, 0.55, 1.05);
    rock.rotation.y = rnd() * 3;

    const kid = makeChild({ shirt, pants: 0x46607F, hat: 'cap', hatColor, skin });
    kid.legs[0].rotation.x = -1.2;
    kid.legs[1].rotation.x = -1.12;
    kid.legs[0].rotation.z = 0.14;
    kid.legs[1].rotation.z = -0.14;
    kid.arms[0].rotation.x = -0.9;
    kid.arms[1].rotation.x = -1.25;
    kid.arms[1].rotation.z = -0.22;
    g.add(kid.g);

    // 鱼竿：从右手伸向河面
    const rod = new THREE.Group();
    rod.position.set(-0.026, 0.078, 0.030);
    rod.rotation.x = 1.02;
    rod.rotation.z = 0.20;
    const rodGeo = new THREE.CylinderGeometry(0.0045, 0.0095, 0.26, 5);
    rodGeo.translate(0, 0.13, 0);
    put(rod, rodGeo, M(0x5A4A32, { rough: 0.7 }));
    kid.g.add(rod);

    folkGroup.add(g);
    g.updateMatrixWorld(true);

    // 竿尖世界坐标 → 决定鱼线长度
    const tipLocal = new THREE.Vector3(0, 0.26, 0).applyMatrix4(rod.matrix);
    const tipWorld = tipLocal.clone().applyMatrix4(kid.g.matrixWorld);
    const waterY = sp.y;
    const len = Math.max(0.03, tipWorld.y - (waterY + 0.004)) / SC;

    const lineGeo = new THREE.CylinderGeometry(0.0024, 0.0024, len, 3);
    lineGeo.translate(0, -len / 2, 0);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x5D6E75, transparent: true, opacity: 0.62, toneMapped: false });
    lineMat.userData.keepMat = true;
    const line = put(kid.g, lineGeo, lineMat, tipLocal.x, tipLocal.y, tipLocal.z);
    const floatM = M(0xE8522E, { rough: 0.5 });
    const fl = put(kid.g, new THREE.SphereGeometry(0.0072, 6, 5), floatM, tipLocal.x, tipLocal.y - len, tipLocal.z);
    fl.castShadow = false;

    // 小水桶
    const bucket = new THREE.Group();
    bucket.position.set(0.055 * SC, 0.001, -0.030 * SC);
    const bkM = M(0x8FA9B8, { rough: 0.6 });
    put(bucket, new THREE.CylinderGeometry(0.017, 0.014, 0.028, 8), bkM, 0, 0.014, 0);
    put(bucket, new THREE.CylinderGeometry(0.0175, 0.0175, 0.003, 8), M(0x6F8794, { rough: 0.6 }), 0, 0.029, 0);
    const bkH = put(bucket, new THREE.TorusGeometry(0.013, 0.0018, 4, 10, Math.PI), M(0x5C6B72, { rough: 0.5 }), 0, 0.028, 0);
    bkH.rotation.x = Math.PI / 2;
    g.add(bucket);

    addRipple(sp.cx, waterY + 0.003, sp.cz);
    addRipple(sp.cx + 0.02, waterY + 0.003, sp.cz - 0.015);

    fishers.push({ g, rod, kid, fl, len, phase: rnd() * 6.28, baseY: tipLocal.y });
  }

  if (stream.length > 20) {
    addFisher({ u: 0.70, side: 1, shirt: 0xE2603C, hatColor: 0x2F6DB5 });
    addFisher({ u: 0.84, side: -1, shirt: 0x4F8FB8, hatColor: 0xD9553F, skin: 0xE8B98D });
  }

  // 野餐 + 看书
  {
    // 固定在鸟居正前方的草地（以前撒点撒到了岛左前方，被树丛挡住看不见）
    const spot = { x: PICNIC.x, z: PICNIC.z, y: terrain(PICNIC.x, PICNIC.z) };

    const g = new THREE.Group();

    // 垫子这一带不留草桩子，否则把垫子和人都埋了
    clearGrass(spot.x, spot.z, 0.42);

    // 垫子：逐顶点贴合地形
    const bg = new THREE.PlaneGeometry(0.46, 0.40, 9, 9);
    bg.rotateX(-Math.PI / 2);
    bg.rotateY(0.20);
    bg.translate(spot.x, 0, spot.z);
    const bp = bg.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setY(i, terrain(bp.getX(i), bp.getZ(i)) + 0.005);
    bg.computeVertexNormals();
    const blanketMat = new THREE.MeshStandardMaterial({
      map: blanketTex(), roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const blanket = new THREE.Mesh(bg, blanketMat);
    blanket.receiveShadow = true;
    g.add(blanket);

    // 篮子
    const wick = M(0xB98A4E, { rough: 0.92 });
    const basket = new THREE.Group();
    basket.position.set(spot.x + 0.125, terrain(spot.x + 0.125, spot.z + 0.055), spot.z + 0.055);
    put(basket, new THREE.BoxGeometry(0.050, 0.028, 0.036), wick, 0, 0.014, 0);
    put(basket, new THREE.BoxGeometry(0.052, 0.006, 0.038), M(0xC79757, { rough: 0.9 }), 0, 0.030, 0).rotation.z = 0.05;
    const handle = put(basket, new THREE.TorusGeometry(0.015, 0.0026, 4, 10, Math.PI), wick, 0, 0.030, 0);
    handle.rotation.y = Math.PI / 2;
    basket.rotation.y = 0.4;
    g.add(basket);

    // 保温壶
    const th = new THREE.Group();
    th.position.set(spot.x - 0.125, terrain(spot.x - 0.125, spot.z + 0.075), spot.z + 0.075);
    put(th, new THREE.CylinderGeometry(0.012, 0.013, 0.040, 8), M(0xE4694B, { rough: 0.6 }), 0, 0.020, 0);
    put(th, new THREE.CylinderGeometry(0.011, 0.012, 0.010, 8), M(0xF2EFE6, { rough: 0.5 }), 0, 0.044, 0);
    g.add(th);

    // 小孩坐下的小坐垫（垫子上的方枕）
    const padM = M(0xD9C9AE, { rough: 0.95, flat: false });
    {
      const y0 = terrain(spot.x, spot.z);
      const pad = put(g, new THREE.BoxGeometry(0.075, 0.020, 0.070), padM, spot.x, y0 + 0.017, spot.z - 0.020);
      pad.rotation.y = 0.92;
      pad.receiveShadow = true;
    }

    // 黄帽子小孩：盘腿看书
    const kid = makeChild({ shirt: 0xAFC7DC, pants: 0x8D6B4B, hat: 'sun', hatColor: 0xF1C231, skin: 0xF6D2AE });
    kid.g.position.set(spot.x, terrain(spot.x, spot.z) - 0.030, spot.z - 0.020);
    kid.g.rotation.y = 0.78;
    kid.legs[0].rotation.x = -1.34;
    kid.legs[1].rotation.x = -1.28;
    kid.legs[0].rotation.z = 0.66;
    kid.legs[1].rotation.z = -0.66;
    kid.arms[0].rotation.x = -1.10;
    kid.arms[1].rotation.x = -1.10;
    kid.arms[0].rotation.z = 0.30;
    kid.arms[1].rotation.z = -0.30;
    g.add(kid.g);

    kid.head.rotation.x = 0.20;
    const book = new THREE.Group();
    book.position.set(0, 0.076, 0.058);
    const pageM = M(0xFBF7EC, { rough: 0.9 });
    const coverM = M(0x2F5B8C, { rough: 0.85 });
    for (const s2 of [-1, 1]) {
      const half = new THREE.Group();
      half.rotation.z = -s2 * 0.26;
      put(half, new THREE.BoxGeometry(0.030, 0.0016, 0.038), coverM, s2 * 0.015, 0, 0);
      put(half, new THREE.BoxGeometry(0.027, 0.0018, 0.034), pageM, s2 * 0.0145, 0.0018, 0);
      book.add(half);
    }
    book.rotation.x = -0.62;
    kid.g.add(book);

    const flip = new THREE.Group();
    const flipGeo = new THREE.BoxGeometry(0.026, 0.0012, 0.032);
    flipGeo.translate(0.013, 0, 0);
    put(flip, flipGeo, pageM, 0, 0.0035, 0);
    book.add(flip);

    folkGroup.add(g);
    fishers.push({ picnic: true, kid, book, flip, phase: rnd() * 6.28, spot });
  }

  // ============================================================
  // 3) 秋天的两只狗（白泰迪 + 金毛）
  // ============================================================
  const dogAGroup = new THREE.Group();
  group.add(dogAGroup);
  const dogsA = [];
  {
    const c = pickSpot({ cx: -0.15, cz: 1.55, rx: 0.85, rz: 0.6, streamGap: 0.40, treeGap: 0.22, maxSlope: 0.38, tries: 900 })
      || { x: -0.8, z: 1.0 };

    clearGrass(c.x, c.z, 0.44);
    const teddy = makeDog({ fur: 0xF4F0E4, fur2: 0xFBF8F0, fluff: true, size: 0.92 });
    const golden = makeDog({ fur: 0xC08A44, fur2: 0xD9A45C, longMuzzle: true, size: 1.05 });
    dogAGroup.add(teddy.g, golden.g);
    dogsA.push(
      { rig: teddy, cx: c.x, cz: c.z, rad: 0.30, ph: 0, speed: 0.95 },
      { rig: golden, cx: c.x, cz: c.z, rad: 0.30, ph: 1.45, speed: 0.95 }
    );
  }

  // ============================================================
  // 4) 冬天：冰面 + 滑冰 / 滑雪 + 两只雪地追跑的狗
  // ============================================================
  const playGroup = new THREE.Group();
  group.add(playGroup);
  const dogWGroup = new THREE.Group();
  group.add(dogWGroup);
  const dogsW = [];
  let iceMesh = null;
  let skater = null;
  let skier = null;

  if (stream.length > 12) {
    const pos = [], idx = [];
    for (let i = 0; i < stream.length; i++) {
      const p = stream[i];
      const w2 = p.hw * 1.04;
      pos.push(p.x + p.nx * w2, p.y + 0.013, p.z + p.nz * w2);
      pos.push(p.x, p.y + 0.016, p.z);
      pos.push(p.x - p.nx * w2, p.y + 0.013, p.z - p.nz * w2);
      if (i < stream.length - 1) {
        const a = i * 3, b = a + 3;
        idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const ca = [];
    for (let i = 0; i < stream.length; i++) {
      ca.push(1, 1, 1, 0.12, 1, 1, 1, 1, 1, 1, 1, 0.12);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(ca, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      color: 0x84C0DA, roughness: 0.05, metalness: 0, transparent: true, opacity: 0,
      clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 0.75, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -9,
    });
    m.userData.keepMat = true;
    iceMesh = new THREE.Mesh(g, m);
    iceMesh.renderOrder = 3;
    iceMesh.visible = false;
    playGroup.add(iceMesh);
  }

  {
    // 滑冰：在河面上来回滑
    const kid = makeChild({ shirt: 0xD94B62, pants: 0x33405C, skin: 0xF3C9A4, hat: 'cap', hatColor: 0xF0E6D2 });
    kid.legs[0].rotation.x = -0.26;
    kid.legs[1].rotation.x = 0.20;
    kid.arms[0].rotation.z = 1.15;
    kid.arms[1].rotation.z = -1.15;
    const bladeM = M(0xE9EDF0, { rough: 0.25 });
    for (const lg of kid.legs) put(lg, new THREE.BoxGeometry(0.004, 0.004, 0.048), bladeM, 0, -0.084, 0.008);
    const holder = new THREE.Group();
    holder.add(kid.g);
    playGroup.add(holder);
    skater = { holder, kid, u: 0.66, dir: 1, speed: 0.05 };
  }

  {
    // 滑雪：双板 + 手杖
    const kid = makeChild({ shirt: 0x2F7FA8, pants: 0x2B3242, skin: 0xE8B98D, hat: 'cap', hatColor: 0xE4572E });
    const skiM = M(0xE86A3C, { rough: 0.55 });
    for (const s2 of [-1, 1]) {
      const ski = put(kid.g, new THREE.BoxGeometry(0.013, 0.004, 0.115), skiM, s2 * 0.016, 0.0035, 0.028);
      ski.rotation.y = s2 * 0.05;
    }
    const poleM = M(0x9AA3AA, { rough: 0.4 });
    for (const s2 of [-1, 1]) {
      const p = new THREE.Group();
      p.position.set(s2 * 0.032, 0.086, 0.004);
      const pg = new THREE.CylinderGeometry(0.0018, 0.0018, 0.098, 4);
      pg.translate(0, -0.049, 0);
      put(p, pg, poleM);
      p.rotation.x = 0.4;
      p.rotation.z = s2 * 0.22;
      kid.g.add(p);
      kid[s2 < 0 ? 'poleL' : 'poleR'] = p;
    }
    kid.legs[0].rotation.x = -0.18;
    kid.legs[1].rotation.x = 0.14;
    kid.arms[0].rotation.x = -0.35;
    kid.arms[1].rotation.x = -0.35;
    const holder = new THREE.Group();
    holder.add(kid.g);
    playGroup.add(holder);
    skier = { holder, kid, u: 0.86, dir: -1, speed: 0.034, phase: 1.7 };
  }

  {
    // 雪地里追跑的两只狗
    const sp = pickSpot({ cx: -0.75, cz: 1.55, rx: 0.6, rz: 0.5, streamGap: 0.45, treeGap: 0.3, maxSlope: 0.3, tries: 600 })
      || { x: -0.75, z: 1.55 };
    clearGrass(sp.x, sp.z, 0.40);
    const black = makeDog({ fur: 0x3A3F46, fur2: 0x24282D, size: 0.95 });
    const brown = makeDog({ fur: 0x8D5A32, fur2: 0xA56B3C, longMuzzle: true, size: 0.9 });
    dogWGroup.add(black.g, brown.g);
    dogsW.push(
      { rig: black, cx: sp.x, cz: sp.z, rad: 0.24, ph: 0, speed: 1.05 },
      { rig: brown, cx: sp.x, cz: sp.z, rad: 0.24, ph: 1.5, speed: 1.05 }
    );
  }

  // ============================================================
  // 5) 秋天：两个人坐在垫子上看枫叶（会抬头、指点、端茶，不是静态摆件）
  // ============================================================
  const sitterGroup = new THREE.Group();
  group.add(sitterGroup);
  let sitters = null;
  {
    const c = pickSpot({ cx: -0.30, cz: 1.24, rx: 0.44, rz: 0.34, streamGap: 0.56, treeGap: 0.34, maxSlope: 0.30, tries: 1200 })
      || { x: -0.30, z: 1.24 };
    clearGrass(c.x, c.z, 0.46);

    const holder = new THREE.Group();
    holder.position.set(c.x, terrain(c.x, c.z), c.z);
    // 朝右前方（河对岸那片枫树）坐，镜头能看到侧脸
    const yaw = 0.30;
    holder.rotation.y = yaw;
    sitterGroup.add(holder);

    // ---- 垫子（亚麻底 + 格纹绒毯）----
    const matM = M(0xCBB79C, { rough: 0.96, flat: false });
    const rugM = M(0xB0523B, { rough: 0.94, flat: false });
    put(holder, new THREE.BoxGeometry(0.355, 0.010, 0.275), matM, 0, 0.005, 0.02);
    put(holder, new THREE.BoxGeometry(0.295, 0.007, 0.215), rugM, 0, 0.0135, 0.02);
    const stripeM = M(0xE0CBA8, { rough: 0.95, flat: false });
    for (const dz of [-0.052, 0.062]) {
      put(holder, new THREE.BoxGeometry(0.295, 0.0022, 0.008), stripeM, 0, 0.0178, 0.02 + dz);
    }
    // 两个坐垫
    const cushionM = M(0x3D4E6C, { rough: 0.9, flat: false });
    for (const sd of [-1, 1]) {
      const cu = put(holder, new THREE.BoxGeometry(0.104, 0.016, 0.094), cushionM, sd * 0.078, 0.0255, 0.034);
      cu.rotation.y = sd * 0.05;
    }
    // 小茶盘：壶 + 两只杯子
    const trayM = M(0x90714E, { rough: 0.86 });
    put(holder, new THREE.BoxGeometry(0.105, 0.007, 0.070), trayM, 0.0, 0.0205, 0.118);
    const potM = M(0x6E7C6C, { rough: 0.55, flat: false });
    const pot = put(holder, new THREE.SphereGeometry(0.026, 10, 8), potM, 0.012, 0.046, 0.114);
    pot.scale.set(1, 0.74, 1);
    put(holder, new THREE.CylinderGeometry(0.0062, 0.0072, 0.026, 6), potM, 0.036, 0.040, 0.116).rotation.z = -0.85;
    const cupM = M(0xE7DFD1, { rough: 0.7, flat: false });
    for (const cd of [-1, 1]) {
      put(holder, new THREE.CylinderGeometry(0.0088, 0.0072, 0.012, 7), cupM, cd * 0.030, 0.0265, 0.099);
    }
    // 落在毯子上的枫叶
    const leafMs = [M(0xC4402A, { flat: false }), M(0xDB8A28, { flat: false }), M(0xA82E1E, { flat: false })];
    for (let i = 0; i < 10; i++) {
      const lf = put(holder, new THREE.BoxGeometry(0.015, 0.0014, 0.011), leafMs[i % 3],
        (rnd() - 0.5) * 0.24, 0.019 + (i % 2) * 0.001, 0.04 + (rnd() - 0.5) * 0.15);
      lf.rotation.y = rnd() * Math.PI;
    }

    // ---- 两个人：盘腿坐在垫子上 ----
    const SC2 = SC * 1.30;
    const mkSeated = (o) => {
      const r = makeChild({ ...o, scale: SC2 });
      const coatM = M(o.coat ?? 0x33405C, { rough: 0.88, flat: false });
      // 外套下摆罩住臀腿
      put(r.g, new THREE.CylinderGeometry(0.031, 0.042, 0.052, 10, 1, true), coatM, 0, r.hipY - 0.020, 0);
      put(r.g, new THREE.TorusGeometry(0.0275, 0.0040, 4, 12), coatM, 0, r.hipY + 0.083, 0.001)
        .rotation.x = Math.PI / 2;
      // 大腿朝前、膝盖略垂，脚落在地上
      r.legs[0].rotation.x = -1.88;
      r.legs[1].rotation.x = -1.74;
      r.legs[0].rotation.z = 0.34;
      r.legs[1].rotation.z = -0.30;
      // 坐姿时鞋子收小一点，别像板子
      for (const lg of r.legs) {
        const f = lg.children[1];
        if (f) f.scale.set(0.82, 0.8, 0.72);
      }
      // 臀部落在坐垫上
      r.g.position.y = 0.030 - r.hipY * SC2;
      return { ...r, coatM };
    };

    // 左：深蓝外套的男性，戴毛线帽；右：橙褐外套的女性，发髻
    const a = mkSeated({ shirt: 0x2C3550, pants: 0x232A3C, coat: 0x2E3A57, skin: 0xE7BE98, hair: 0x241C17 });
    const b = mkSeated({ shirt: 0xB9663A, pants: 0x8C4C2E, coat: 0xC0693C, skin: 0xF0C9A5, hair: 0x2A1E18 });
    const beanieM = M(0x8E4630, { rough: 0.92 });
    const beanie = put(a.head, new THREE.SphereGeometry(0.0262, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), beanieM, 0, 0.006, 0);
    beanie.scale.set(1, 0.94, 1);
    put(b.head, new THREE.SphereGeometry(0.0175, 8, 6), M(0x2A1E18, { rough: 0.92 }), 0, 0.014, -0.020);
    // 手里的茶杯（跟着左手一起抬起来）
    const handCup = put(b.arms[0], new THREE.CylinderGeometry(0.0105, 0.0082, 0.0135, 8), cupM, 0, -0.062, 0.004);
    handCup.rotation.x = 0.1;

    a.g.position.x = -0.080;
    a.g.position.z = 0.030;
    a.g.rotation.y = 0.20;
    b.g.position.x = 0.082;
    b.g.position.z = 0.026;
    b.g.rotation.y = -0.16;
    holder.add(a.g, b.g);

    sitters = { holder, a, b, ph: rnd() * 6.0 };
  }

  // ============================================================
  // 6) 神社前的地藏（小石像 + 红围兜），参考图里立在石阶旁边
  // ============================================================
  const jizoGroup = new THREE.Group();
  group.add(jizoGroup);
  {
    const stoneM = M(0x99907F, { rough: 0.96 });
    const stoneD = M(0x7C7367, { rough: 0.96 });
    const bibM = M(0xC23B2E, { rough: 0.8 });
    // 站在鸟居石阶最下面一级的两侧（神社本地坐标 → 世界坐标）
    const yawS = SHRINE_SITE.yaw;
    const toW = (lx, lz) => ({
      x: SHRINE_SITE.x + lx * Math.cos(yawS) + lz * Math.sin(yawS),
      z: SHRINE_SITE.z - lx * Math.sin(yawS) + lz * Math.cos(yawS),
    });
    const spots = [
      { ...toW(0.098, 0.800), r: yawS - 0.52 },
      { ...toW(0.252, 0.766), r: yawS - 0.28 },
    ];
    for (const sp of spots) {
      const g = new THREE.Group();
      const y = terrain(sp.x, sp.z);
      g.position.set(sp.x, y, sp.z);
      g.rotation.y = sp.r;
      g.scale.setScalar(2.05);
      clearGrass(sp.x, sp.z, 0.20);
      // 石台 + 两层底座（让石像从草里露出来）
      put(g, new THREE.CylinderGeometry(0.036, 0.040, 0.015, 8), stoneD, 0, 0.0075, 0);
      put(g, new THREE.CylinderGeometry(0.027, 0.031, 0.011, 7), stoneD, 0, 0.0205, 0);
      // 身体
      put(g, new THREE.CylinderGeometry(0.0165, 0.021, 0.036, 8), stoneM, 0, 0.046, 0);
      // 头
      put(g, new THREE.SphereGeometry(0.0145, 9, 7), stoneM, 0, 0.0735, 0);
      // 红围兜
      const bib = put(g, new THREE.CylinderGeometry(0.0175, 0.0215, 0.019, 8, 1, true), bibM, 0, 0.0485, 0);
      bib.rotation.y = 0.1;
      // 合掌
      put(g, new THREE.SphereGeometry(0.0055, 6, 5), stoneM, 0, 0.0455, 0.017);

      jizoGroup.add(g);
    }
  }

  // ============================================================
  // 动画
  // ============================================================
  const w = { flowers: 0, folk: 0, dogsA: 0, dogsW: 0, play: 0, sitters: 0, jizo: 0 };
  const wShown = { flowers: -1, folk: -1, dogsA: -1, dogsW: -1, play: -1, sitters: -1, jizo: -1 };

  function dogRun(d, t, groundFn) {
    const a = d.ph + t * d.speed;
    const x = d.cx + Math.cos(a) * d.rad;
    const z = d.cz + Math.sin(a) * d.rad * 0.85;
    const g = d.rig.g;
    g.position.set(x, groundFn(x, z) + Math.abs(Math.sin(t * 9 + d.ph * 3)) * 0.005, z);
    const tx = -Math.sin(a), tz = Math.cos(a) * 0.85;
    // 狗朝 +X：绕 Y 转 θ 后 +X → (cosθ, -sinθ)
    g.rotation.y = Math.atan2(-tz, tx) + Math.sin(t * 4.5 + d.ph) * 0.14;
    for (let i = 0; i < 4; i++) {
      d.rig.legs[i].rotation.z = Math.sin(t * 13.5 + d.ph * 5 + (i & 1 ? Math.PI : 0) + (i >> 1 ? 0.6 : 0)) * 0.85;
    }
    d.rig.tail.rotation.y = Math.sin(t * 12 + d.ph) * 0.75;
    d.rig.head.rotation.x = Math.sin(t * 6 + d.ph) * 0.08;
  }

  function update(t, p, dt) {
    shrine.setSnow(p.snow ?? 0);
    const k = Math.min(1, dt * 2.6);
    w.flowers += ((p.flowers ?? 0) - w.flowers) * k;
    w.folk += ((p.folk ?? 0) - w.folk) * k;
    w.dogsA += ((p.dogsA ?? 0) - w.dogsA) * k;
    w.dogsW += ((p.dogsW ?? 0) - w.dogsW) * k;
    w.play += ((p.play ?? 0) - w.play) * k;
    w.sitters += ((p.sitters ?? 0) - w.sitters) * k;
    w.jizo += ((p.jizo ?? 0) - w.jizo) * k;

    // 权重稳定后别再每帧遍历材质
    for (const [key, grp] of [['flowers', flowerGroup], ['folk', folkGroup], ['dogsA', dogAGroup], ['dogsW', dogWGroup], ['play', playGroup], ['sitters', sitterGroup], ['jizo', jizoGroup]]) {
      if (Math.abs(w[key] - wShown[key]) > 0.003) {
        fade(grp, w[key]);
        wShown[key] = w[key];
      }
    }
    if (iceMesh) {
      iceMesh.visible = w.play > 0.02;
      iceMesh.material.opacity = w.play * 0.88;
    }

    // 涟漪
    for (const rp of ripples) {
      const u2 = ((t * 0.55 + rp.phase) % 1);
      rp.m.scale.setScalar(0.6 + u2 * 2.4);
      rp.m.material.opacity = w.folk * (1 - u2) * 0.42;
    }

    for (const f of fishers) {
      if (f.picnic) {
        const kid = f.kid;
        kid.head.rotation.y = Math.sin(t * 0.62 + f.phase) * 0.22;
        kid.head.rotation.x = 0.20 + Math.sin(t * 0.9 + f.phase) * 0.04;
        const cyc = (t * 0.14 + f.phase) % 1;
        const flipOpen = cyc < 0.1 ? Math.sin((cyc / 0.1) * Math.PI) : 0;
        f.flip.rotation.z = -flipOpen * 1.5;
        continue;
      }
      const bite = Math.max(0, Math.sin(t * 0.42 + f.phase * 2.1) - 0.88) / 0.12;
      f.rod.rotation.x = 1.02 + Math.sin(t * 0.8 + f.phase) * 0.03 - bite * 0.10;
      f.rod.rotation.z = 0.20 + Math.sin(t * 0.55 + f.phase) * 0.02;
      f.kid.head.rotation.x = 0.14 + Math.sin(t * 0.7 + f.phase) * 0.05 - bite * 0.08;
      f.fl.position.y = f.baseY - f.len + Math.sin(t * 1.6 + f.phase) * 0.0025 - bite * 0.004;
    }

    for (const d of dogsA) dogRun(d, t, terrain);

    if (skater) {
      skater.u += skater.dir * skater.speed * dt;
      if (skater.u > 0.82) { skater.u = 0.82; skater.dir = -1; }
      if (skater.u < 0.40) { skater.u = 0.40; skater.dir = 1; }
      const p1 = streamPoint(skater.u, 0, 0);
      const p2 = streamPoint(clamp01(skater.u + 0.012 * skater.dir), 0, 0);
      skater.holder.position.set(p1.x, p1.y + 0.008, p1.z);
      skater.holder.rotation.y = Math.atan2(p2.x - p1.x, p2.z - p1.z);
      skater.kid.g.rotation.z = -skater.dir * 0.12;
      skater.kid.g.rotation.x = 0.10;
      const s3 = Math.sin(t * 2.4);
      skater.kid.legs[0].rotation.x = -0.26 + s3 * 0.32;
      skater.kid.legs[1].rotation.x = 0.20 - s3 * 0.32;
      skater.kid.arms[0].rotation.z = 1.15 - s3 * 0.12;
      skater.kid.arms[1].rotation.z = -1.15 - s3 * 0.12;
    }

    if (skier) {
      skier.u += skier.dir * skier.speed * dt;
      if (skier.u > 0.90) { skier.u = 0.90; skier.dir = -1; }
      if (skier.u < 0.50) { skier.u = 0.50; skier.dir = 1; }
      const p1 = streamPoint(skier.u, 0.40, 0);
      const p2 = streamPoint(clamp01(skier.u + 0.012 * skier.dir), 0.40, 0);
      skier.holder.position.set(p1.x, p1.y + 0.012, p1.z);
      skier.holder.rotation.y = Math.atan2(p2.x - p1.x, p2.z - p1.z);
      skier.kid.g.rotation.z = skier.dir * 0.10;
      skier.kid.g.rotation.x = 0.12;
      const a1 = Math.max(0, Math.sin(t * 1.9 + skier.phase));
      const a2 = Math.max(0, Math.sin(t * 1.9 + skier.phase + Math.PI));
      skier.kid.arms[0].rotation.x = -0.35 - a1 * 0.5;
      skier.kid.arms[1].rotation.x = -0.35 - a2 * 0.5;
      if (skier.kid.poleL) skier.kid.poleL.rotation.x = 0.4 + a1 * 0.4;
      if (skier.kid.poleR) skier.kid.poleR.rotation.x = 0.4 + a2 * 0.4;
    }

    for (const d of dogsW) dogRun(d, t, terrain);

    if (sitters && w.sitters > 0.02) {
      const s = sitters, ph = s.ph;
      // 呼吸感：上身一起一伏，肩膀轻微左右晃
      s.a.g.rotation.x = 0.020 + Math.sin(t * 0.62 + ph) * 0.028;
      s.a.g.rotation.z = Math.sin(t * 0.40 + ph) * 0.020;
      s.b.g.rotation.x = 0.018 + Math.sin(t * 0.55 + ph + 0.9) * 0.025;
      s.b.g.rotation.z = Math.sin(t * 0.46 + ph + 1.7) * 0.017;
      // 抬头看枫叶，慢慢左顾右盼
      s.a.head.rotation.y = 0.20 + Math.sin(t * 0.33 + ph) * 0.20;
      s.a.head.rotation.x = -0.22 + Math.sin(t * 0.47 + ph) * 0.055;
      s.a.head.rotation.z = Math.sin(t * 0.31 + ph) * 0.045;
      s.b.head.rotation.y = 0.14 + Math.sin(t * 0.29 + ph + 2.1) * 0.18;
      s.b.head.rotation.x = -0.15 + Math.sin(t * 0.52 + ph + 1.1) * 0.050;
      s.b.head.rotation.z = Math.sin(t * 0.36 + ph + 0.7) * 0.035;
      // 甲：约每 6 秒抬右手去指一片飘下来的叶子，指完收回到膝上
      const cyc = (t * 0.155 + ph * 0.16) % 1;
      const raise = cyc < 0.34 ? Math.sin((cyc / 0.34) * Math.PI) : 0;
      const lift = Math.pow(raise, 0.7);
      s.a.arms[1].rotation.x = -0.58 - lift * 1.34;
      s.a.arms[1].rotation.z = 0.16 + lift * 0.34;
      s.a.arms[0].rotation.x = -1.00;
      s.a.arms[0].rotation.z = -0.24;
      s.a.head.rotation.y += lift * 0.30;
      s.a.head.rotation.x -= lift * 0.10;
      // 乙：端起杯子小口喝（约 8 秒一轮），喝完放回膝上
      const cyc2 = (t * 0.115 + ph * 0.29) % 1;
      const sip = cyc2 < 0.27 ? Math.sin((cyc2 / 0.27) * Math.PI) : 0;
      const sipE = Math.pow(sip, 0.65);
      s.b.arms[0].rotation.x = -0.36 - sipE * 0.92;
      s.b.arms[0].rotation.z = 0.10 - sipE * 0.06;
      s.b.arms[1].rotation.x = -1.00;
      s.b.arms[1].rotation.z = 0.24;
      s.b.head.rotation.x += sipE * 0.14;
    }
  }

  return {
    group, update,
    groups: { flowerGroup, folkGroup, dogAGroup, dogWGroup, playGroup, sitterGroup, jizoGroup },
    info: {
      picnic: fishers.find((f) => f.picnic)?.spot,
      fishers: fishers.filter((f) => !f.picnic).map((f) => ({ x: f.g.position.x, z: f.g.position.z })),
      dogsA: dogsA.map((d) => ({ x: d.cx, z: d.cz })),
      dogsW: dogsW.map((d) => ({ x: d.cx, z: d.cz })),
    },
  };
}
