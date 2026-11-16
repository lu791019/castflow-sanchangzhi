/**
 * 同一部作品 2 小時內再記一次（UX-26，純函式）：sheet 第一次送出帶 checkRepeat，
 * server 查到 2 小時內記過就回 409；sheet 內確認後不帶 checkRepeat 再送一次。
 * 以「記下的時間」（created_at）算，看過與排行程分開比；只有 sheet 會要求檢查，其他 API 呼叫（種資料、場外歸檔）照舊。
 */

export const REPEAT_WINDOW_MS = 2 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export function repeatSince(now: Date): Date {
  return new Date(now.getTime() - REPEAT_WINDOW_MS);
}

export function wantsRepeatCheck(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && (body as Record<string, unknown>).checkRepeat === true);
}

function agoLabel(loggedAt: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - loggedAt.getTime());
  if (elapsed < MINUTE_MS) return "剛剛";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} 分鐘前`;
  return `${Math.floor(elapsed / HOUR_MS)} 小時前`;
}

export interface RepeatPromptInput {
  title: string;
  /** 場外手寫：用「」 */
  live: boolean;
  loggedAt: Date;
  now: Date;
}

export function repeatPrompt({ title, live, loggedAt, now }: RepeatPromptInput): string {
  const name = live ? `「${title}」` : `《${title}》`;
  return `${agoLabel(loggedAt, now)}記過${name}了，要再記一筆嗎？`;
}
