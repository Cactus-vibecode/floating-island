// Cactus 桌面摆件 —— 透明置顶小窗，岛就"摆"在桌面上
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'dist', 'index.html');
let SIZE = Number(process.env.WIDGET_SIZE || 420);
const SIZES = [ { label: '小 · 320', v: 320 }, { label: '中 · 420', v: 420 }, { label: '大 · 560', v: 560 }, { label: '特大 · 720', v: 720 } ];

// 命令行开关在 .app 里会被 Chromium 拒掉，所以用环境变量 / 标记文件驱动截图
let shotCfg = {};
try {
  shotCfg = JSON.parse(fs.readFileSync(path.join(__dirname, '.shot'), 'utf8')) || {};
} catch {}
const SHOT = process.env.CACTUS_SHOT === '1' || shotCfg.shot === true;
const OPAQUE = process.env.CACTUS_OPAQUE === '1';
const forcedSeason = Number.isFinite(shotCfg.season) ? shotCfg.season : null;

// 单实例：再次打开只是把岛叫出来
const gotLock = app.requestSingleInstanceLock();
if (!gotLock && !SHOT) {
  app.quit();
  process.exit(0);
}

app.dock?.hide();

let win = null;
let tray = null;
let dragOrigin = null;
let dragTimer = null;
let alwaysOnTop = true;
let spinPaused = false;
let currentSeason = 0;
let seasonTimer = null;

const SEASON_NAMES = ['春', '夏', '秋', '冬'];

// 月份 → 季节（0-based month）。默认：3-5 春、6-8 夏、9-11 秋、12-2 冬
// 想改成节气口径就改这张表的区间
const MONTH_SEASON = [
  { from: 2, to: 4, season: 0 },
  { from: 5, to: 7, season: 1 },
  { from: 8, to: 10, season: 2 },
  { from: 11, to: 13, season: 3 }, // 12 月
  { from: 0, to: 1, season: 3 },   // 1-2 月
];

function seasonOfMonth(m) {
  for (const r of MONTH_SEASON) if (m >= r.from && m <= r.to) return r.season;
  return 3;
}

const sameDay = (ts) => {
  if (!ts) return false;
  return new Date(ts).toDateString() === new Date().toDateString();
};

// 当前该显示哪一季：
//  - 当天手动选过 → 听手动的（方便预览）；
//  - 跨天 / 日期已经落到别的季节 → 自动回归月份规则，保证「按日期更迭」不被永久锁死。
function activeSeason() {
  const st = stateCache || readState();
  const byMonth = seasonOfMonth(new Date().getMonth());
  if (st.seasonMode === 'manual' && sameDay(st.seasonAt) && Number.isFinite(st.season)) {
    if (st.season === byMonth) return byMonth;
    // 手动值与日期不同：只有当天才保留，日期一变就跟随日历
    return st.season;
  }
  return byMonth;
}

const statePath = () => path.join(app.getPath('userData'), 'widget-state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return {};
  }
}

let stateCache = null;
function saveState(patch) {
  stateCache = { ...(stateCache || readState()), ...patch };
  try {
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify(stateCache, null, 2));
  } catch (err) {
    /* 写不进去不影响使用 */
  }
}

function defaultPosition() {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(area.x + area.width - SIZE - 36),
    y: Math.round(area.y + area.height - SIZE - 28),
  };
}

function visibleOnSomeDisplay(x, y) {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    // 至少有一块区域落在屏内才算有效
    return x + SIZE > a.x + 40 && x < a.x + a.width - 40 && y + SIZE > a.y && y < a.y + a.height - 40;
  });
}

