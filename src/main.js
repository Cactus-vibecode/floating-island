import * as THREE from 'three';

const DEBUG = /[?&]debug/.test(location.search);
import { SEASONS, LIGHT, periodWeights, clonePalette, mixPalette, smooth } from './seasons.js';
import { buildIsland, terrain } from './island.js';
import { buildWildlife } from './wildlife.js';
import { buildLife } from './life.js';
import { buildLanterns } from './lantern.js';
import { buildWinterLights } from './winterlights.js';
import { CONFIG, seasonFromDate } from './config.js';
import { ParticleField } from './particles.js';
import { contactShadow } from './textures.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const WIDGET = params.has('widget');
const CLEAN = params.has('clean');
const zoomParam = Number(params.get('zoom'));
let zoom = Number.isFinite(zoomParam) && zoomParam > 0 ? Math.min(1.4, Math.max(0.55, zoomParam)) : 1;
const canvas = document.getElementById('stage');
if (WIDGET) document.body.classList.add('widget');
if (CLEAN) document.body.classList.add('clean');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  document.body.classList.add('no-webgl');
  throw err;
}
renderer.setPixelRatio(CAPTURE ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0xffffff, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 13, 38);

// ---------- 影棚环境光 ----------
function buildEnvironment() {
  const envScene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(30, 32, 24);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const cTop = new THREE.Color(0xffffff);
  const cMid = new THREE.Color(0xf4f5f1);
  const cBot = new THREE.Color(0xd6d8d0);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 30 * 0.5 + 0.5, 0, 1);
    if (t > 0.5) c.copy(cMid).lerp(cTop, (t - 0.5) * 2);
    else c.copy(cBot).lerp(cMid, t * 2);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  envScene.add(dome);

  const hot = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(7.5, 6.9, 6.0) })
  );
  hot.position.set(-14, 17, 13);
  envScene.add(hot);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  return rt.texture;
}

scene.environment = buildEnvironment();
scene.environmentIntensity = 0.52;

const camera = new THREE.PerspectiveCamera(30, 1, 0.2, 120);
const camTarget = new THREE.Vector3(0, WIDGET ? 0.18 : 0.34, 0);

const hemi = new THREE.HemisphereLight(0xffffff, 0xb9c4a8, 0.30);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xfff1dc, 4.7);
keyLight.position.set(-6.4, 6.2, 6.0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0006;
keyLight.shadow.normalBias = 0.018;
keyLight.shadow.radius = 2.4;
const sc = keyLight.shadow.camera;
sc.near = 2; sc.far = 26; sc.left = -4.6; sc.right = 4.6; sc.top = 4.6; sc.bottom = -4.6;
sc.updateProjectionMatrix();
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xdfeaff, 0.42);
fillLight.position.set(6.2, 3.4, 4.0);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.85);
rimLight.position.set(1.6, 4.6, -7.2);
scene.add(rimLight);

// 底部反弹光：照亮岛底，避免发死黑
const bounceLight = new THREE.DirectionalLight(0xf2f4ef, 0.62);
bounceLight.position.set(-1.5, -6, 4.5);
scene.add(bounceLight);

const ambient = new THREE.AmbientLight(0xffffff, 0.06);
scene.add(ambient);


// ---------- 落地投影 ----------
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(9.6, 9.6),
  new THREE.MeshBasicMaterial({
    map: contactShadow(256),
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
    toneMapped: false,
  })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -2.25;
if (!WIDGET) scene.add(shadowPlane);

// 季节：URL 显式指定优先（截图/调试用），否则按设备本地日期自动判断
const seasonParam = params.get('season');
const startSeason = WIDGET
  ? (seasonParam !== null && Number.isFinite(Number(seasonParam))
      ? ((Math.trunc(Number(seasonParam)) % 4) + 4) % 4
      : seasonFromDate())
  : 0;
const pal = clonePalette(SEASONS[startSeason]);
let sa = startSeason, sb = startSeason, st = 1, sdur = CONFIG.transitionSec;

