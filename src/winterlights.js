import * as THREE from 'three';
import { terrain, SHRINE_SITE } from './island.js';

// ============================================================
// 冬季限定灯火（按参考图：树上斜挑竹竿挂纸灯，沿树群连成光带）
//  - 挑杆灯：竹竿从树干斜挑出去，杆头垂一盏纸灯，顶上一撮薄雪
//  - 鸟居提灯：挂在笠木下沿，与树灯同高呼应
//  - 雪洞：岛前沿草地两侧的雪堆灯，洞口透出暖光
// 白天：实色纸灯（不发光、不投影光池）；入夜按 lamp 曲线点亮
// ============================================================

const RED = '#D0321D';    // 朱红
const ORANGE = '#E2691F'; // 暖橙
const AMBER = '#F2A32A';  // 明黄

// 中性暖白纸面（靠 instance/材质 color 染成红或黄）
function paperTex(w = 64, h = 96) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#FFFFFF');
  grd.addColorStop(0.40, '#FFFDF5');
  grd.addColorStop(0.76, '#FFF6E4');
  grd.addColorStop(1, '#F7E4C6');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // 横肋骨
  g.strokeStyle = 'rgba(120,86,52,0.16)';
  g.lineWidth = 1;
  for (let y = 5; y < h - 3; y += 6) {
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke();
  }
  // 竖竹骨
  g.strokeStyle = 'rgba(120,86,52,0.10)';
  for (let i = 1; i < 6; i++) {
    g.beginPath(); g.moveTo((i / 6) * w, 0); g.lineTo((i / 6) * w, h); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radialTex(size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,252,240,1)');
  grd.addColorStop(0.26, 'rgba(255,222,168,0.74)');
  grd.addColorStop(0.62, 'rgba(255,176,104,0.24)');
  grd.addColorStop(1, 'rgba(255,160,90,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWinterLights(island) {
  const group = new THREE.Group();
  group.visible = false;
  const trees = (island.trees || []).filter((t) => t.sp !== 'conifer' && !t.dead);

  const pick = (x, z, max = 0.46) => {
    let best = null, bd = max;
    for (const t of trees) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  };

  // ---------- 共享资源 ----------
  const map = paperTex();
  const glowTex = radialTex(128);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x3A2A20, roughness: 0.92, metalness: 0 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xFAFDFF, roughness: 0.72, metalness: 0 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x6E4F35, roughness: 0.88, metalness: 0, emissive: 0x140D08, emissiveIntensity: 1 });

  // 正圆纸灯（参考图：干净的球体，上下各一个小深色盖）
  const bodyGeo = new THREE.SphereGeometry(1, 20, 14);
  const capGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
  const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4);
  const rodGeo = new THREE.CylinderGeometry(0.016, 0.023, 1, 5);

  const lights = []; // {root, phase, dir}
  const glowSprites = [];
  const poolSpots = [];

  // ---------- 单盏挑杆灯 ----------
  const makeLamp = (x, y, z, s, color, dir) => {
    const root = new THREE.Group();
    root.position.set(x, y, z);

    const rodLen = 0.62 * s;
    const rod = new THREE.Mesh(rodGeo, bambooMat);
    rod.scale.set(s, rodLen, s);
    rod.position.set(0, 0, 0);
    // 杆从树干向外上方斜伸
    const tip = new THREE.Vector3(dir.x * 0.60 * s, 0.26 * s, dir.z * 0.60 * s);
    rod.position.copy(tip).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().normalize());
    rod.castShadow = true;
    root.add(rod);

    // 杆头垂绳
    const drop = 0.090 * s;
    const cord = new THREE.Mesh(cordGeo, capMat);
    cord.scale.set(s * 0.8, drop, s * 0.8);
    cord.position.set(tip.x, tip.y - drop / 2, tip.z);
    root.add(cord);

    // 灯体（可摆动）
    const swing = new THREE.Group();
    swing.position.set(tip.x, tip.y - drop, tip.z);
    root.add(swing);

    const R = 0.074 * s;      // 灯半径（正圆）
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.58, metalness: 0,
      emissive: color, emissiveIntensity: 0.18,
    });
    const body = new THREE.Mesh(bodyGeo, mat);
    body.scale.setScalar(R);
    body.position.y = -R * 1.02;
    body.castShadow = true;
    swing.add(body);

    // 上下小盖（深色豆粒）
    const capTop = new THREE.Mesh(capGeo, capMat);
    capTop.scale.set(R * 0.30, R * 0.20, R * 0.30);
    capTop.position.y = -R * 0.10;
    swing.add(capTop);

    const capBot = new THREE.Mesh(capGeo, capMat);
    capBot.scale.set(R * 0.26, R * 0.16, R * 0.26);
    capBot.position.y = -R * 1.96;
    swing.add(capBot);

    // 夜里光晕
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xFFB877, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    sp.scale.setScalar(0.34 * s);
    sp.position.set(0, -R * 1.02, 0);
    swing.add(sp);
    glowSprites.push(sp);

    group.add(root);
    lights.push({ root, swing, mat, base: new THREE.Color(color), phase: Math.random() * 6.28, amp: 0.05 + Math.random() * 0.03, s });
    poolSpots.push({ x, z, r: 0.16 * s });
  };

  // ---------- 树灯：由左到右连成光带（目标点→最近的树）----------
  const SPOTS = [
    [-1.94, 1.16, AMBER],
    [-1.81, 0.95, RED],
    [-1.59, 1.36, ORANGE],
    [-1.11, 2.26, RED],
    [0.65, 1.84, AMBER],
    [1.43, 0.44, ORANGE],
    [1.91, 0.68, AMBER],
    [2.20, 1.19, RED],
  ];
  const CX = 0, CZ = 0.9; // 岛心，用来定"向外"方向
  let placed = 0;
  for (const [tx, tz, col] of SPOTS) {
    const t = pick(tx, tz);
    if (!t) continue;
    const s = t.s || 1;
    const dir = new THREE.Vector3(t.x * 0.55 - CX * 0.55, 0, 0.92).normalize();
    const hy = 0.50 + ((placed * 37) % 11) / 110; // 高度轻微错落
    makeLamp(t.x, t.y + hy * s, t.z, s, col, dir);
    placed++;
  }

  // ---------- 鸟居提灯（笠木下沿两端）----------
  {
    const cosY = Math.cos(SHRINE_SITE.yaw), sinY = Math.sin(SHRINE_SITE.yaw);
    const baseY = terrain(SHRINE_SITE.x, SHRINE_SITE.z) + 0.27;
    for (const lx of [-0.075, 0.075]) {
      const wx = SHRINE_SITE.x + lx * cosY + 0.248 * sinY;
      const wz = SHRINE_SITE.z - lx * sinY + 0.248 * cosY;
      const y = baseY + 0.196;
      const root = new THREE.Group();
      const cord = new THREE.Mesh(cordGeo, capMat);
      cord.scale.set(1, 0.026, 1);
      cord.position.y = -0.013;
      root.add(cord);
      const mat = new THREE.MeshStandardMaterial({
        color: RED, roughness: 0.58, metalness: 0, emissive: RED, emissiveIntensity: 0.18,
      });
      const body = new THREE.Mesh(bodyGeo, mat);
      const R = 0.026;
      body.scale.setScalar(R);
      body.position.y = -0.030 - R;
      root.add(body);
      const capTop = new THREE.Mesh(capGeo, capMat);
      capTop.scale.set(R * 0.30, R * 0.20, R * 0.30);
      capTop.position.y = -0.026;
      root.add(capTop);
      const capBot = new THREE.Mesh(capGeo, capMat);
      capBot.scale.set(R * 0.26, R * 0.16, R * 0.26);
      capBot.position.y = -0.030 - R * 1.96;
      root.add(capBot);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xFFB877, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      sp.scale.setScalar(0.26);
      sp.position.y = -0.030 - R;
      root.add(sp);
      glowSprites.push(sp);
      root.position.set(wx, y, wz);
      group.add(root);
      lights.push({ root, swing: root, mat, base: new THREE.Color(RED), phase: Math.random() * 6.28, amp: 0.02, s: 0.6 });
      poolSpots.push({ x: wx, z: wz, r: 0.13 });
    }
  }

  // ---------- 雪洞（岛前沿草地两侧）----------
  const huts = [];
  const hutGeo = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const holeGeo = new THREE.CircleGeometry(1, 16);
  const hutInnerMat = new THREE.MeshBasicMaterial({ color: 0xFFB269, transparent: true, opacity: 0, toneMapped: false });
  const hutDarkMat = new THREE.MeshBasicMaterial({ color: 0x241C1A, toneMapped: false });
  for (const [hx, hz, r] of [[-1.30, 1.75, 0.155], [0.35, 1.72, 0.150]]) {
    const y = terrain(hx, hz);
    if (y < -0.02) continue;
    const g = new THREE.Group();
    g.position.set(hx, y - 0.004, hz);
    const dome = new THREE.Mesh(hutGeo, snowMat);
    dome.scale.set(r * 1.25, r * 1.05, r * 1.25);
    dome.castShadow = true;
    dome.receiveShadow = true;
    g.add(dome);
    // 洞口：朝镜头（+Z 略偏）
    const hole = new THREE.Mesh(holeGeo, hutDarkMat);
    hole.position.set(0, r * 0.36, r * 1.20);
    hole.scale.setScalar(r * 0.52);
    g.add(hole);
    const inner = new THREE.Mesh(holeGeo, hutInnerMat);
    inner.position.set(0, r * 0.36, r * 1.212);
    inner.scale.setScalar(r * 0.42);
    g.add(inner);
    // 洞口外一圈暖光
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xFF9E54, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    sp.scale.setScalar(r * 5.2);
    sp.position.set(0, r * 0.42, r * 1.25);
    g.add(sp);
    glowSprites.push(sp);
    huts.push({ inner });
    group.add(g);
    poolSpots.push({ x: hx, z: hz + r * 1.1, r: r * 2.6 });
  }

  // ---------- 雪地暖光池 ----------
  const poolMat = new THREE.MeshBasicMaterial({
    map: radialTex(128), color: 0xFFB774, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMat, poolSpots.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    e.set(-Math.PI / 2, 0, 0); q.setFromEuler(e);
    poolSpots.forEach((p, i) => {
      sv.set(p.r * 2, p.r * 2, 1);
      pv.set(p.x, terrain(p.x, p.z) + 0.014, p.z);
      m.compose(pv, q, sv);
      pools.setMatrixAt(i, m);
    });
    pools.instanceMatrix.needsUpdate = true;
    pools.frustumCulled = false;
  }
  pools.renderOrder = 4;
  group.add(pools);

  // ---------- 少量暖光点光源 ----------
  const pointLights = [];
  for (let i = 0; i < lights.length; i += 4) {
    const pl = new THREE.PointLight(0xffb070, 0, 1.9, 2);
    const p = lights[i].swing.getWorldPosition(new THREE.Vector3());
    pl.position.copy(p);
    group.add(pl);
    pointLights.push(pl);
  }

  let amount = 0;   // 季节权重（冬=1）
  let lamp = 0;     // 0 白天 → 1 夜
  let t = 0;

  function setSeason(a) {
    amount = Math.max(0, Math.min(1, a));
    group.visible = amount > 0.02;
  }

  function setLamp(a, tint) {
    lamp = Math.max(0, Math.min(1, a));
    if (!group.visible) return;
    const c = tint || new THREE.Color('#FFB877');
    const dim = 0.97 + 0.10 * lamp;
    for (const sp of glowSprites) {
      sp.material.color.copy(c).lerp(new THREE.Color(0xFFC48A), 0.5);
      sp.material.opacity = lamp * 0.62;
    }
    for (const h of huts) {
      h.inner.material.opacity = lamp * 0.95;
    }
    poolMat.color.copy(c);
    poolMat.opacity = lamp * 0.24;
    for (const l of lights) {
      l.mat.color.copy(l.base).multiplyScalar(dim);
      l.mat.emissive.copy(l.base).multiplyScalar(lamp * 0.92 + 0.16);
    }
    for (const pl of pointLights) {
      pl.color.copy(c);
      pl.intensity = lamp * 1.7;
    }
  }

  function update(dt) {
    if (!group.visible) return;
    t += dt;
    for (const l of lights) {
      l.swing.rotation.z = Math.sin(t * 0.9 + l.phase) * l.amp;
      l.swing.rotation.x = Math.cos(t * 0.7 + l.phase * 1.3) * l.amp * 0.6;
    }
  }

  return {
    group, setSeason, setLamp, update,
    info: { lamps: lights.length, huts: huts.length, points: pointLights.length },
  };
}