function createWindow() {
  const saved = readState();
  if (!process.env.WIDGET_SIZE && Number.isFinite(saved.size)) SIZE = saved.size;
  const pos = Number.isFinite(saved.x) && visibleOnSomeDisplay(saved.x, saved.y) ? saved : defaultPosition();

  win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    x: pos.x,
    y: pos.y,
    transparent: !OPAQUE,
    backgroundColor: OPAQUE ? '#ff00ff' : '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: false,
    },
  });

  win.setMenu(null);
  win.setAlwaysOnTop(alwaysOnTop, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // 默认整窗点击穿透，只有指针落在岛身上才接收鼠标
  win.setIgnoreMouseEvents(true, { forward: true });

  const season = Number.isFinite(forcedSeason) ? forcedSeason : activeSeason();
  currentSeason = season;
  const hour = new Date().getHours() + new Date().getMinutes() / 60;

  const zoom = Number.isFinite(saved.zoom) ? saved.zoom : 1;
  win.loadFile(PAGE, { query: { widget: '1', season: String(season), hour: String(hour), zoom: String(zoom) } });

  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (SHOT) {
    win.webContents.on('console-message', (_e, level, msg) => console.log('[page]', msg));
    win.webContents.on('did-fail-load', (_e, code, desc) => console.log('[fail]', code, desc));
  }

  win.once('ready-to-show', () => {
    win.showInactive(); // 不激活 app
    if (SHOT) {
      // 截图时先停住自动旋转，保证每次取景一致
      setTimeout(() => win.webContents.send('spin:set', false), 900);
      setTimeout(async () => {
        try {
          const info = await win.webContents.executeJavaScript(
            'JSON.stringify({ url: location.href, cls: document.body.className, canvas: !!document.getElementById("stage"), webgl: (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return "err:" + e.message; } })() })'
          );
          console.log('page:', info);
          const img = await win.capturePage();
          const out = shotCfg.out || process.env.CACTUS_SHOT_OUT || path.join(ROOT, 'shots', 'widget.png');
          fs.mkdirSync(path.dirname(out), { recursive: true });
          fs.writeFileSync(out, img.toPNG());
          console.log('shot ->', out);
        } catch (e) {
          console.log('shot failed', e.message);
        }
        app.exit(0);
      }, 3200);
    }
  });

  // 拖动时每帧都会触发 moved，写盘要节流
  let savePosTimer = null;
  win.on('moved', () => {
    if (!win) return;
    clearTimeout(savePosTimer);
    savePosTimer = setTimeout(() => {
      if (!win) return;
      const [x, y] = win.getPosition();
      saveState({ x, y });
    }, 400);
  });

  win.on('closed', () => { win = null; });

  // 跨月自动换季：每 10 分钟检查一次，只在「没有当天手动选择」时生效
  if (!seasonTimer) {
    seasonTimer = setInterval(() => {
      if (!win || SHOT) return;
      if (Number.isFinite(forcedSeason)) return;
      const st = stateCache || readState();
      if (st.seasonMode === 'manual' && sameDay(st.seasonAt)) return;
      const want = seasonOfMonth(new Date().getMonth());
      if (want === currentSeason) return;
      currentSeason = want;
      saveState({ season: want, seasonMode: 'auto' });
      win.webContents.send('season:set', want);
      queueRefresh();
    }, 600000);
  }


  if (SHOT) setTimeout(() => { console.error('shot: timeout'); app.exit(3); }, 20000);

  win.webContents.on('render-process-gone', () => {
    if (win) win.reload();
  });
}