const island = buildIsland(21);
const wildlife = buildWildlife(9, island.trees);
wildlife.setGroundY(terrain);
const life = buildLife(island, 5);
let lanterns = null;
if (DEBUG) { window.__terrain = terrain; window.__life = life; window.__wl = wildlife; window.__pal = pal; window.__isl = island; window.__scene = scene; window.__key = keyLight; window.__hemi = hemi; window.__renderer = renderer; window.__three = THREE; window.__cam = camera; }
scene.add(island.group);
island.group.add(wildlife.group);
island.group.add(life.group);
lanterns = buildLanterns(island);
island.group.add(lanterns.group);
const winterLights = buildWinterLights(island);
island.group.add(winterLights.group);
if (DEBUG) { window.__lanterns = lanterns; window.__winter = winterLights; window.__light = () => ({ exposure: renderer.toneMappingExposure, key: keyLight.intensity, hemi: hemi.intensity, lamp: lampAmount, hour: HOUR }); }

const isMobile = !CAPTURE && Math.min(window.innerWidth, window.innerHeight) < 700;
const particles = new ParticleField(CAPTURE ? 170 : WIDGET ? 96 : isMobile ? 140 : 190);
particles.sizeScale = WIDGET ? 0.62 : 1;
if (!CLEAN) scene.add(particles.mesh);


const camState = { theta: 0, phi: 1.19, radius: 13.4, thetaT: 0, phiT: 1.19, radiusT: 13.4 };
let simTime = 0;
let interactAt = -99;
let spinVel = 0;
let leafAmt = 0;

// ---------- 桌面摆件模式 ----------
const widgetAPI = WIDGET ? window.cactus : null;
const hitCenter = new THREE.Vector3(0, 0.05, 0);
const _proj = new THREE.Vector3();
let overIsland = false;
let gripDrag = false;
let spinPaused = false;

function hitMetrics() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  _proj.copy(hitCenter).project(camera);
  const cx = (_proj.x * 0.5 + 0.5) * w;
  const cy = (-_proj.y * 0.5 + 0.5) * h;
  const dist = camera.position.distanceTo(hitCenter);
  const r = (3.28 / (dist * Math.tan((camera.fov * Math.PI) / 360))) * (h / 2);
  return { cx, cy, rx: r, ry: r * 0.94 };
}

function screenHitTest(x, y) {
  const m = hitMetrics();
  return ((x - m.cx) / m.rx) ** 2 + ((y - m.cy) / m.ry) ** 2 < 1;
}

function setOver(next) {
  if (!widgetAPI || next === overIsland) return;
  overIsland = next;
  widgetAPI.setHit(next);
}

// 真实时间 → 时段光照（清晨 / 正午 / 夜晚），季节用当前插值权重
const hourParam = Number(params.get('hour'));
let HOUR = Number.isFinite(hourParam) ? hourParam : new Date().getHours() + new Date().getMinutes() / 60;

// 预先把 12 套预设里的色值转成 Color，避免每帧 new
const LIGHT_C = LIGHT.map((s) =>
  ['morning', 'noon', 'night'].reduce((acc, k) => {
    const p = s[k];
    acc[k] = {
      ...p,
      keyCol: new THREE.Color(p.keyCol),
      hemiSky: new THREE.Color(p.hemiSky),
      hemiGround: new THREE.Color(p.hemiGround),
      fog: new THREE.Color(p.fog),
      lampTint: new THREE.Color(p.lampTint),
    };
    return acc;
  }, {})
);

const _lk = new THREE.Color(), _lhs = new THREE.Color(), _lhg = new THREE.Color(), _lf = new THREE.Color(), _lt = new THREE.Color();
const _pa = new THREE.Color(), _pb = new THREE.Color();
let lampAmount = 0; // 0 白天 → 1 全夜，灯串/石灯笼据此点亮
const lampTint = new THREE.Color('#FFB469');
let dayLight = { exposure: 1.12, key: 4.9, hemi: 0.30, env: 0.52 };
// 雾的距离系数（× 相机距离）：清晨雾更浓，夜里稍浓
let fogScale = { near: 0.97, far: 2.85 };

