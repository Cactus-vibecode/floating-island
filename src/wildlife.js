import * as THREE from 'three';

// 极简生物：绕岛飞行的小鸟 + 春季的蝴蝶
// 都用最省的几何体拼出来，靠动作而不是细节取胜

function wingGeo(len, chord, back = 0.012) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, chord * 0.4,
    len, 0.004, -back,
    len * 0.86, 0.002, chord * 0.62,
    0, 0, chord * 0.85,
  ], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

const FLY_COLORS = [0xFFD23F, 0xFFFFFF, 0xFF7FA8, 0xFF9A4D, 0x86D0FF, 0xFFE873].map(
  (h) => new THREE.Color(h)
);

export function buildWildlife(seed = 7, trees = []) {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const group = new THREE.Group();
  const birds = [];
  const flies = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3f3b35, roughness: 0.85, metalness: 0, flatShading: true, envMapIntensity: 0.3,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x57524a, roughness: 0.9, metalness: 0,
    side: THREE.DoubleSide, flatShading: true, envMapIntensity: 0.3,
  });

  const birdBody = new THREE.ConeGeometry(0.019, 0.10, 6);
  birdBody.rotateX(Math.PI / 2);
  birdBody.translate(0, 0, 0.01);
  const birdWing = wingGeo(0.098, 0.062);

  const N_BIRD = 6;
  for (let i = 0; i < N_BIRD; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(birdBody, bodyMat));
    const rw = new THREE.Mesh(birdWing, wingMat);
    const lw = new THREE.Mesh(birdWing, wingMat);
    lw.scale.x = -1;
    g.add(rw, lw);
    const sc = 0.7 + rnd() * 0.4;
    g.scale.setScalar(sc);
    group.add(g);
    birds.push({
      g, rw, lw,
      rad: 2.15 + rnd() * 1.5,
      y: 2.25 + rnd() * 1.05,
      speed: (0.22 + rnd() * 0.16) * (rnd() > 0.25 ? 1 : -1),
      phase: rnd() * Math.PI * 2,
      flap: 7.5 + rnd() * 3.5,
      bob: 0.1 + rnd() * 0.14,
      tilt: (rnd() - 0.5) * 0.5,
    });
  }

  // 蝴蝶：翅膀用同样的四边形，颜色随季节里的花色调
  const N_FLY = 14;
  for (let i = 0; i < N_FLY; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.75, metalness: 0, side: THREE.DoubleSide,
      transparent: true, opacity: 0, envMapIntensity: 0.4,
    });
    const g = new THREE.Group();
    const geo = wingGeo(0.105, 0.125);
    const rw = new THREE.Mesh(geo, mat);
    const lw = new THREE.Mesh(geo, mat);
    lw.scale.x = -1;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.042, 2, 4), mat);
    body.rotation.x = Math.PI / 2;
    g.add(rw, lw, body);
    g.scale.setScalar(0.9 + rnd() * 0.5);
    group.add(g);
    let hx = 0, hz = 0;
    const nearMeadow = i % 2 === 0;
    for (let tries = 0; tries < 40; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = nearMeadow ? 0.25 + Math.sqrt(rnd()) * 0.85 : 0.7 + Math.sqrt(rnd()) * 2.0;
      const ox = nearMeadow ? -0.15 : 0, oz = nearMeadow ? 1.05 : 0;
      hx = ox + Math.cos(a) * r; hz = oz + Math.sin(a) * r;
      let clear = true;
      for (const t of trees) {
        if (Math.hypot(t.x - hx, t.z - hz) < 0.45) { clear = false; break; }
      }
      if (clear) break;
    }
    flies.push({
      g, rw, lw, mat,
      hx, hz, hy: 0,
      phase: rnd() * Math.PI * 2,
      flap: 12 + rnd() * 6,
      spin: (rnd() - 0.5) * 1.6,
    });
  }

  function setGroundY(fn) {
    for (const f of flies) f.hy = fn(f.hx, f.hz);
  }

  function update(t, p, tint) {
    for (const b of birds) {
      const a = b.phase + t * b.speed;
      const x = Math.cos(a) * b.rad;
      const z = Math.sin(a) * b.rad;
      const y = b.y + Math.sin(t * 1.1 + b.phase) * b.bob;
      b.g.position.set(x, y, z);
      b.g.rotation.y = b.speed > 0 ? -a : -a + Math.PI;
      b.g.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.10 + Math.sign(b.speed) * 0.12;
      const f = Math.sin(t * b.flap + b.phase);
      const amt = 0.28 + 0.62 * Math.abs(f) * (0.35 + 0.65 * Math.max(0, f));
      b.rw.rotation.z = amt;
      b.lw.rotation.z = -amt;
    }

    const bf = Math.max(0, Math.min(1, p.butterflies ?? 0));
    for (let i = 0; i < flies.length; i++) {
      const b = flies[i];
      b.mat.opacity = bf;
      b.g.visible = bf > 0.02;
      if (bf < 0.02) continue;
      const x = b.hx + Math.sin(t * 0.55 + b.phase) * 0.26 + Math.sin(t * 1.9 + b.phase * 2) * 0.05;
      const z = b.hz + Math.cos(t * 0.47 + b.phase * 1.7) * 0.26 + Math.cos(t * 2.2 + b.phase) * 0.04;
      const y = b.hy + 0.46 + Math.sin(t * 1.3 + b.phase) * 0.10;
      b.g.position.set(x, y, z);
      b.g.rotation.y = Math.sin(t * 0.5 + b.phase) * 1.4 + b.spin * t * 0.15;
      const f = Math.sin(t * b.flap + b.phase);
      b.rw.rotation.z = 0.15 + 0.9 * f;
      b.lw.rotation.z = -(0.15 + 0.9 * f);
      b.mat.color.copy(FLY_COLORS[i % FLY_COLORS.length]);
    }
  }

  return { group, update, setGroundY, birds, flies };
}
