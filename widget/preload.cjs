const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cactus', {
  setHit: (v) => ipcRenderer.send('hit:set', !!v),
  setHitRect: (r) => ipcRenderer.send('hit:rect', r),
  holdHit: (v) => ipcRenderer.send('hit:hold', !!v),
  setZoom: (v) => ipcRenderer.send('zoom:set', v),
  beginWindowDrag: () => ipcRenderer.send('win:dragStart'),
  dragWindow: (dx, dy) => ipcRenderer.send('win:drag', dx, dy),
  endWindowDrag: () => ipcRenderer.send('win:dragEnd'),
  openMenu: () => ipcRenderer.send('menu:open'),
  onSeason: (cb) => ipcRenderer.on('season:set', (_e, i) => cb(i)),
  onSpin: (cb) => ipcRenderer.on('spin:set', (_e, v) => cb(v)),
  onDragEnd: (cb) => ipcRenderer.on('drag:end', () => cb()),
  onGripHot: (cb) => ipcRenderer.on('grip:hot', (_e, v) => cb(!!v)),
});