function applyDaylight() {
  if (!WIDGET) return;
  const w = periodWeights(HOUR);
  const A = LIGHT_C[sa], B = LIGHT_C[sb];
  const k = Math.min(1, Math.max(0, st));

  let keyInt = 0, exposure = 0, hemiInt = 0, env = 0, ambient = 0, rimInt = 0, lamp = 0;
  let fogN = 0, fogF = 0;
  let dx = 0, dy = 0, dz = 0;
  _lk.setRGB(0, 0, 0); _lhs.setRGB(0, 0, 0); _lhg.setRGB(0, 0, 0); _lf.setRGB(0, 0, 0); _lt.setRGB(0, 0, 0);

  for (const key of ['morning', 'noon', 'night']) {
    const wp = w[key];
    if (wp < 0.0005) continue;
    const a = A[key], b = B[key];
    keyInt += (a.keyInt + (b.keyInt - a.keyInt) * k) * wp;
    exposure += (a.exposure + (b.exposure - a.exposure) * k) * wp;
    hemiInt += (a.hemiInt + (b.hemiInt - a.hemiInt) * k) * wp;
    env += (a.env + (b.env - a.env) * k) * wp;
    ambient += (a.ambient + (b.ambient - a.ambient) * k) * wp;
    rimInt += (a.rim + (b.rim - a.rim) * k) * wp;
    lamp += (a.lamp + (b.lamp - a.lamp) * k) * wp;
    fogN += ((a.fogNear ?? 0.97) + ((b.fogNear ?? 0.97) - (a.fogNear ?? 0.97)) * k) * wp;
    fogF += ((a.fogFar ?? 2.85) + ((b.fogFar ?? 2.85) - (a.fogFar ?? 2.85)) * k) * wp;
    dx += (a.keyDir[0] + (b.keyDir[0] - a.keyDir[0]) * k) * wp;
    dy += (a.keyDir[1] + (b.keyDir[1] - a.keyDir[1]) * k) * wp;
    dz += (a.keyDir[2] + (b.keyDir[2] - a.keyDir[2]) * k) * wp;

    _pa.copy(a.keyCol).lerp(b.keyCol, k); _lk.r += _pa.r * wp; _lk.g += _pa.g * wp; _lk.b += _pa.b * wp;
    _pa.copy(a.hemiSky).lerp(b.hemiSky, k); _lhs.r += _pa.r * wp; _lhs.g += _pa.g * wp; _lhs.b += _pa.b * wp;
    _pa.copy(a.hemiGround).lerp(b.hemiGround, k); _lhg.r += _pa.r * wp; _lhg.g += _pa.g * wp; _lhg.b += _pa.b * wp;
    _pa.copy(a.fog).lerp(b.fog, k); _lf.r += _pa.r * wp; _lf.g += _pa.g * wp; _lf.b += _pa.b * wp;
    _pa.copy(a.lampTint).lerp(b.lampTint, k); _lt.r += _pa.r * wp; _lt.g += _pa.g * wp; _lt.b += _pa.b * wp;
  }

  dayLight = { exposure, key: keyInt, hemi: hemiInt, env };
  fogScale.near = fogN;
  fogScale.far = fogF;

  const len = Math.hypot(dx, dy, dz) || 1;
  keyLight.position.set((dx / len) * 11, (dy / len) * 11, (dz / len) * 11);
  keyLight.color.copy(_lk);
  keyLight.intensity = keyInt;
  hemi.color.copy(_lhs);
  hemi.groundColor.copy(_lhg);
  hemi.intensity = hemiInt;
  scene.environmentIntensity = env;
  scene.fog.color.copy(_lf);
  ambient.intensity = ambient;
  rimLight.color.copy(_lhs).lerp(_lk, 0.35);
  rimLight.intensity = rimInt;
  renderer.toneMappingExposure = exposure;

  lampAmount = lamp;
  lampTint.copy(_lt);
  if (lanterns) lanterns.setLamp(lamp, lampTint);
  if (winterLights) winterLights.setLamp(lamp, lampTint);
  const skyEl = document.getElementById('nightSky');
  if (skyEl) skyEl.style.opacity = String(Math.min(1, lamp * 0.92));
}

