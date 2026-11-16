/**
 * 時間長度：解析 RSS itunes:duration、格式化播放時間與長度標籤。
 * RSS 實測格式混用（data-feasibility.md 第三節）：股癌/Lenny/百靈果給秒數 `3044`，
 * 通勤/The Daily 給 `00:52:29`；也有 `52:29`（分:秒）→ 兩種都要吃。
 */

const CLOCK_PATTERN = /^\d+(?::\d{1,2}){1,2}(?:\.\d+)?$/;
const SECONDS_PATTERN = /^\d+(?:\.\d+)?$/;

/** `3044` / `3044.5` / `52:29` / `00:52:29` / `1:02:03` → 秒數（取整）；無法解析回 null */
export function parseDuration(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
  }
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  if (SECONDS_PATTERN.test(value)) {
    const seconds = Math.floor(Number(value));
    return seconds > 0 ? seconds : null;
  }
  if (!CLOCK_PATTERN.test(value)) return null;

  const parts = value.split(":").map(Number);
  const [last] = parts.slice(-1);
  // 分、秒欄位不得 ≥ 60（時:分:秒 的分，以及最後的秒）
  if (last >= 60 || (parts.length === 3 && parts[1] >= 60)) return null;
  const seconds = Math.floor(parts.reduce((total, part) => total * 60 + part, 0));
  return seconds > 0 ? seconds : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 播放器時間：未滿 1 小時 `11:51`，超過 `1:02:03`；負數/非數字視為 0 */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours > 0
    ? `${hours}:${pad2(minutes)}:${pad2(seconds)}`
    : `${pad2(minutes)}:${pad2(seconds)}`;
}

/** 頁首長度標籤：`48 分 12 秒`、`1 小時 2 分`、`2 分`、`45 秒` */
export function formatDurationLabel(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return minutes > 0 ? `${hours} 小時 ${minutes} 分` : `${hours} 小時`;
  if (minutes > 0) return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`;
  return `${seconds} 秒`;
}

/** 章節長度：四捨五入到分鐘，不足 1 分顯示「1 分內」 */
export function formatChapterLength(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes >= 1 ? `${minutes} 分` : "1 分內";
}
