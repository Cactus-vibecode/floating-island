import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = (h) => new THREE.Color(h);

// 写实沙盘配色：所有颜色都直接对应参考图的自然色，靠光照而不是饱和色取胜
export const SEASONS = [
  {
    key: 'spring',
    label: '春',
    ui: '#C4708C',
    sky: ['#FFFFFF', '#FBFAF8', '#F1F1EE'],
    fog: C('#F4F4F1'),
    hemiSky: C('#FFFFFF'),
    hemiGround: C('#A9B48E'),
    keyCol: C('#FFF3E2'),
    grass: [C('#93C64B'), C('#5D9433')],
    moss: C('#86BB46'),
    dirt: C('#8A7350'),
    rock: [C('#A3917A'), C('#7B6E5D')],
    canopy: [C('#F79AB8'), C('#FBCADD'), C('#EE7CA2'), C('#8FCB55')],
    conifer: [C('#37603A'), C('#4A7549')],
    water: C('#5FBBDA'),
    waterRough: 0.10,
    butterflies: 1,
    flowers: 0.40,
    folk: 0,
    dogsA: 0,
    dogsW: 0,
    play: 0,
    snow: 0,
    winterLights: 0,
    sitters: 0,
    jizo: 0,
    particle: 'petal',
    petalTint: [C('#F7C6D6'), C('#FCE3EA'), C('#F2AFC5'), C('#FFF0F4')],
  },
  {
    key: 'summer',
    label: '夏',
    ui: '#4A7A46',
    sky: ['#FFFFFF', '#F9FBF8', '#EEF2EA'],
    fog: C('#F1F4EC'),
    hemiSky: C('#F4FAFF'),
    hemiGround: C('#7E9060'),
    keyCol: C('#FFF6E4'),
    grass: [C('#74AF3C'), C('#3E7727')],
    moss: C('#5C9E33'),
    dirt: C('#7A6444'),
    rock: [C('#9D8B74'), C('#726757')],
    canopy: [C('#4F9C31'), C('#357D25'), C('#6FB53F'), C('#2A6B26')],
    conifer: [C('#27492B'), C('#376035')],
    water: C('#4FB6DE'),
    waterRough: 0.10,
    butterflies: 0.25,
    flowers: 1,
    folk: 1,
    dogsA: 0,
    dogsW: 0,
    play: 0,
    snow: 0,
    winterLights: 0,
    sitters: 0,
    jizo: 0,
    particle: 'pollen',
    petalTint: [C('#E2EFC0'), C('#CFE6A2'), C('#F0F7DA'), C('#BFDD8C')],
  },
  {
    key: 'autumn',
    label: '秋',
    ui: '#B4552C',
    sky: ['#FFFFFF', '#FCFAF6', '#F2EFE8'],
    fog: C('#F5F1E9'),
    hemiSky: C('#FFF6EA'),
    hemiGround: C('#8C7A4E'),
    keyCol: C('#FFEBCB'),
    grass: [C('#A2A249'), C('#59622F')],
    moss: C('#75853C'),
    dirt: C('#7B5F3E'),
    rock: [C('#A08D75'), C('#74685A')],
    canopy: [C('#EEA914'), C('#D06A12'), C('#B62B16'), C('#D1901C')],
    conifer: [C('#2F4A33'), C('#3D5A3D')],
    water: C('#57B2D2'),
    waterRough: 0.14,
    butterflies: 0.15,
    flowers: 0.13,
    folk: 0,
    dogsA: 1,
    dogsW: 0,
    play: 0,
    snow: 0,
    winterLights: 0,
    sitters: 1,
    jizo: 1,
    particle: 'leaf',
    petalTint: [C('#C4402A'), C('#DB8A28'), C('#A82E1E'), C('#E0B23C')],
  },
  {
    key: 'winter',
    label: '冬',
    ui: '#4E6E85',
    sky: ['#FFFFFF', '#FAFCFD', '#EDF1F4'],
    fog: C('#F2F6F8'),
    hemiSky: C('#EFF7FF'),
    hemiGround: C('#B9C4C6'),
    keyCol: C('#EAF3FF'),
    grass: [C('#D7E2E3'), C('#BDCACB')],
    moss: C('#CBD8D8'),
    dirt: C('#A6A6A0'),
    rock: [C('#ACA69B'), C('#7E7A72')],
    canopy: [C('#E7EFF2'), C('#C6D6DC'), C('#AEBFC7'), C('#F9FDFE')],
    conifer: [C('#4A6352'), C('#5C7563')],
    water: C('#AFD9E8'),
    waterRough: 0.26,
    butterflies: 0,
    flowers: 0,
    folk: 0,
    dogsA: 0,
    dogsW: 1,
    play: 1,
    snow: 1,
    winterLights: 1,
    sitters: 0,
    jizo: 1,
    particle: 'snow',
    petalTint: [C('#FFFFFF'), C('#EDF5FA'), C('#DFEBF2'), C('#F7FBFF')],
  },
];