if (WIDGET && widgetAPI) {
  const syncClock = () => {
    if (Number.isFinite(hourParam)) return;
    HOUR = new Date().getHours() + new Date().getMinutes() / 60;
    applyDaylight();
  };
  // 定时轮询：跨时段边界时能在渐变窗口内平滑过渡
  setInterval(syncClock, CONFIG.pollMs);

  // 季节：跟随设备本地日期。只在「日期真的跨了季」时才自动切，
  // 这样用户手动选过的季节不会被下一次轮询抢回去。
  let lastAutoSeason = seasonFromDate();
  const syncSeason = () => {
    const want = seasonFromDate();
    if (want === lastAutoSeason) return;
    lastAutoSeason = want;
    setSeason(want, CONFIG.transitionSec);
  };
  setInterval(syncSeason, CONFIG.pollMs);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSeason(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncClock(); });
  widgetAPI.onSeason((i) => {
    setSeason(Number(i) || 0, 2.2);
    hideHint();
  });
  widgetAPI.onSpin((v) => { spinPaused = !v; });
  const whint = document.getElementById('whint');
  const grip = document.getElementById('grip');
  let hintTimer = null;
  const showHint = (text, ms) => {
    if (!whint) return;
    if (text) whint.textContent = text;
    whint.style.transition = 'opacity .35s';
    whint.style.opacity = '1';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { whint.style.opacity = '0'; }, ms || 9000);
  };
  showHint(null, 9000);

  // 底部手柄：唯一负责"搬动窗口"的入口，跟岛身旋转完全隔离
  const halo = document.getElementById('halo');
  const haloLabel = document.getElementById('haloLabel');
  const setHalo = (on) => {
    if (halo && on) {
      // 按岛的实际投影尺寸套一圈，缩放/窗口大小变化后都贴合
      const m = hitMetrics();
      const w = Math.round(m.rx * 2 * 1.08);
      const h = Math.round(m.ry * 2 * 1.08);
      halo.style.left = `${Math.round(m.cx - w / 2)}px`;
      halo.style.top = `${Math.round(m.cy - h / 2)}px`;
      halo.style.width = `${w}px`;
      halo.style.height = `${h}px`;
    }
    halo?.classList.toggle('on', on);
    haloLabel?.classList.toggle('on', on);
  };

  if (grip) {
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      gripDrag = true;
      grip.classList.add('dragging', 'hot');
      setHalo(true);
      widgetAPI.beginWindowDrag();
      hideHint();
      if (whint) {
        whint.style.transition = 'opacity .16s';
        whint.style.opacity = '0';
      }
    });
    const endGripDrag = () => {
      if (!gripDrag) return;
      gripDrag = false;
      grip.classList.remove('dragging');
      setHalo(false);
      widgetAPI.endWindowDrag();
    };
    grip.addEventListener('pointerup', endGripDrag);
    grip.addEventListener('pointercancel', endGripDrag);
    grip.addEventListener('pointerenter', () => grip.classList.add('hot'));
    grip.addEventListener('pointerleave', () => { if (!gripDrag) grip.classList.remove('hot'); });
    // 窗口穿透状态下拿不到 pointerenter，由主进程告知光标是否在手柄上
    widgetAPI.onGripHot?.((v) => {
      if (gripDrag) return;
      grip.classList.toggle('hot', v);
    });
    window.addEventListener('pointerup', endGripDrag);
    // 主进程宣布拖完（含超时兜底），这里无条件复位
    widgetAPI.onDragEnd?.(() => {
      if (!gripDrag) return;
      gripDrag = false;
      grip.classList.remove('dragging');
      setHalo(false);
    });
  }

  let lastRect = '';
  const pushRect = () => {
    const m = hitMetrics();
    const key = [m.cx, m.cy, m.rx, m.ry].map((v) => Math.round(v)).join(',');
    if (key === lastRect) return;
    lastRect = key;
    widgetAPI.setHitRect({ cx: m.cx, cy: m.cy, rx: m.rx, ry: m.ry });
  };
  pushRect();
  setInterval(pushRect, 500);
}

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  camera.aspect = aspect;
  camera.fov = WIDGET ? 30 : 30 + 14 * Math.max(0, Math.min(1, 1.12 - aspect));
  camera.updateProjectionMatrix();
  const need = fitRadius();
  camState.radiusT = camState.radius = need;
}

