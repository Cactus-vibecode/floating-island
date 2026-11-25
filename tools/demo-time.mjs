// 时间氛围示意：用运行时调参 + 覆盖层，生成"日出/白天/黄昏/夜晚"的效果预览（不改产品代码）
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const season = process.argv[2] || '1';
const outDir = process.argv[3] || '/tmp/cmp/demo';
const size = Number(process.argv[4] || 640);
const only = process.argv[5];
fs.mkdirSync(outDir, { recursive: true });

const PRESETS = {
  sunrise: {
    exposure: 1.0,
    key: { color: '#FFB067', intensity: 2.7, pos: [-7.2, 1.7, 5.4] },
    hemi: { sky: '#FFD9C2', ground: '#8E8A68', intensity: 0.32 },
    env: 0.44,
    ambient: 0.04,
    fog: '#F6DCC8',
    bg: 'linear-gradient(175deg, #C6D4EA 0%, #EBD3BC 42%, #FFC79B 78%, #FFD9AE 100%)',
    sun: { x: 0.34, y: 0.30, r: 0.38, color: '#FFD9A0', core: '#FFF4DC' },
    warmFloor: 0.35,
  },
  noon: {
    exposure: 1.12,
    key: { color: '#FFF2DE', intensity: 4.9, pos: [-6.4, 6.2, 6.0] },
    hemi: { sky: '#F4FAFF', ground: '#7E9060', intensity: 0.30 },
    env: 0.52,
    ambient: 0.06,
    fog: '#F1F4EC',
    bg: 'transparent',
  },
  sunset: {
    exposure: 0.94,
    key: { color: '#FF7C38', intensity: 2.8, pos: [6.8, 1.4, -4.6] },
    hemi: { sky: '#FFB183', ground: '#5E5847', intensity: 0.28 },
    env: 0.38,
    ambient: 0.05,
    fog: '#E9AE86',
    bg: 'linear-gradient(178deg, #33405F 0%, #6C4F67 38%, #D8794F 76%, #F5A265 100%)',
    sun: { x: 0.66, y: 0.60, r: 0.30, color: '#FF8B45', core: '#FFD08A' },
    warmFloor: 0.22,
  },
  night: {
    exposure: 0.74,
    key: { color: '#6F90D2', intensity: 1.1, pos: [-4.2, 6.6, -5.2] },
    hemi: { sky: '#3A5583', ground: '#151E33', intensity: 0.17 },
    env: 0.15,
    ambient: 0.02,
    fog: '#17243D',
    bg: 'linear-gradient(180deg, #060A14 0%, #0E1728 46%, #1A2A45 100%)',
    moon: { x: 0.76, y: 0.16, r: 0.075 },
    stars: 78,
    lamps: true,
  },
};

