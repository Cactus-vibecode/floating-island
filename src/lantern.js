import * as THREE from 'three';
import { terrain, SHRINE_SITE } from './island.js';

// ============================================================
// 夜间灯火（对齐参考图）
//  - 树间拉起的灯串：绳上串小灯泡，按参考图的高度与垂度
//  - 灯串上挂「纸质灯笼」（提灯）：暖橙红、有肋骨、带光晕
//  - 灯笼在地面投一圈暖光池（加色贴片，不额外吃光源）
//  - 神社石灯笼的火袋 + 一盏暖色点光
// 白天完全隐藏，夜里按 lamp 0→1 淡入
// ============================================================

function radialTex(size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,252,240,1)');
  grd.addColorStop(0.28, 'rgba(255,224,170,0.78)');
  grd.addColorStop(0.62, 'rgba(255,180,110,0.28)');
  grd.addColorStop(1, 'rgba(255,160,90,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 提灯贴图：中心因烛火发亮、上下收口偏深、横向肋骨
function chochinTex(w = 96, h = 128) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#C8401F');
  grd.addColorStop(0.18, '#F0673A');
  grd.addColorStop(0.46, '#FFD79A');
  grd.addColorStop(0.62, '#FFC078');
  grd.addColorStop(0.86, '#E4572F');
  grd.addColorStop(1, '#B93A1C');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);

  // 横向肋骨
  g.strokeStyle = 'rgba(120,32,14,0.34)';
  g.lineWidth = 1;
  for (let y = 6; y < h - 4; y += 6) {
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke();
  }
  // 竖向竹骨
  g.strokeStyle = 'rgba(140,45,20,0.22)';
  for (let i = 0; i <= 6; i++) {
    const x = (i / 6) * w;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  }
  // 上下收口
  g.fillStyle = '#3A2118';
  g.fillRect(0, 0, w, 5);
  g.fillRect(0, h - 5, w, 5);
  g.fillStyle = 'rgba(255,246,224,0.85)';
  g.fillRect(w / 2 - 5, h * 0.42, 10, 12);
  g.fillStyle = 'rgba(150,40,18,0.55)';
  g.fillRect(w / 2 - 3, h * 0.46, 6, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildLanterns(island) {
  const group = new THREE.Group();
  const trees = (island.trees || []).filter((t) => t.sp !== 'conifer');

  const nearestTree = (x, z, maxD) => {
    let best = null, bd = maxD;
    for (const t of trees) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  };

  // 挂点：优先挂到附近的树冠下沿，挂不上就立一根木杆（参考图里也有杆）
  const posts = [];
  const anchor = (x, z, h) => {
    const t = nearestTree(x, z, 0.50);
    if (t) return new THREE.Vector3(t.x, t.y + h * t.s, t.z);
    posts.push({ x, z, y: terrain(x, z) + h });
    return new THREE.Vector3(x, terrain(x, z) + h, z);
  };

  // ---- 灯串骨架：绕草地一圈 + 两条横跨的深串 ----
  const STRANDS = [];
  {
    const CX = 0.18, CZ = 0.92, RX = 1.62, RZ = 1.02, N = 9;
    const ring = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.35;
      ring.push([CX + Math.cos(a) * RX, CZ + Math.sin(a) * RZ]);
    }
    for (let i = 0; i < N; i++) {
      const a = ring[i], b = ring[(i + 1) % N];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 2.04) continue;
      STRANDS.push({ a, b, h: 0.66, sag: 0.19, big: (i % 2 === 0) ? [0.5] : [] });
    }
    STRANDS.push({ a: [-1.86, 0.34], b: [1.52, 0.30], h: 0.74, sag: 0.26, big: [0.24, 0.62] });
    STRANDS.push({ a: [-1.30, 1.86], b: [1.30, 1.58], h: 0.70, sag: 0.24, big: [0.18, 0.52, 0.84] });
  }

  const strandCurves = [];
  const bulbPos = [];
  const bigSpots = []; // {pos, hang}

  for (const st of STRANDS) {
    const A = anchor(st.a[0], st.a[1], st.h);
    const B = anchor(st.b[0], st.b[1], st.h);
    const dist = Math.hypot(A.x - B.x, A.z - B.z);
    if (dist < 0.42) continue;
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const gy = terrain(mid.x, mid.z);
    mid.y = Math.max(gy + 0.44, Math.min(mid.y, (A.y + B.y) * 0.5) - st.sag);
    const curve = new THREE.QuadraticBezierCurve3(A, mid, B);

    strandCurves.push(curve);
    const n = Math.max(4, Math.round(dist / 0.115));
    for (let i = 0; i < n; i++) {
      const p = curve.getPoint((i + 0.5) / n);
      p.y -= 0.022;
      bulbPos.push(p);
    }
    for (const t of st.big) {
      const p = curve.getPoint(t);
      bigSpots.push(p);
    }
  }

  // 神社前两只石灯笼之间再挂一盏，强化参考图里"神社被暖光包住"的感觉
  bigSpots.push(new THREE.Vector3(SHRINE_SITE.x + 0.02, terrain(SHRINE_SITE.x, SHRINE_SITE.z + 0.30) + 0.40, SHRINE_SITE.z + 0.30));

  // ---- 木杆（挂不上树的地方）----
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4A3527, roughness: 0.95, metalness: 0 });
  let postMesh = null;
  if (posts.length) {
    const g = new THREE.CylinderGeometry(0.0065, 0.0085, 1, 5);
    g.translate(0, 0.5, 0);
    postMesh = new THREE.InstancedMesh(g, woodMat, posts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    posts.forEach((p, i) => {
      e.set(0, Math.atan2(p.x, p.z), 0); q.setFromEuler(e);
      sv.set(1, p.y - terrain(p.x, p.z), 1);
      pv.set(p.x, terrain(p.x, p.z), p.z);
      m.compose(pv, q, sv);
      postMesh.setMatrixAt(i, m);
    });
    postMesh.instanceMatrix.needsUpdate = true;
    postMesh.castShadow = true;
    group.add(postMesh);
  }

  // ---- 绳索：所有灯串合成一次线段绘制 ----
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x7A5636, transparent: true, opacity: 0, depthWrite: false,
  });
  {
    const seg = [];
    for (const c of strandCurves) {
      const pts = c.getPoints(30);
      for (let i = 0; i < pts.length - 1; i++) {
        seg.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    const ls = new THREE.LineSegments(g, lineMat);
    ls.frustumCulled = false;
    group.add(ls);
  }

  // ---- 小灯泡 ----
  const bulbGeo = new THREE.SphereGeometry(0.0104, 7, 5);
  bulbGeo.scale(1, 1.22, 1);
  const bulbMat = new THREE.MeshBasicMaterial({
    color: 0xFFE1AC, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbPos.length);
  {
    const m = new THREE.Matrix4();
    bulbPos.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m); });
    bulbs.instanceMatrix.needsUpdate = true;
    bulbs.frustumCulled = false;
  }
  group.add(bulbs);

  // ---- 灯泡的光点（加色小球，避免灯笼变成一排大白球）----
  const dotGeo = new THREE.SphereGeometry(0.030, 6, 5);
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0xFFC98A, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, bulbPos.length);
  {
    const m = new THREE.Matrix4();
    bulbPos.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); dots.setMatrixAt(i, m); });
    dots.instanceMatrix.needsUpdate = true;
    dots.frustumCulled = false;
  }
  group.add(dots);

  // ---- 提灯（纸质灯笼）----
  const chalkMat = new THREE.MeshStandardMaterial({ color: 0x2C1C14, roughness: 0.9, metalness: 0 });
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x2A1E16, transparent: true, opacity: 0 });
  const chochinMat = new THREE.MeshBasicMaterial({
    map: chochinTex(), color: 0xffffff, transparent: true, opacity: 0, toneMapped: false,
    side: THREE.DoubleSide,
  });
  const glowTex = radialTex(128);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, color: 0xFFB066, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });

  // 灯笼外形（旋转体：上下收口、中间鼓）
  const prof = [];
  const P = [
    [0.008, -0.070], [0.026, -0.062], [0.040, -0.044], [0.048, -0.018],
    [0.050, 0.000], [0.048, 0.018], [0.040, 0.044], [0.026, 0.062], [0.008, 0.070],
  ];
  for (const [r, y] of P) prof.push(new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(prof, 14);
  bodyGeo.scale(1.22, 1.18, 1.22);
  const capGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.008, 8);

  const lanternAt = [];
  for (const p of bigSpots) {
    lanternAt.push({ x: p.x, y: p.y - 0.132, z: p.z, ph: Math.random() * 6.28 });
  }
  const bodies = new THREE.InstancedMesh(bodyGeo, chochinMat, lanternAt.length);
  bodies.frustumCulled = false;
  {
    const m = new THREE.Matrix4();
    lanternAt.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      bodies.setMatrixAt(i, m);
    });
    bodies.instanceMatrix.needsUpdate = true;
  }
  group.add(bodies);

  // 吊绳：从灯绳垂到灯笼顶（一次绘制）
  {
    const seg = [];
    for (const p of bigSpots) {
      seg.push(p.x, p.y, p.z, p.x, p.y - 0.062, p.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    const cl = new THREE.LineSegments(g, cordMat);
    cl.frustumCulled = false;
    group.add(cl);
  }

  // 灯笼光晕：用 Points 画一圈柔光，一次绘制
  const haloMat = new THREE.PointsMaterial({
    map: glowTex, color: 0xFFB066, size: 0.92, sizeAttenuation: true,
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false,
  });
  {
    const arr = new Float32Array(lanternAt.length * 3);
    lanternAt.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const halo = new THREE.Points(g, haloMat);
    halo.frustumCulled = false;
    group.add(halo);
  }

  // ---- 地面暖光池 ----
  const poolTex = radialTex(128);
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, color: 0xFFB774, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const poolGeo = new THREE.PlaneGeometry(1, 1);
  const poolSpots = [];
  for (const p of lanternAt) poolSpots.push({ x: p.x, z: p.z, r: 0.64 });
  // 神社前再铺一圈更大的
  poolSpots.push({ x: SHRINE_SITE.x, z: SHRINE_SITE.z + 0.34, r: 0.78 });
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, poolSpots.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    e.set(-Math.PI / 2, 0, 0); q.setFromEuler(e);
    poolSpots.forEach((p, i) => {
      sv.set(p.r, p.r, p.r);
      pv.set(p.x, terrain(p.x, p.z) + 0.022, p.z);
      m.compose(pv, q, sv);
      pools.setMatrixAt(i, m);
    });
    pools.instanceMatrix.needsUpdate = true;
    pools.frustumCulled = false;
  }
  pools.renderOrder = 4;
  group.add(pools);

  // ---- 神社石灯笼的火袋 ----
  const fireMat = new THREE.MeshBasicMaterial({
    color: 0xFFC070, transparent: true, opacity: 0, toneMapped: false,
  });
  const fireGeo = new THREE.SphereGeometry(0.017, 6, 5);
  const stone = new THREE.Group();
  for (const dx of [-0.20, 0.19]) {
    const f = new THREE.Mesh(fireGeo, fireMat);
    f.position.set(
      SHRINE_SITE.x + dx,
      terrain(SHRINE_SITE.x + dx, SHRINE_SITE.z + 0.20) + 0.30,
      SHRINE_SITE.z + 0.20
    );
    stone.add(f);
  }
  stone.visible = false;
  group.add(stone);

  // ---- 几盏暖光：让灯笼真的照亮周围草木（参考图里树冠下部是被灯光烤暖的）----
  const lampLights = [];
  {
    for (let i = 1; i < lanternAt.length; i += 4) {
      if (lampLights.length >= 4) break;
      const p = lanternAt[i];
      const pl = new THREE.PointLight(0xffb070, 0, 2.05, 2);
      pl.position.set(p.x, p.y + 0.02, p.z);
      group.add(pl);
      lampLights.push(pl);
    }
  }

  // ---- 神社前的暖色点光 ----
  const point = new THREE.PointLight(0xffb070, 0, 3.2, 2);
  point.position.set(SHRINE_SITE.x, terrain(SHRINE_SITE.x, SHRINE_SITE.z) + 0.62, SHRINE_SITE.z + 0.26);
  group.add(point);

  // ---- 萤火（很淡，只做空气感）----
  const FF = 26;
  const ffPos = new Float32Array(FF * 3);
  const ffPhase = new Float32Array(FF);
  for (let i = 0; i < FF; i++) {
    let x = 0, z = 0;
    for (let k = 0; k < 12; k++) {
      x = (Math.random() - 0.5) * 2.5;
      z = (Math.random() - 0.5) * 2.3 + 0.7;
      if (Math.hypot(x, z) < 2.3) break;
    }
    ffPos[i * 3] = x;
    ffPos[i * 3 + 1] = terrain(x, z) + 0.16 + Math.random() * 0.34;
    ffPos[i * 3 + 2] = z;
    ffPhase[i] = Math.random() * 6.28;
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffMat = new THREE.PointsMaterial({
    color: 0xFFE4B0, size: 0.02, sizeAttenuation: true,
    transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  fireflies.frustumCulled = false;
  group.add(fireflies);

  const _c = new THREE.Color();
  const _warm = new THREE.Color(0xFFB877);

  function setLamp(amount, tint) {
    const a = Math.max(0, Math.min(1, amount));
    group.visible = a > 0.012;
    if (!group.visible) return;
    _c.copy(tint || _warm).lerp(_warm, 0.55);
    bulbMat.color.copy(_c).lerp(new THREE.Color(0xFFF2D6), 0.55);
    bulbMat.opacity = Math.min(1, a * 1.15);
    dotMat.color.copy(_c);
    dotMat.opacity = a * 0.16;
    chochinMat.opacity = Math.min(1, a * 1.05);
    chochinMat.color.copy(_c).lerp(new THREE.Color(0xFFE7C8), 0.45);
    haloMat.color.copy(_c).lerp(_warm, 0.5);
    haloMat.opacity = a * 0.52;
    poolMat.color.copy(_c).lerp(_warm, 0.35);
    poolMat.opacity = a * 0.21;
    fireMat.color.copy(_c);
    fireMat.opacity = Math.min(1, a * 1.1);
    lineMat.opacity = a * 0.62;
    cordMat.opacity = a * 0.75;
    point.color.copy(_c);
    point.intensity = a * 3.1;
    for (const pl of lampLights) {
      pl.color.copy(_c);
      pl.intensity = a * 1.9;
    }
    for (const pl of lampLights) {
      pl.color.copy(_c);
      pl.intensity = a * 1.9;
    }
    ffMat.opacity = a * 0.5;
    bodies.visible = true;
    stone.visible = true;
  }

  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const _sv = new THREE.Vector3(1, 1, 1), _pv = new THREE.Vector3();
  let t = 0;
  function update(dt) {
    if (!group.visible) return;
    t += dt;
    const arr = ffGeo.attributes.position.array;
    for (let i = 0; i < FF; i++) {
      arr[i * 3 + 1] += Math.sin(t * 1.1 + ffPhase[i]) * 0.0014;
      arr[i * 3] += Math.cos(t * 0.7 + ffPhase[i] * 1.3) * 0.0007;
    }
    ffGeo.attributes.position.needsUpdate = true;
    // 灯笼轻微晃动（像挂在绳上）
    const m = _m4, q = _q, e = _e, sv = _sv, pv = _pv;
    for (let i = 0; i < lanternAt.length; i++) {
      const p = lanternAt[i];
      e.set(0, 0, Math.sin(t * 0.9 + p.ph) * 0.05);
      q.setFromEuler(e);
      sv.set(1, 1, 1);
      pv.set(p.x, p.y, p.z);
      m.compose(pv, q, sv);
      bodies.setMatrixAt(i, m);
    }
    bodies.instanceMatrix.needsUpdate = true;
  }

  return {
    group, setLamp, update,
    count: bulbPos.length,
    info: { bulbs: bulbPos.length, lanterns: lanternAt.length, strands: STRANDS.length, posts: posts.length },
  };
}
