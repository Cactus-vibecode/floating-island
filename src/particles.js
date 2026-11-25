import * as THREE from 'three';
import { terrain } from './island.js';

function makeTexture(kind) {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, S, S);
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#ffffff';

  if (kind === 'petal') {
    c.beginPath();
    c.moveTo(64, 118);
    c.bezierCurveTo(20, 96, 20, 26, 64, 12);
    c.bezierCurveTo(108, 26, 108, 96, 64, 118);
    c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(64, 96);
    c.lineTo(64, 44);
    c.stroke();
    c.globalCompositeOperation = 'source-over';
  } else if (kind === 'leaf') {
    c.beginPath();
    const pts = [[64, 6], [78, 40], [120, 34], [96, 68], [114, 112], [64, 92], [14, 112], [32, 68], [8, 34], [50, 40]];
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i], pr = pts[i - 1];
      c.quadraticCurveTo((p[0] + pr[0]) / 2 + 6, (p[1] + pr[1]) / 2, p[0], p[1]);
    }
    c.closePath();
    c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(64, 24); c.lineTo(64, 104);
    c.moveTo(64, 56); c.lineTo(40, 40);
    c.moveTo(64, 56); c.lineTo(88, 40);
    c.stroke();
    c.globalCompositeOperation = 'source-over';
  } else if (kind === 'snow') {
    const g = c.createRadialGradient(64, 64, 2, 64, 64, 58);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.34, 'rgba(255,255,255,0.92)');
    g.addColorStop(0.66, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(64, 64, 58, 0, Math.PI * 2);
    c.fill();
  } else {
    const g = c.createRadialGradient(64, 64, 2, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

const STYLE = {
  petal: { fall: [0.24, 0.46], sway: 0.8, swayF: 1.5, size: [0.055, 0.10], spin: 2.4, grav: 0.35, count: 1 },
  pollen: { fall: [0.10, 0.24], sway: 1.3, swayF: 2.1, size: [0.03, 0.055], spin: 0.9, grav: 0.12, count: 1 },
  leaf: { fall: [0.30, 0.56], sway: 1.1, swayF: 1.2, size: [0.07, 0.125], spin: 3.0, grav: 0.45, count: 1 },
  snow: { fall: [0.18, 0.34], sway: 0.5, swayF: 0.9, size: [0.04, 0.08], spin: 0.7, grav: 0.06, count: 1 },
};

export class ParticleField {
  constructor(count = 800) {
    this.count = count;
    this.n = count;
    this.sizeScale = 1;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.rot = new Float32Array(count * 3);
    this.spin = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.tintIdx = new Uint8Array(count);
    this.fade = new Float32Array(count);
    this.tex = {
      petal: makeTexture('petal'),
      pollen: makeTexture('pollen'),
      leaf: makeTexture('leaf'),
      snow: makeTexture('snow'),
    };

    const geo = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.MeshLambertMaterial({
      map: this.tex.petal,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaTest: 0.04,
      opacity: 1,
      emissive: new THREE.Color(0x2a2a26),
      emissiveIntensity: 0.35,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.styleKey = 'petal';

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._rng = mulberry32(20261123);

    for (let i = 0; i < count; i++) {
      this.spawnAmbient(i, true);
      this.fade[i] = 1;
      this.mesh.setColorAt(i, this._c.set('#ffffff'));
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.writeMatrices();
  }

  setStyle(key) {
    if (!STYLE[key] || this.styleKey === key) return;
    this.styleKey = key;
    this.mat.map = this.tex[key];
    this.mat.needsUpdate = true;
    const st = STYLE[key];
    for (let i = 0; i < this.count; i++) {
      this.size[i] = st.size[0] + this._rng() * (st.size[1] - st.size[0]);
    }
  }

  setColors(tints) {
    if (!tints) return;
    for (let i = 0; i < this.count; i++) {
      this.mesh.setColorAt(i, this._c.copy(tints[this.tintIdx[i] % tints.length]));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  spawnAmbient(i, initial = false) {
    const rng = this._rng;
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 2.9 + 0.2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = 0.6 + rng() * 2.9;
    this.pos[i3 + 2] = z;
    const st = STYLE[this.styleKey] || STYLE.petal;
    this.vel[i3] = (rng() - 0.5) * 0.18;
    this.vel[i3 + 1] = -(st.fall[0] + rng() * (st.fall[1] - st.fall[0]));
    this.vel[i3 + 2] = (rng() - 0.5) * 0.18;
    this.rot[i3] = rng() * 6.28; this.rot[i3 + 1] = rng() * 6.28; this.rot[i3 + 2] = rng() * 6.28;
    this.spin[i3] = (rng() - 0.5) * st.spin;
    this.spin[i3 + 1] = (rng() - 0.5) * st.spin * 0.8;
    this.spin[i3 + 2] = (rng() - 0.5) * st.spin * 1.2;
    this.size[i] = st.size[0] + rng() * (st.size[1] - st.size[0]);
    this.phase[i] = rng() * 6.28;
    this.tintIdx[i] = Math.floor(rng() * 3);
    this.fade[i] = 1;
    if (initial) this.pos[i3 + 1] = -0.2 + rng() * 3.6;
  }

  burst(point, n = 6, power = 1) {
    const rng = this._rng;
    for (let k = 0; k < n; k++) {
      const i = Math.floor(rng() * this.count);
      const i3 = i * 3;
      this.pos[i3] = point.x + (rng() - 0.5) * 0.24;
      this.pos[i3 + 1] = point.y + rng() * 0.2;
      this.pos[i3 + 2] = point.z + (rng() - 0.5) * 0.24;
      const a = rng() * Math.PI * 2;
      const sp = (0.5 + rng() * 1.1) * power;
      this.vel[i3] = Math.cos(a) * sp * 0.55;
      this.vel[i3 + 1] = 0.5 + rng() * 0.9 * power;
      this.vel[i3 + 2] = Math.sin(a) * sp * 0.55;
      this.spin[i3] = (rng() - 0.5) * 6;
      this.spin[i3 + 1] = (rng() - 0.5) * 6;
      this.spin[i3 + 2] = (rng() - 0.5) * 6;
      this.size[i] = (STYLE[this.styleKey] || STYLE.petal).size[0] * (0.85 + rng() * 0.5);
      this.fade[i] = 1.2;
    }
  }

  update(dt, time) {
    const st = STYLE[this.styleKey] || STYLE.petal;
    const p = this.pos, v = this.vel;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const sway = Math.sin(time * st.swayF + this.phase[i]) * st.sway;
      const sway2 = Math.cos(time * st.swayF * 0.7 + this.phase[i] * 1.7) * st.sway * 0.5;
      p[i3] += (v[i3] + sway) * dt;
      p[i3 + 1] += v[i3 + 1] * dt;
      p[i3 + 2] += (v[i3 + 2] + sway2) * dt;
      v[i3 + 1] -= st.grav * dt;

      this.rot[i3] += this.spin[i3] * dt;
      this.rot[i3 + 1] += this.spin[i3 + 1] * dt;
      this.rot[i3 + 2] += this.spin[i3 + 2] * dt;

      if (v[i3 + 1] < -st.fall[1] * 1.6) v[i3 + 1] = -st.fall[1] * 1.6;

      const gy = terrain(p[i3], p[i3 + 2]);
      if (p[i3 + 1] < gy - 0.35 || Math.abs(p[i3]) > 6 || Math.abs(p[i3 + 2]) > 6) {
        this.spawnAmbient(i);
      }
      if (this.fade[i] > 1) this.fade[i] -= dt * 0.7;
    }
    this.writeMatrices();
  }

  writeMatrices() {
    const arr = this.mesh.instanceMatrix.array;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      this._e.set(this.rot[i3], this.rot[i3 + 1], this.rot[i3 + 2]);
      this._q.setFromEuler(this._e);
      this._v.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      const s = this.size[i] * this.sizeScale * Math.min(1, this.fade[i]);
      this._s.set(s, s, s);
      this._m.compose(this._v, this._q, this._s);
      this._m.toArray(arr, i * 16);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