for (const [name, cfg] of Object.entries(PRESETS)) {
  if (only && only !== name) continue;
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    let b;
    try {
      b = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: 'new',
        args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
      });
      const p = await b.newPage();
      const hour = name === 'sunrise' ? 6.4 : name === 'sunset' ? 18.1 : name === 'night' ? 21.2 : 13;
      await p.setViewport({ width: size, height: size });
      await new Promise((r) => setTimeout(r, 200));
      await p.goto(
        'file://' + path.resolve('dist/index.html') + `?widget&clean&season=${season}&hour=${hour}&zoom=1&debug`,
        { waitUntil: 'domcontentloaded', timeout: 25000 }
      );
      await new Promise((r) => setTimeout(r, 2600));

      await p.evaluate((c) => {
        const T = window.__three;
        const scene = window.__scene;
        const cam = window.__cam;
        const rend = window.__renderer;

        let key = null, rim = null, fill = null;
        scene.traverse((o) => {
          if (!o.isDirectionalLight) return;
          // 用位置区分主光与补光
          if (o.position.y > 4) key = o;
          else if (o.position.z < -4) rim = o;
          else fill = o;
        });

        rend.toneMappingExposure = c.exposure;
        if (key) {
          key.color.set(c.key.color);
          key.intensity = c.key.intensity;
          key.position.set(...c.key.pos);
        }
        if (rim) { rim.color.set(c.key.color); rim.intensity = c.hemi.intensity * 1.6; }
        scene.traverse((o) => {
          if (o.isHemisphereLight) {
            o.color.set(c.hemi.sky);
            o.groundColor.set(c.hemi.ground);
            o.intensity = c.hemi.intensity;
          }
          if (o.isAmbientLight) o.intensity = c.ambient;
        });
        scene.environmentIntensity = c.env;
        if (scene.fog) scene.fog.color.set(c.fog);
        document.body.style.background = c.bg;
        document.documentElement.style.background = c.bg;

        // ---- 覆盖层：太阳/月亮/星/灯笼暖光 ----
        const layer = document.createElement('div');
        layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;overflow:hidden';
        document.body.appendChild(layer);

        if (c.sun) {
          const s = document.createElement('div');
          const R = c.sun.r * 100;
          s.style.cssText = `position:absolute;left:${c.sun.x * 100}%;top:${c.sun.y * 100}%;width:${R}vmin;height:${R}vmin;transform:translate(-50%,-50%);border-radius:50%;
            background:radial-gradient(circle, ${c.sun.core} 0%, ${c.sun.color} 16%, ${c.sun.color}44 38%, transparent 68%);
            filter:blur(${R * 0.04}vmin);mix-blend-mode:screen`;
          layer.appendChild(s);
        }
        if (c.moon) {
          const m = document.createElement('div');
          const R = c.moon.r * 100;
          m.style.cssText = `position:absolute;left:${c.moon.x * 100}%;top:${c.moon.y * 100}%;width:${R}vmin;height:${R}vmin;transform:translate(-50%,-50%);border-radius:50%;
            background:radial-gradient(circle, #FFFDF2 0%, #E8F0FF 34%, #A9C0E8 58%, transparent 73%);
            box-shadow:0 0 ${R * 2.4}vmin ${R * 0.7}vmin rgba(150,190,255,.20);mix-blend-mode:screen`;
          layer.appendChild(m);
        }
        if (c.stars) {
          for (let i = 0; i < c.stars; i++) {
            const st = document.createElement('div');
            const sz = 1 + Math.random() * 1.6;
            st.style.cssText = `position:absolute;left:${Math.random() * 100}%;top:${Math.random() * 62}%;width:${sz}px;height:${sz}px;border-radius:50%;
              background:#EAF2FF;opacity:${0.25 + Math.random() * 0.6};box-shadow:0 0 ${sz * 2}px rgba(200,220,255,.8)`;
            layer.appendChild(st);
          }
        }
        if (c.lamps) {
          // 神社位置投影到屏幕，做灯笼暖光
          const base = new T.Vector3(-0.66, 0.66, 0.03);
          const l1 = base.clone().add(new T.Vector3(-0.22, -0.02, 0.16));
          const l2 = base.clone().add(new T.Vector3(0.20, -0.02, 0.20));
          const pj = (v) => {
            const q = v.clone().project(cam);
            return { x: (q.x * 0.5 + 0.5) * 100, y: (-q.y * 0.5 + 0.5) * 100 };
          };
          for (const v of [l1, l2]) {
            const q = pj(v);
            const g = document.createElement('div');
            g.style.cssText = `position:absolute;left:${q.x}%;top:${q.y}%;width:9vmin;height:9vmin;transform:translate(-50%,-50%);border-radius:50%;
              background:radial-gradient(circle, rgba(255,206,120,.95) 0%, rgba(255,166,64,.55) 26%, rgba(255,140,40,.16) 52%, transparent 72%);
              mix-blend-mode:screen;filter:blur(.4vmin)`;
            layer.appendChild(g);
            const core = document.createElement('div');
            core.style.cssText = `position:absolute;left:${q.x}%;top:${q.y}%;width:1.6vmin;height:2.2vmin;transform:translate(-50%,-50%);
              background:#FFE7B8;border-radius:40%;box-shadow:0 0 2vmin 1vmin rgba(255,180,80,.55)`;
            layer.appendChild(core);
          }
        }
        if (c.warmFloor) {
          const f = document.createElement('div');
          f.style.cssText = `position:absolute;inset:0;background:linear-gradient(to top, ${c.sun ? c.sun.color : '#FF9A4D'}${Math.round(c.warmFloor * 100)} 0%, transparent 42%);mix-blend-mode:soft-light`;
          layer.appendChild(f);
        }
      }, cfg);

      await new Promise((r) => setTimeout(r, 900));
      const f2 = `${outDir}/${name === 'noon' ? 'noon' : name}.png`;
      await p.screenshot({ path: f2 });
      console.log('->', f2);
      ok = true;
    } catch (e) {
      console.log('retry', name, String(e).slice(0, 70));
    } finally {
      if (b) await b.close().catch(() => {});
    }
  }
}