export function clonePalette(src) {
  return {
    fog: src.fog.clone(),
    hemiSky: src.hemiSky.clone(),
    hemiGround: src.hemiGround.clone(),
    keyCol: src.keyCol.clone(),
    grass: src.grass.map((c) => c.clone()),
    moss: src.moss.clone(),
    dirt: src.dirt.clone(),
    rock: src.rock.map((c) => c.clone()),
    canopy: src.canopy.map((c) => c.clone()),
    conifer: src.conifer.map((c) => c.clone()),
    water: src.water.clone(),
    waterRough: src.waterRough,
    butterflies: src.butterflies,
    flowers: src.flowers,
    folk: src.folk,
    dogsA: src.dogsA,
    dogsW: src.dogsW,
    play: src.play,
    snow: src.snow,
    winterLights: src.winterLights,
    sitters: src.sitters,
    jizo: src.jizo,
    sky: src.sky.slice(),
    ui: src.ui,
    particle: src.particle,
    petalTint: src.petalTint.map((c) => c.clone()),
  };
}

export function mixPalette(a, b, t, out) {
  out.fog.copy(a.fog).lerp(b.fog, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.keyCol.copy(a.keyCol).lerp(b.keyCol, t);
  out.grass[0].copy(a.grass[0]).lerp(b.grass[0], t);
  out.grass[1].copy(a.grass[1]).lerp(b.grass[1], t);
  out.moss.copy(a.moss).lerp(b.moss, t);
  out.dirt.copy(a.dirt).lerp(b.dirt, t);
  out.rock[0].copy(a.rock[0]).lerp(b.rock[0], t);
  out.rock[1].copy(a.rock[1]).lerp(b.rock[1], t);
  for (let i = 0; i < out.canopy.length; i++) out.canopy[i].copy(a.canopy[i]).lerp(b.canopy[i], t);
  for (let i = 0; i < out.conifer.length; i++) out.conifer[i].copy(a.conifer[i]).lerp(b.conifer[i], t);
  out.water.copy(a.water).lerp(b.water, t);
  out.waterRough = a.waterRough + (b.waterRough - a.waterRough) * t;
  out.butterflies = a.butterflies + (b.butterflies - a.butterflies) * t;
  out.flowers = a.flowers + (b.flowers - a.flowers) * t;
  out.folk = a.folk + (b.folk - a.folk) * t;
  out.dogsA = a.dogsA + (b.dogsA - a.dogsA) * t;
  out.dogsW = a.dogsW + (b.dogsW - a.dogsW) * t;
  out.play = a.play + (b.play - a.play) * t;
  out.snow = a.snow + (b.snow - a.snow) * t;
  out.winterLights = a.winterLights + (b.winterLights - a.winterLights) * t;
  out.sitters = a.sitters + (b.sitters - a.sitters) * t;
  out.jizo = a.jizo + (b.jizo - a.jizo) * t;
  for (let i = 0; i < out.petalTint.length; i++) out.petalTint[i].copy(a.petalTint[i]).lerp(b.petalTint[i], t);
  out.sky = a.sky.map((c, i) => hexLerp(c, b.sky[i], t));
  out.ui = hexLerp(a.ui, b.ui, t);
  out.particle = t > 0.5 ? b.particle : a.particle;
  return out;
}

export function hexLerp(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

export const smooth = (t) => t * t * (3 - 2 * t);

// ============================================================
// 时段（清晨 / 正午 / 夜晚）
// 区间与过渡宽度都可以改；跨边界时按 falloff 平滑混合，不是硬切
// ============================================================
export const PERIODS = {
  morning: { key: 'morning', label: '清晨', ...CONFIG.periods.morning },
  noon: { key: 'noon', label: '正午', ...CONFIG.periods.noon },
  night: { key: 'night', label: '夜晚', ...CONFIG.periods.night },
  falloff: CONFIG.periods.falloff, // 边界前后各 falloff 小时做渐变
};

const sstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 返回 { morning, noon, night } 三个 0~1 权重，和为 1
export function periodWeights(hour) {
  const f = PERIODS.falloff;
  const h = ((hour % 24) + 24) % 24;
  const toNoon = sstep(PERIODS.noon.from - f, PERIODS.noon.from + f, h);
  const toNight = sstep(PERIODS.night.from - f, PERIODS.night.from + f, h);
  const fromNight = sstep(PERIODS.morning.from - f, PERIODS.morning.from + f, h);
  const morning = fromNight * (1 - toNoon);
  const noon = toNoon * (1 - toNight);
  const night = Math.max(0, 1 - fromNight + fromNight * toNight);
  const sum = morning + noon + night || 1;
  return { morning: morning / sum, noon: noon / sum, night: night / sum };
}

// ============================================================
// 4 季 × 3 时段的光照预设（12 套）
// keyDir 是从岛屿指向光源的方向（会按需归一化后放大）
// lamp：灯笼/灯串的发光强度（0 白天、1 夜里全亮）
// ============================================================
export const LIGHT = [
  // 春
  {
    morning: {
      keyCol: '#FFB06A', keyInt: 3.06, keyDir: [-0.82, 0.07, 0.56], exposure: 0.902,
      hemiSky: '#FFE3D2', hemiGround: '#9C9B7A', hemiInt: 0.114, env: 0.228,
      fogNear: 0.64, fogFar: 1.92, fog: '#F8E3D6', ambient: 0.01, rim: 0.397, lamp: 0, lampTint: '#FFD9C4',
    },
    noon: {
      keyCol: '#FFF2DE', keyInt: 5.292, keyDir: [-0.40, 0.88, 0.44], exposure: 1.165,
      hemiSky: '#FFFFFF', hemiGround: '#A9B48E', hemiInt: 0.30, env: 0.52,
      fogNear: 1.06, fogFar: 2.98, fog: '#F4F4F1', ambient: 0.06, rim: 0.85, lamp: 0, lampTint: '#FFD9C4',
    },
    night: {
      keyCol: '#8E96C4', keyInt: 1.10, keyDir: [-0.46, 0.54, -0.52], exposure: 0.564,
      hemiSky: '#565878', hemiGround: '#221F2A', hemiInt: 0.177, env: 0.139,
      fogNear: 0.88, fogFar: 2.45, fog: '#1B2541', ambient: 0.02, rim: 0.55, lamp: 1, lampTint: '#FFD9C4',
    },
  },
  // 夏
  {
    morning: {
      keyCol: '#FFBC6E', keyInt: 3.15, keyDir: [-0.82, 0.07, 0.56], exposure: 0.921,
      hemiSky: '#FFE9CE', hemiGround: '#7E9060', hemiInt: 0.108, env: 0.238,
      fogNear: 0.64, fogFar: 1.92, fog: '#F5E9D4', ambient: 0.01, rim: 0.397, lamp: 0, lampTint: '#E8E2A8',
    },
    noon: {
      keyCol: '#FFF6E4', keyInt: 5.292, keyDir: [-0.40, 0.88, 0.44], exposure: 1.165,
      hemiSky: '#F4FAFF', hemiGround: '#7E9060', hemiInt: 0.30, env: 0.52,
      fogNear: 1.06, fogFar: 2.98, fog: '#F1F4EC', ambient: 0.06, rim: 0.85, lamp: 0, lampTint: '#E8E2A8',
    },
    night: {
      keyCol: '#6E8FCE', keyInt: 1.20, keyDir: [-0.44, 0.52, -0.56], exposure: 0.502,
      hemiSky: '#3E5A86', hemiGround: '#1A2233', hemiInt: 0.126, env: 0.132,
      fogNear: 0.88, fogFar: 2.45, fog: '#16213A', ambient: 0.02, rim: 0.52, lamp: 1, lampTint: '#E8E2A8',
    },
  },
  // 秋
  {
    morning: {
      keyCol: '#FFA456', keyInt: 3.06, keyDir: [-0.82, 0.07, 0.56], exposure: 0.902,
      hemiSky: '#FFE0C8', hemiGround: '#8C7A4E', hemiInt: 0.111, env: 0.228,
      fogNear: 0.64, fogFar: 1.92, fog: '#F6DEC4', ambient: 0.01, rim: 0.397, lamp: 0, lampTint: '#FFB35C',
    },
    noon: {
      keyCol: '#FFEBCB', keyInt: 5.292, keyDir: [-0.40, 0.88, 0.44], exposure: 1.165,
      hemiSky: '#FFF6EA', hemiGround: '#8C7A4E', hemiInt: 0.30, env: 0.52,
      fogNear: 1.06, fogFar: 2.98, fog: '#F5F1E9', ambient: 0.06, rim: 0.85, lamp: 0, lampTint: '#FFB35C',
    },
    night: {
      keyCol: '#7A90C4', keyInt: 1.10, keyDir: [-0.46, 0.52, -0.54], exposure: 0.534,
      hemiSky: '#46608C', hemiGround: '#222838', hemiInt: 0.14, env: 0.139,
      fogNear: 0.88, fogFar: 2.45, fog: '#1A2238', ambient: 0.02, rim: 0.50, lamp: 1, lampTint: '#FFB35C',
    },
  },
  // 冬
  {
    morning: {
      keyCol: '#F2D8EC', keyInt: 2.88, keyDir: [-0.82, 0.07, 0.56], exposure: 0.94,
      hemiSky: '#E9EFFF', hemiGround: '#C2CBD0', hemiInt: 0.114, env: 0.249,
      fogNear: 0.64, fogFar: 1.92, fog: '#F0F4FA', ambient: 0.013, rim: 0.422, lamp: 0, lampTint: '#FFA96A',
    },
    noon: {
      keyCol: '#EAF3FF', keyInt: 5.292, keyDir: [-0.40, 0.88, 0.44], exposure: 1.165,
      hemiSky: '#EFF7FF', hemiGround: '#B9C4C6', hemiInt: 0.30, env: 0.52,
      fogNear: 1.06, fogFar: 2.98, fog: '#F2F6F8', ambient: 0.06, rim: 0.85, lamp: 0, lampTint: '#FFA96A',
    },
    night: {
      keyCol: '#93ABD8', keyInt: 1.25, keyDir: [-0.44, 0.54, -0.54], exposure: 0.518,
      hemiSky: '#54689A', hemiGround: '#2E3648', hemiInt: 0.148, env: 0.171,
      fogNear: 0.88, fogFar: 2.45, fog: '#27324A', ambient: 0.03, rim: 0.60, lamp: 1, lampTint: '#FFA96A',
    },
  },
];