// ---------- 托盘 ----------
function buildMenu() {
  const season = activeSeason();
  return Menu.buildFromTemplate([
    { label: 'Cactus', enabled: false },
    { type: 'separator' },
    {
      label: '季节',
      submenu: SEASON_NAMES.map((name, i) => ({
        label: name,
        type: 'radio',
        checked: i === season,
        click: () => setSeason(i),
      })),
    },
    {
      label: '窗口大小',
      submenu: SIZES.map((s) => ({
        label: s.label,
        type: 'radio',
        checked: SIZE === s.v,
        click: () => setWindowSize(s.v),
      })),
    },
    {
      label: spinPaused ? '继续旋转' : '暂停旋转',
      click: () => {
        spinPaused = !spinPaused;
        win?.webContents.send('spin:set', !spinPaused);
        queueRefresh();
      },
    },
    { type: 'separator' },
    {
      label: '总在最前',
      type: 'checkbox',
      checked: alwaysOnTop,
      click: (item) => {
        alwaysOnTop = item.checked;
        win?.setAlwaysOnTop(alwaysOnTop, 'floating');
        saveState({ alwaysOnTop });
        queueRefresh();
      },
    },
    ...(app.isPackaged
      ? [{
          label: '开机自动出现',
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
        }]
      : []),
    { type: 'separator' },
    { label: '拖动小岛 = 旋转', enabled: false },
    { label: '拖底部小横条 = 移动位置', enabled: false },
    { label: '滚轮缩放 · 右键出菜单', enabled: false },
    { type: 'separator' },
    { label: '退出', role: 'quit' },
  ]);
}

function refreshMenus() {
  const m = buildMenu();
  if (tray) tray.setContextMenu(m);
  app.applicationMenu = m;
}

// 菜单项被点中时正在关菜单，立刻重建原生菜单会把 popup 打断，延迟一点
let refreshTimer = null;
function queueRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshMenus, 220);
}

function setWindowSize(n) {
  SIZE = n;
  saveState({ size: n });
  if (win) {
    const [x, y] = win.getPosition();
    win.setSize(n, n, false);
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    const nx = Math.min(Math.max(x, area.x), area.x + area.width - n);
    const ny = Math.min(Math.max(y, area.y), area.y + area.height - n);
    win.setPosition(Math.round(nx), Math.round(ny), false);
    saveState({ x: Math.round(nx), y: Math.round(ny) });
  }
  queueRefresh();
}

function setSeason(i) {
  saveState({ season: i, seasonMode: 'manual', seasonAt: Date.now() });
  win?.webContents.send('season:set', i);
  queueRefresh();
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray.png');
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) {
    img = nativeImage.createEmpty();
  } else {
    img = img.resize({ width: 18, height: 18 });
    img.setTemplateImage(true);
  }
  tray = new Tray(img);
  tray.setToolTip('Cactus');
  refreshMenus();
  tray.on('click', () => {
    if (!win) return createWindow();
    win.showInactive();
  });
}

// ---------- IPC ----------
let interactive = false;
let hitHold = false;
let hitRect = null;
let menuOpen = false;
let gripHot = false;

function setInteractive(next) {
  if (!win || next === interactive) return;
  interactive = next;
  win.setIgnoreMouseEvents(!next, { forward: true });
}

ipcMain.on('hit:set', (_e, v) => setInteractive(!!v));
ipcMain.on('hit:hold', (_e, v) => { hitHold = !!v; });
ipcMain.on('hit:rect', (_e, r) => {
  if (r && Number.isFinite(r.cx)) hitRect = r;
});

// 主动探测光标：即使窗口在穿透状态、收不到鼠标事件，也能判断该不该接管
setInterval(() => {
  // 菜单弹出时绝不能改穿透状态：setIgnoreMouseEvents 会让原生菜单立刻失焦关闭
  if (!win || !hitRect || hitHold || dragOrigin || menuOpen) return;
  const p = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  const [ww, wh] = win.getSize();
  const lx = p.x - wx, ly = p.y - wy;
  if (lx < 0 || ly < 0 || lx > ww || ly > wh) return setInteractive(false);
  const inside =
    ((lx - hitRect.cx) / (hitRect.rx + 4)) ** 2 + ((ly - hitRect.cy) / (hitRect.ry + 4)) ** 2 <= 1;
  // 底部搬运手柄也要算进可点击区域，否则光标一移过去窗口就变穿透，抓不住
  const inGrip = Math.abs(lx - ww / 2) < 36 && ly > wh - 26;
  setInteractive(inside || inGrip);
  // 穿透窗口拿不到 pointerenter，手柄的高亮由主进程代转
  if (inGrip !== gripHot) {
    gripHot = inGrip;
    win.webContents.send('grip:hot', inGrip);
  }
}, 90);

