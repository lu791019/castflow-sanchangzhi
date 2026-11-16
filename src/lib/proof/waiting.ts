/**
 * 校樣頁等待／錯誤態的純邏輯（設計稿 P2 等待 5、錯誤 1–2）。
 * transcribe.long：預估超過 2 分鐘才顯示「大約還要 n 分鐘」與「先關掉」。
 * 轉錄速度是估計值（本機 mlx 約 0.3 倍錄音長度，Groq 更快）；寧可說久一點，不要說短了。
 */

export const TRANSCRIBE_RATE = 0.3;
export const LONG_TRANSCRIBE_MINUTES = 2;

/** 剩幾分鐘（無條件進位，至少 1）；不知道錄音長度回 null */
export function estimateRemainingMinutes(
  durationSeconds: number | null,
  elapsedSeconds: number,
  rate = TRANSCRIBE_RATE,
): number | null {
  if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const remaining = durationSeconds * rate - Math.max(0, elapsedSeconds);
  return Math.max(1, Math.ceil(remaining / 60));
}

export function isLongTranscription(remainingMinutes: number | null): boolean {
  return remainingMinutes !== null && remainingMinutes > LONG_TRANSCRIBE_MINUTES;
}

/** 播放器式長度：92 → 1:32、3725 → 1:02:05；未知回 null */
export function formatClock(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** 「約 380 字」：以 code point 計，去掉空白；十位以上取整到十 */
export function approxCharCount(text: string): string {
  const count = Array.from(text.replace(/\s+/g, "")).length;
  return `約 ${count >= 100 ? Math.round(count / 10) * 10 : count} 字`;
}

/** 稿紙逐格寫字：取逐字稿開頭 n 個字（去換行）；沒有逐字稿回空陣列 */
export function manuscriptCells(text: string, max: number): string[] {
  return Array.from(text.replace(/\s+/g, "")).slice(0, max);
}