function fitRadius() {
  const aspect = camera.aspect || 1;
  const base = (WIDGET ? 3.95 : CAPTURE ? 4.38 : 3.92) /
    (Math.tan((camera.fov * Math.PI) / 360) * Math.min(aspect, 1.5));
  return Math.max(11.8, Math.min(base, 27)) / zoom;
}

function setZoom(next) {
  zoom = Math.max(0.55, Math.min(1.4, next));
  camState.radiusT = fitRadius();
  if (WIDGET && widgetAPI) widgetAPI.setZoom(zoom);
}
window.addEventListener('resize', resize);

let lastSky = '';
function applyPalette() {
  island.apply(pal);
  if (winterLights) winterLights.setSeason(pal.winterLights ?? 0);
  hemi.color.copy(pal.hemiSky);
  hemi.groundColor.copy(pal.hemiGround);
  keyLight.color.copy(pal.keyCol);
  fillLight.color.copy(pal.hemiSky);
  scene.fog.color.copy(pal.fog);
  particles.setStyle(pal.particle);
  particles.setColors(pal.petalTint);

  const sky = `radial-gradient(120% 100% at 50% 8%, ${pal.sky[0]} 0%, ${pal.sky[1]} 56%, ${pal.sky[2]} 100%)`;
  if (sky !== lastSky) {
    lastSky = sky;
    if (!WIDGET) document.body.style.background = sky;
    document.documentElement.style.setProperty('--accent', pal.ui);
  }
  applyDaylight();
}

function updateCamera(dt, instant = false) {
  const k = instant ? 1 : Math.min(1, dt * 8.5);
  camState.theta += (camState.thetaT - camState.theta) * k;
  camState.phi += (camState.phiT - camState.phi) * k;
  camState.radius += (camState.radiusT - camState.radius) * k;
  const r = camState.radius;
  // 雾的距离跟着相机距离走：放大/缩小只改变取景，不该把岛"洗淡"
  if (scene.fog) {
    scene.fog.near = r * fogScale.near;
    scene.fog.far = r * fogScale.far;
  }
  camera.position.set(
    camTarget.x + r * Math.sin(camState.phi) * Math.sin(camState.theta),
    camTarget.y + r * Math.cos(camState.phi),
    camTarget.z + r * Math.sin(camState.phi) * Math.cos(camState.theta)
  );
  camera.lookAt(camTarget);
}

const seasonButtons = Array.from(document.querySelectorAll('#seasons button'));
function paintUI(idx) {
  seasonButtons.forEach((b, i) => b.classList.toggle('on', i === idx));
}

function setSeason(i, dur = CONFIG.transitionSec) {
  i = (i + 4) % 4;
  const cur = st >= 1 ? sb : st > 0.5 ? sb : sa;
  if (i === cur && st >= 1) return;
  sa = cur;
  sb = i;
  st = 0;
  sdur = dur;
  paintUI(i);
}

let hovered = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoverAmp = 0, hoverTarget = 0, lastBurst = 0;
const _hm = new THREE.Matrix4();
const _hs = new THREE.Matrix4();

function scaleMatrix(m, s) {
  m.identity();
  m.elements[0] = s; m.elements[5] = s; m.elements[10] = s;
  return m;
}

function pickAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(island.canopies, false);
  return hits.length ? hits[0] : null;
}

function clearHover() {
  if (!hovered) return;
  hovered.mesh.setMatrixAt(hovered.idx, hovered.mesh.userData.base[hovered.idx]);
  hovered.mesh.instanceMatrix.needsUpdate = true;
  hovered = null;
  hoverTarget = 0;
}