// 拖动窗口：主进程自己轮询光标位置来跟随，避免渲染进程丢事件导致"拖丢"
ipcMain.on('win:dragStart', () => {
  if (!win) return;
  const p0 = screen.getCursorScreenPoint();
  dragOrigin = { win: win.getPosition(), cursor: [p0.x, p0.y], at: Date.now() };
  setInteractive(true);
  if (dragTimer) clearInterval(dragTimer);
  let last = '';
  let still = [p0.x, p0.y];
  let stillSince = Date.now();
  dragTimer = setInterval(() => {
    if (!win || !dragOrigin) return;
    const p = screen.getCursorScreenPoint();
    if (p.x !== still[0] || p.y !== still[1]) {
      still = [p.x, p.y];
      stillSince = Date.now();
    } else if (Date.now() - stillSince > 1200) {
      // 光标 1.2 秒没动 = 已经松手（即使 mouseup 丢了也能收尾，绝不卡死）
      return endWindowDrag();
    }
    const x = Math.round(dragOrigin.win[0] + p.x - dragOrigin.cursor[0]);
    const y = Math.round(dragOrigin.win[1] + p.y - dragOrigin.cursor[1]);
    const key = x + ',' + y;
    if (key === last) return;
    last = key;
    win.setPosition(x, y, false);
  }, 16);
});

ipcMain.on('win:dragEnd', () => endWindowDrag());

function endWindowDrag() {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
  if (!win || !dragOrigin) {
    dragOrigin = null;
    return;
  }
  dragOrigin = null;
  // 万一被拖到屏幕外，拉回到可见范围
  const b = win.getBounds();
  const area = screen.getDisplayMatching({
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
    width: 1,
    height: 1,
  }).workArea;
  const nx = Math.min(Math.max(b.x, area.x - b.width * 0.35), area.x + area.width - b.width * 0.65);
  const ny = Math.min(Math.max(b.y, area.y), area.y + area.height - b.height * 0.6);
  if (Math.round(nx) !== b.x || Math.round(ny) !== b.y) win.setPosition(Math.round(nx), Math.round(ny), false);
  const [x, y] = win.getPosition();
  saveState({ x, y });
  // 告诉渲染进程"拖动结束"，避免它还卡在拖动态里无视鼠标移动
  win.webContents.send('drag:end');
}

ipcMain.on('zoom:set', (_e, v) => {
  const z = Number(v);
  if (Number.isFinite(z)) saveState({ zoom: Math.max(0.55, Math.min(1.4, z)) });
});

let menuCloseTimer = null;
ipcMain.on('menu:open', () => {
  if (!win) return;
  menuOpen = true;
  // 弹菜单前先确保窗口接收鼠标，否则菜单项点不动
  setInteractive(true);
  const menu = buildMenu();
  menu.on('menu-will-close', () => {
    clearTimeout(menuCloseTimer);
    menuCloseTimer = setTimeout(() => { menuOpen = false; }, 120);
  });
  menu.popup({ window: win });
  // 兜底：万一没收到关闭事件，也别让窗口一直锁在不穿透状态
  clearTimeout(menuCloseTimer);
  menuCloseTimer = setTimeout(() => { menuOpen = false; }, 20000);
});

// ---------- 生命周期 ----------
app.on('second-instance', () => {
  if (win) win.showInactive();
});

app.whenReady().then(() => {
  stateCache = readState();
  alwaysOnTop = stateCache.alwaysOnTop !== false;
  createWindow();
  createTray();
  app.applicationMenu = buildMenu();
});

app.on('window-all-closed', (e) => {
  // 托盘里还有入口，不跟着窗口一起退出
  e.preventDefault?.();
});

app.on('activate', () => {
  if (!win) createWindow();
});
