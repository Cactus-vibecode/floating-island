import * as THREE from 'three';

// ============================================================
// 山脚神社：石台 + 鸟居 + 本殿
// 沙盘尺度：台面到屋脊约 0.30，鸟居约 0.30（约为人物身高的 1.6 倍）
// 局部坐标：+Z 为正面（朝镜头），y=0 为石台台面
// ============================================================

// ---------- 贴图 ----------
function tileTex() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#59626B';
  g.fillRect(0, 0, 64, 64);
  // 筒瓦：横向一条条亮脊 + 细竖向接缝
  for (let y = 0; y < 64; y += 8) {
    g.fillStyle = '#727D87';
    g.fillRect(0, y, 64, 3);
    g.fillStyle = '#3A424A';
    g.fillRect(0, y + 3, 64, 2);
    for (let x = 0; x < 64; x += 16) {
      g.fillStyle = '#343B42';
      g.fillRect(x + ((y / 8) % 2 ? 8 : 0), y, 1.5, 8);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.4, 1.6);
  return t;
}

function stoneTex() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#6B675E';
  g.fillRect(0, 0, 128, 128);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // 错缝砌块
  const rows = 6;
  const rh = 128 / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 16;
    for (let c = -1; c < 4; c++) {
      const bx = c * 40 + off + rnd() * 3;
      const by = r * rh + 1.5;
      const bw = 38 + rnd() * 3;
      const bh = rh - 3;
      const v = 0.84 + rnd() * 0.34;
      g.fillStyle = `rgb(${Math.round(163 * v)},${Math.round(158 * v)},${Math.round(146 * v)})`;
      g.fillRect(bx, by, bw, bh);
      g.fillStyle = 'rgba(255,255,255,.10)';
      g.fillRect(bx, by, bw, 1);
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.fillRect(bx, by + bh - 1, bw, 1);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function woodTex() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#BE432B';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * 64;
    g.fillStyle = i % 2 ? 'rgba(255,255,255,.055)' : 'rgba(90,26,14,.10)';
    g.fillRect(0, y, 64, 1.4);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildShrine(terrain, site) {
  const { x, z, yaw } = site;
  const g = new THREE.Group();
  const group = g;

  const TERRACE = 0.27;                       // 台面高出神前地面
  const baseY = terrain(x, z) + TERRACE;
  g.position.set(x, baseY, z);
  g.rotation.y = yaw;

  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const toWorld = (lx, lz) => [x + lx * cosY + lz * sinY, z - lx * sinY + lz * cosY];

  // ---------- 材质 ----------
  const tileMap = tileTex();
  const stoneMap = stoneTex();
  const woodMap = woodTex();

  const mat = {
    red: new THREE.MeshStandardMaterial({ color: 0xD2523A, map: woodMap, roughness: 0.68, metalness: 0 }),
    redDark: new THREE.MeshStandardMaterial({ color: 0x9C3A26, roughness: 0.72, metalness: 0 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xEFE6D2, roughness: 0.85, metalness: 0 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xC2CAD2, map: tileMap, roughness: 0.60, metalness: 0.05, side: THREE.DoubleSide }),
    roofEdge: new THREE.MeshStandardMaterial({ color: 0x2B3038, roughness: 0.6, metalness: 0.1 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xB6B1A6, map: stoneMap, roughness: 0.94, metalness: 0 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x8A8478, roughness: 0.96, metalness: 0 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xC8A23A, roughness: 0.32, metalness: 0.62 }),
    door: new THREE.MeshStandardMaterial({ color: 0x5B3A26, roughness: 0.8, metalness: 0 }),
    snow: new THREE.MeshStandardMaterial({
      color: 0xF7FAFF, roughness: 0.7, metalness: 0, transparent: true, opacity: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false,
    }),
  };
  stoneMap.repeat.set(3.2, 2.6);

  const box = (w, h, d, m, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  // ---------- 石台（切进山坡，前脸是挡土墙）----------
  const TW = 0.66, TD = 0.56;
  box(TW, 0.46, TD, mat.stone, 0, -0.23, -0.01);
  // 台面压边石
  box(TW + 0.035, 0.030, TD + 0.035, mat.stoneDark, 0, 0.002, -0.01);
  // 前脸分层的砌石束腰
  box(TW + 0.020, 0.055, TD + 0.020, mat.stoneDark, 0, -0.20, -0.01);
  box(TW + 0.010, 0.045, TD + 0.010, mat.stone, 0, -0.31, -0.01);

  // ---------- 石阶 ----------
  const stairRise = 0.045, stairRun = 0.048, stairW = 0.165;
  const stairZ0 = 0.28;
  let steps = 0;
  for (let i = 0; i < 9; i++) {
    const lz = stairZ0 + i * stairRun + stairRun / 2;
    const [wx, wz] = toWorld(0, lz);
    const ground = terrain(wx, wz) - baseY;   // 相对台面
    const top = -i * stairRise;
    if (top < ground - 0.012) break;
    const bottom = Math.min(ground, top - 0.05) - 0.09;
    box(stairW, top - bottom, stairRun * 1.06, mat.stone, 0, (top + bottom) / 2, lz);
    steps++;
  }
  // 阶旁矮墙（跟着台阶一起往下走）
  for (let i = 0; i < Math.max(2, steps); i++) {
    const lz = stairZ0 + i * stairRun + stairRun / 2;
    const top = -i * stairRise;
    for (const s of [-1, 1]) {
      box(0.020, 0.070, stairRun * 1.06, mat.stoneDark, s * (stairW / 2 + 0.011), top + 0.008, lz);
    }
  }

  // ---------- 参道踏石 ----------
  const [sx0, sz0] = toWorld(0, stairZ0 + steps * stairRun + 0.05);
  for (let i = 0; i < 5; i++) {
    const lz = stairZ0 + steps * stairRun + 0.07 + i * 0.085;
    const [wx, wz] = toWorld(0, lz);
    const gy = terrain(wx, wz);
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.014, 0.065), i % 2 ? mat.stone : mat.stoneDark);
    stone.position.set(0, gy - baseY + 0.004, lz);
    stone.rotation.y = (i % 2 ? 1 : -1) * 0.10;
    stone.receiveShadow = true;
    g.add(stone);
  }

  // ---------- 鸟居 ----------
  const torii = new THREE.Group();
  torii.position.set(0.012, 0, 0.248);
  g.add(torii);
  const tBox = (w, h, d, m, px, py, pz, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(px, py, pz);
    mesh.rotation.z = rz;
    mesh.castShadow = true;
    torii.add(mesh);
    return mesh;
  };
  const PILLAR_H = 0.246, PILLAR_R = 0.0155, SPAN = 0.126;
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(PILLAR_R * 0.86, PILLAR_R, PILLAR_H, 9), mat.red);
    p.position.set(s * SPAN, PILLAR_H / 2, 0);
    p.rotation.z = -s * 0.022;
    p.castShadow = true;
    torii.add(p);
    // 柱脚石
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(PILLAR_R * 1.7, PILLAR_R * 1.85, 0.016, 9), mat.stoneDark);
    bs.position.set(s * SPAN, 0.008, 0);
    torii.add(bs);
  }
  // 贯（下横梁）
  tBox(SPAN * 2 + 0.052, 0.020, 0.015, mat.red, 0, PILLAR_H * 0.72, 0);
  // 岛木（上横梁）
  tBox(SPAN * 2 + 0.078, 0.017, 0.021, mat.red, 0, PILLAR_H * 0.90, 0);
  // 笠木（最上，两端上翘）+ 黑色顶盖
  const KASA_Y = PILLAR_H * 0.972;
  const KASA_HALF = SPAN + 0.020;
  const TIP_L = 0.055, TIP_A = 0.26;
  tBox(KASA_HALF * 2, 0.022, 0.031, mat.red, 0, KASA_Y, 0);
  tBox(KASA_HALF * 2, 0.008, 0.034, mat.roofEdge, 0, KASA_Y + 0.014, 0);
  for (const s of [-1, 1]) {
    const cx = s * (KASA_HALF + Math.cos(TIP_A) * TIP_L / 2);
    const cy = KASA_Y + Math.sin(TIP_A) * TIP_L / 2 - 0.002;
    tBox(TIP_L, 0.021, 0.031, mat.red, cx, cy, 0, s * TIP_A);
    tBox(TIP_L, 0.008, 0.034, mat.roofEdge, cx, cy + 0.013, 0, s * TIP_A);
  }
  // 额束（中间小匾）
  tBox(0.030, 0.050, 0.008, mat.gold, 0, PILLAR_H * 0.815, 0.011);
  tBox(0.023, 0.041, 0.010, mat.cream, 0, PILLAR_H * 0.815, 0.013);

  // ---------- 本殿 ----------
  const bx = 0, bz = -0.135;
  const BW = 0.285, BD = 0.200, PLINTH = 0.050, WALL_H = 0.145;
  // 石基座（高台，前面两级小台阶）
  box(BW + 0.056, PLINTH, BD + 0.056, mat.stone, bx, PLINTH / 2, bz);
  box(BW + 0.070, 0.012, BD + 0.070, mat.stoneDark, bx, 0.006, bz);
  box(0.115, 0.020, 0.034, mat.stone, bx, 0.010, bz + BD / 2 + 0.045);
  box(0.135, 0.014, 0.026, mat.stoneDark, bx, 0.007, bz + BD / 2 + 0.066);
  // 地板
  box(BW + 0.030, 0.014, BD + 0.030, mat.door, bx, PLINTH + 0.007, bz);
  // 墙体
  const wallY0 = PLINTH + 0.012;
  box(BW, WALL_H, BD, mat.red, bx, wallY0 + WALL_H / 2, bz);
  // 角柱
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(0.017, WALL_H + 0.008, 0.017, mat.redDark, bx + sx * (BW / 2 - 0.004), wallY0 + WALL_H / 2, bz + sz * (BD / 2 - 0.004));
    }
  }
  // 正面：白壁 + 门 + 金饰
  const frontZ = bz + BD / 2 + 0.002;
  box(BW * 0.36, WALL_H * 0.66, 0.006, mat.cream, bx - 0.070, wallY0 + WALL_H * 0.46, frontZ);
  box(BW * 0.36, WALL_H * 0.66, 0.006, mat.cream, bx + 0.070, wallY0 + WALL_H * 0.46, frontZ);
  box(0.068, WALL_H * 0.78, 0.009, mat.door, bx, wallY0 + WALL_H * 0.43, frontZ + 0.002);
  box(0.078, 0.009, 0.011, mat.gold, bx, wallY0 + WALL_H * 0.84, frontZ + 0.002);
  // 侧墙格窗
  for (const sx of [-1, 1]) {
    box(0.007, WALL_H * 0.52, BD * 0.46, mat.cream, bx + sx * (BW / 2 + 0.001), wallY0 + WALL_H * 0.5, bz);
  }
  // 檐下枋
  const eaveBeamY = wallY0 + WALL_H + 0.006;
  box(BW + 0.034, 0.014, BD + 0.034, mat.redDark, bx, eaveBeamY, bz);

  // ---------- 腰檐（下段小屋檐，把轮廓做出两层）----------
  {
    const ringW = BW + 0.115, ringD = BD + 0.115;
    const t = 0.030;
    const drop = 0.022;
    const mk = (w, d, px, pz, rx, rz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.011, d), mat.roof);
      m.position.set(bx + px, eaveBeamY + 0.004, bz + pz);
      m.rotation.x = rx;
      m.rotation.z = rz;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    // 前后两面（沿 X 铺开）
    for (const sz of [-1, 1]) {
      mk(ringW, ringD / 2 + 0.01, 0, sz * (ringD / 4 + 0.008), sz * -0.30, 0);
    }
    // 左右两面（沿 Z 铺开）
    for (const sx of [-1, 1]) {
      mk(ringD / 2 + 0.01, ringW * 0.62, sx * (ringW / 4 + 0.006), 0, 0, sx * 0.30);
    }
    // 腰檐下的一圈白壁（把红墙与屋顶隔开）
    box(BW + 0.020, 0.020, BD + 0.020, mat.cream, bx, eaveBeamY - 0.014, bz);
  }

  // ---------- 主屋顶（曲面 + 反宇）----------
  const snowCaps = [];
  const ROOF_W = 0.52, RIDGE_Y = PLINTH + 0.352, EAVE_Y = PLINTH + 0.208;
  const ridgeZ = bz, eaveZ = bz + 0.186;
  function roofSlope(side) {
    const NZ = 5, NX = 3;
    const pos = [], uv = [], idx = [];
    for (let iz = 0; iz <= NZ; iz++) {
      const t = iz / NZ;
      const lz = ridgeZ + side * t * (eaveZ - ridgeZ);
      const y = RIDGE_Y - Math.pow(t, 0.82) * (RIDGE_Y - EAVE_Y) + Math.pow(t, 5) * 0.022;
      const hw = ROOF_W / 2 * (0.72 + 0.28 * t) + Math.pow(t, 3) * 0.014;
      for (let ix = 0; ix <= NX; ix++) {
        const u = ix / NX;
        const px = -hw + u * hw * 2;
        const lift = Math.pow(t, 3) * Math.pow(Math.abs(u - 0.5) * 2, 2.2) * 0.026;
        pos.push(px, y + lift, lz);
        uv.push(u * 2.6, t * 1.8);
      }
    }
    for (let iz = 0; iz < NZ; iz++) {
      for (let ix = 0; ix < NX; ix++) {
        const a = iz * (NX + 1) + ix;
        const b = a + 1, c = a + NX + 1, d = c + 1;
        if (side > 0) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat.roof);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    // 积雪：同一块曲面整体抬一点，天然贴合
    const snow = new THREE.Mesh(geo, mat.snow);
    snow.position.y = 0.009;
    snow.visible = false;
    g.add(snow);
    snowCaps.push(snow);
    return mesh;
  }
  roofSlope(1);
  roofSlope(-1);
  // 檐口封边
  for (const side of [-1, 1]) {
    const eave = new THREE.Mesh(new THREE.BoxGeometry(ROOF_W + 0.030, 0.013, 0.018), mat.roofEdge);
    eave.position.set(0, EAVE_Y + 0.001, ridgeZ + side * (eaveZ - ridgeZ));
    eave.rotation.x = side * 0.10;
    eave.castShadow = true;
    g.add(eave);
  }
  // 大栋（屋脊）+ 鬼瓦
  box(ROOF_W * 0.78, 0.021, 0.030, mat.roofEdge, 0, RIDGE_Y + 0.009, ridgeZ);
  for (const s of [-1, 1]) {
    box(0.028, 0.052, 0.032, mat.roofEdge, s * ROOF_W * 0.39, RIDGE_Y + 0.017, ridgeZ);
    box(0.011, 0.009, 0.034, mat.gold, s * ROOF_W * 0.39, RIDGE_Y + 0.043, ridgeZ);
  }
  // 山墙（妻面）：三角红板 + 金饰
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.082, 0);
    shape.lineTo(0.082, 0);
    shape.lineTo(0, 0.072);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    const wall = new THREE.Mesh(geo, mat.red);
    wall.position.set(sx * (BW / 2 - 0.006), eaveBeamY + 0.006, bz);
    wall.castShadow = true;
    g.add(wall);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.015, 12), mat.gold);
    disc.position.set(sx * (BW / 2 + 0.011), eaveBeamY + 0.044, bz);
    disc.rotation.y = sx * Math.PI / 2;
    g.add(disc);
  }

  // ---------- 石灯笼 ----------
  const lanterns = [];
  for (const s of [-1, 1]) {
    const lx = s * 0.20;
    const lz = stairZ0 + Math.max(1, steps - 1) * stairRun + 0.06;
    const [wx, wz] = toWorld(lx, lz);
    const gy = terrain(wx, wz) - baseY;
    const l = new THREE.Group();
    l.position.set(lx, gy, lz);
    const add = (geo, m, y) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.y = y;
      mesh.castShadow = true;
      l.add(mesh);
      return mesh;
    };
    add(new THREE.CylinderGeometry(0.020, 0.026, 0.014, 8), mat.stoneDark, 0.007);
    add(new THREE.CylinderGeometry(0.008, 0.010, 0.045, 7), mat.stone, 0.036);
    add(new THREE.CylinderGeometry(0.019, 0.014, 0.010, 8), mat.stone, 0.062);
    add(new THREE.BoxGeometry(0.030, 0.024, 0.030), mat.stone, 0.079);
    add(new THREE.ConeGeometry(0.026, 0.020, 4), mat.stoneDark, 0.101);
    g.add(l);
    lanterns.push(l);
  }

  const snowRidge = new THREE.Mesh(new THREE.BoxGeometry(ROOF_W * 0.82, 0.014, 0.034), mat.snow);
  snowRidge.position.set(0, RIDGE_Y + 0.022, ridgeZ);
  snowRidge.visible = false;
  g.add(snowRidge);
  snowCaps.push(snowRidge);

  const snowKasagi = new THREE.Mesh(new THREE.BoxGeometry(SPAN * 2 + 0.045, 0.010, 0.036), mat.snow);
  snowKasagi.position.set(0.012, PILLAR_H * 0.972 + 0.022, 0.248);
  snowKasagi.visible = false;
  g.add(snowKasagi);
  snowCaps.push(snowKasagi);

  const snowTopper = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.030, 0.010, TD + 0.030), mat.snow);
  snowTopper.position.set(0, 0.012, -0.01);
  snowTopper.visible = false;
  // 台面上不该全白，只留前沿一条
  snowTopper.scale.set(1, 1, 0.10);
  snowTopper.position.z = -TD / 2 + 0.01;
  g.add(snowTopper);
  snowCaps.push(snowTopper);

  let snowShown = -1;
  function setSnow(w) {
    if (Math.abs(w - snowShown) < 0.004) return;
    snowShown = w;
    const vis = w > 0.03;
    for (const c of snowCaps) c.visible = vis;
    mat.snow.opacity = Math.min(1, w * 0.94);
    mat.snow.transparent = w < 0.985;
  }

  return {
    group,
    setSnow,
    site: { x, z, yaw, baseY, TW, TD, steps, stairZ0, stairRise, stairRun },
    baseY,
  };
}