let dragging = false, moved = 0, downAt = 0, lastX = 0, lastY = 0;

canvas.addEventListener('pointerdown', (e) => {
  // 岛身上的拖动只做一件事：旋转。窗口搬动交给底部手柄，两者互不干扰
  if (WIDGET && widgetAPI) widgetAPI.holdHit(true);
  canvas.setPointerCapture(e.pointerId);
  dragging = true; moved = 0; downAt = performance.now();
  lastX = e.clientX; lastY = e.clientY;
  spinVel = 0;
  canvas.style.cursor = 'grabbing';
  hideHint();
});

canvas.addEventListener('pointermove', (e) => {
  if (WIDGET && !dragging) setOver(screenHitTest(e.clientX, e.clientY));
  // 兜底：指针已经抬起但 up 事件丢了，别卡在"转岛中"
  if (WIDGET && dragging && (e.buttons & 1) === 0) { endDrag(e); return; }
  const now = performance.now();
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    island.group.rotation.y += dx * 0.0065;
    camState.phiT = Math.max(1.05, Math.min(1.42, camState.phiT - dy * 0.0032));
    spinVel = dx * 0.3;
    interactAt = now / 1000;
    return;
  }
  if (e.pointerType !== 'mouse') return;
  if (now - lastBurst < 80) return;
  const hit = pickAt(e.clientX, e.clientY);
  canvas.style.cursor = hit ? 'pointer' : 'grab';
  if (hit) {
    if (!hovered || hovered.mesh !== hit.object || hovered.idx !== hit.instanceId) {
      clearHover();
      hovered = { mesh: hit.object, idx: hit.instanceId };
    }
    hoverTarget = 1;
    lastBurst = now;
    particles.burst(hit.point, 3, 0.9);
    interactAt = now / 1000;
  } else {
    clearHover();
  }
});

function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  if (WIDGET && widgetAPI) widgetAPI.holdHit(false);
  canvas.style.cursor = 'grab';
  const quick = performance.now() - downAt < 380;
  if (moved < 10 && quick) {
    const hit = pickAt(e.clientX, e.clientY);
    if (hit) {
      particles.burst(hit.point, 16, 1.5);
      clearHover();
      hovered = { mesh: hit.object, idx: hit.instanceId };
      hoverTarget = 1;
      interactAt = performance.now() / 1000;
    }
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => { if (!dragging) { clearHover(); setOver(false); } });

canvas.addEventListener('wheel', (e) => {
  if (CAPTURE) return;
  e.preventDefault();
  setZoom(zoom * Math.exp(-e.deltaY * 0.0018));
}, { passive: false });

canvas.addEventListener('dblclick', (e) => {
  if (CAPTURE) return;
  e.preventDefault();
  setZoom(1);
});

if (WIDGET && widgetAPI) {
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    widgetAPI.openMenu();
  });
  window.addEventListener('blur', () => {
    // 拖动中失焦要正常收尾，否则窗口会一直跟着光标跑
    if (gripDrag) {
      gripDrag = false;
      document.getElementById('grip')?.classList.remove('dragging');
      document.getElementById('halo')?.classList.remove('on');
      document.getElementById('haloLabel')?.classList.remove('on');
      widgetAPI.endWindowDrag();
    }
    setOver(false);
  });
}

seasonButtons.forEach((b, i) => {
  b.addEventListener('click', () => { setSeason(i); hideHint(); });
});

const hintEl = document.getElementById('hint');
let hintHidden = false;
function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  if (hintEl) hintEl.style.opacity = '0';
}
setTimeout(hideHint, 7000);

function updateHover(dt) {
  hoverAmp += (hoverTarget - hoverAmp) * Math.min(1, dt * 12);
  if (!hovered) return;
  const s = 1 + 0.07 * hoverAmp;
  const base = hovered.mesh.userData.base[hovered.idx];
  _hm.copy(base).multiply(scaleMatrix(_hs, s));
  hovered.mesh.setMatrixAt(hovered.idx, _hm);
  hovered.mesh.instanceMatrix.needsUpdate = true;
}

