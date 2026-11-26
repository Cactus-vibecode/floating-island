// ============================================================
// 四季漂浮岛 · 自动更迭配置
// 所有「什么时候切到哪个季节 / 哪个时段」的规则集中在这里，改这个文件即可，
// 不需要动渲染代码。
// ============================================================

export const CONFIG = {
  // ---------- 季节（公历月份 → 季节下标 0 春 / 1 夏 / 2 秋 / 3 冬）----------
  // 数组下标 0 对应 1 月，以此类推；默认：3–5 春、6–8 夏、9–11 秋、12–2 冬
  monthSeason: [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3],

  // 自定义日期段优先（可按节气/本地习惯覆盖上面的月份表）
  // from / to 用 'MM-DD'，支持跨年（如 '12-01' → '02-28'）
  seasonOverrides: [
    // { from: '02-04', to: '05-05', season: 0 }, // 例：立春 → 立夏 都算春
  ],

  // ---------- 时段（24 小时制，可跨零点）----------
  periods: {
    morning: { from: 6, to: 11 },
    noon: { from: 11, to: 17 },
    night: { from: 17, to: 6 },
    falloff: 0.6, // 边界前后各 0.6 小时做渐变
  },

  // ---------- 更迭节奏 ----------
  clockMs: 20 * 1000, // 每 20 秒重新读一次系统时间（时段渐变约 36 分钟，够细了）
  pollMs: 5 * 60 * 1000, // 每 5 分钟检查一次日期是否跨季
  transitionSec: 1.4, // 季节切换的交叉过渡时长（秒）
};

const md = (s) => {
  const [m, d] = String(s).split('-').map(Number);
  return (m || 1) * 100 + (d || 1);
};

/** 当前日期 → 季节下标（0 春 / 1 夏 / 2 秋 / 3 冬） */
export function seasonFromDate(date = new Date()) {
  const key = (date.getMonth() + 1) * 100 + date.getDate();
  for (const o of CONFIG.seasonOverrides) {
    const a = md(o.from), b = md(o.to);
    const hit = a <= b ? key >= a && key <= b : key >= a || key <= b;
    if (hit) return ((o.season % 4) + 4) % 4;
  }
  return CONFIG.monthSeason[(date.getMonth() + 12) % 12];
}
