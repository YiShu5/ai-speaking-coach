// 通用工具函数

// 格式化秒为 MM:SS
export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

// 中文星期
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
export function weekdayOf(dateStr: string): string {
  const d = new Date(dateStr);
  return WEEKDAYS[d.getDay()];
}

// 日期格式化 M/D
export function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 生成简单 ID
export function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// 延时
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// 限制范围
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