// 记录每个树冠实例的基准矩阵，供 hover 使用
for (const mesh of island.canopies) {
  mesh.userData.base = [];
  for (let i = 0; i < mesh.count; i++) {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(i, m);
    mesh.userData.base.push(m.clone());
  }
}

const FPS = 10;
const TL = [{ t: 0, s: 0 }, { t: 3, s: 1 }, { t: 6, s: 2 }, { t: 9, s: 3 }, { t: 12, s: 0 }];
function phaseAt(t) {
  t = ((t % 12) + 12) % 12;
  for (let k = 0; k < TL.length - 1; k++) {
    const a = TL[k], b = TL[k + 1];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / (b.t - a.t);
      if (u < 0.62) return { a: a.s, b: a.s, p: 1 };
      return { a: a.s, b: b.s, p: smooth((u - 0.62) / 0.38) };
    }
  }
  return { a: 0, b: 0, p: 1 };
}

function step(dt, tAbs) {
  simTime += dt;

  let pa, pb, pp, dirty = false;
  if (CAPTURE) {
    const ph = phaseAt(tAbs);
    pa = ph.a; pb = ph.b; pp = ph.p;
    paintUI(pp > 0.5 ? pb : pa);
    dirty = true;
  } else {
    if (st < 1) { st = Math.min(1, st + dt / sdur); dirty = true; }
    pa = sa; pb = sb; pp = smooth(st);
  }
  if (dirty) {
    mixPalette(SEASONS[pa], SEASONS[pb], pp, pal);
    applyPalette();
  }

  leafAmt += ((pal.particle === 'leaf' ? 1 : 0) - leafAmt) * Math.min(1, dt * 2.2);
  island.setLeaf(leafAmt);

  if (CAPTURE) {
    const u = (tAbs / 12) * Math.PI * 2;
    camState.thetaT = camState.theta = 0.30 * Math.sin(u - Math.PI / 2);
    camState.phiT = camState.phi = 1.19 + 0.02 * Math.sin(u);
    island.group.rotation.y = 0;
  } else {
    const idle = performance.now() / 1000 - interactAt;
    if (!dragging) {
      if (spinPaused) spinVel = 0;
      else if (idle > 2.6) spinVel += (0.12 - spinVel) * Math.min(1, dt * 1.2);
      else spinVel *= Math.pow(0.12, dt);
      island.group.rotation.y += spinVel * dt;
      camState.thetaT = 0;
    }
  }

  updateCamera(dt, CAPTURE);

  for (const f of island.floaters) {
    f.position.y = f.userData.baseY + Math.sin(simTime * 0.6 + f.userData.phase) * 0.09;
    f.rotation.y += f.userData.spin * dt;
    f.rotation.x += f.userData.spin * 0.4 * dt;
  }

  island.waterMap.offset.y -= dt * 0.045;
  if (island.foamTex) island.foamTex.offset.y -= dt * 1.10; // 白练下滑
  island.waterMap.offset.x += dt * 0.008;

  wildlife.update(simTime, pal, pal.petalTint);
  life.update(simTime, pal, dt);
  lanterns.update(dt);
  winterLights.update(dt);

  particles.update(dt, simTime);
  updateHover(dt);
  renderer.render(scene, camera);
}

resize();
applyPalette();
updateCamera(0, true);
renderer.render(scene, camera);

if (CAPTURE) {
  document.body.classList.add('capture');
  window.__warm = (n = 150) => { for (let i = 0; i < n; i++) step(1 / 30, 0); };
  window.__step = (i) => step(1 / FPS, i / FPS);
  window.__meta = { fps: FPS, frames: 120, duration: 12 };
} else {
  let last = performance.now();
  let acc = 0;
  const frameInterval = WIDGET ? 1 / 32 : 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (document.hidden) { last = now; acc = 0; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    if (WIDGET) {
      acc += dt;
      if (acc < frameInterval) return;
    }
    last = now;
    acc = 0;
    step(dt, now / 1000);
  };
  requestAnimationFrame(loop);
}
