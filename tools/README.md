# tools · 出图与探针

这些脚本不是产品代码，是**开发时用来"看见"的工具**：把世界坐标投到屏幕、判断遮挡、批量出图、统计规模。全部基于 Puppeteer 驱动本机 Chrome 打开 `dist/index.html`，所以先跑一次 `npm run build`。

> Chrome 路径默认取 macOS 的 `/Applications/Google Chrome.app/...`，其他位置用环境变量覆盖：
> `CHROME_PATH=/path/to/chrome npm run shots`

## 日常使用

| 脚本 | 用法 | 作用 |
|---|---|---|
| `shot-matrix2.mjs` | `node tools/shot-matrix2.mjs 1000 assets/matrix` | 12 态（4 季 × 3 时段）透明底批量渲染 |
| `probe-err.mjs` | `npm run check` | 12 态巡检，输出 `errors: none` |
| `probe-compo.mjs` | `node tools/probe-compo.mjs 1000 /tmp/compo` | 冻结正视图 → 投影六个控制点 → 截图 + `pts.json`，用于构图标注 |
| `probe-stats.mjs` | `node tools/probe-stats.mjs` | 绘制调用、三角形、实例数、纹理数 |
| `shot-times.mjs` | `node tools/shot-times.mjs 3 "8,12.5,20" /tmp/out 700` | 指定季节的多个时刻 |
| `update-app.mjs` | `node tools/update-app.mjs` | 把 `dist` 同步进 `dist/Cactus.app` 并重启 |
| `make-icon.mjs` | `node tools/make-icon.mjs` | 生成 `build/Cactus.icns` |
| `make-tray.mjs` | `node tools/make-tray.mjs` | 生成托盘图标 |
| `perf.mjs` | `node tools/perf.mjs` | 采样帧率与帧时间 |
| `test-season.mjs` / `test-interact.mjs` | — | 季节切换与交互行为的端到端检查 |

## 定向探针（一次性排查，按需修改）

命名规则很直白：`probe-<问题>.mjs`。

| 脚本 | 当时要解决的问题 |
|---|---|
| `probe-see.mjs` / `probe-occl.mjs` | 某个位置从相机看得到吗？被谁挡住？（射线检测） |
| `probe-tree2.mjs` / `probe-trees.mjs` | 取每棵树的世界坐标与屏幕坐标 |
| `probe-rej.mjs` | 统计植被被拒绝的原因分布 |
| `probe-winter.mjs` / `probe-lamp.mjs` | 灯火候选点的屏幕位置 |
| `probe-compo.mjs` | 构图控制点 |
| `probe-moon.mjs` / `probe-moon2.mjs` | 画面异常光斑的来源（逐组隐藏二分定位） |
| `probe-terrain.mjs` / `probe-river.mjs` | 地形高度与河道采样 |
| `probe-shrine*.mjs` | 神社、鸟居的局部/世界坐标对齐 |
| `probe-front.mjs` / `probe-grid.mjs` / `probe-proj*.mjs` | 屏幕网格、投影校验 |
| `probe-picnic2.mjs` / `probe-spot.mjs` | 人物落点与坡度 |
| `probe[0-9].mjs` / `dbg-*.mjs` | 早期编号脚本，历史遗留，可直接删 |
| `zoom-*.mjs` / `shot-file/dpr/hour/life/widget.mjs` | 不同参数组合的取景与尺寸验证 |

这些脚本写得很快、很具体，复用价值不高，但**方法论值得保留**：

1. **投影**——世界坐标 → 屏幕像素，肉眼估位置一定会偏；
2. **射线**——判断"看不见"是位置问题还是遮挡问题；
3. **二分隐藏**——逐组隐藏后截图对比，三步定位异常对象；
4. **同帧操作**——投影、冻结旋转、截图必须在同一帧，否则标注和画面会错开。

详见 [开发文档 · 第七节](../docs/DEVELOPMENT.md#七出图与验证)。
