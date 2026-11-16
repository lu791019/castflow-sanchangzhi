/**
 * 編輯檯「改時間」：快捷時段、自己選的時間解析與鎖定規則（台北時間）。
 * schedule.lock：發佈前 10 分鐘鎖定，不能再改時間或取消（worker 可能已在發）。
 */

import { fromTaipei, pad2, taipeiParts, MINUTE_MS, DAY_MS } from "@/lib/journal/time";

export const SCHEDULE_LOCK_MINUTES = 10;
export const SCHEDULE_MAX_DAYS = 90;

export interface ScheduleSlot {
  label: string;
  iso: string;
}

function dayOffset(now: Date, days: number, hour: number): Date {
  const { year, month, day } = taipeiParts(now);
  return fromTaipei(year, month, day + days, hour, 0);
}

export function isScheduleLocked(scheduledAt: string, now: Date): boolean {
  return Date.parse(scheduledAt) - now.getTime() < SCHEDULE_LOCK_MINUTES * MINUTE_MS;
}

/** 新時間要在鎖定線之後、90 天內 */
export function validateReschedule(iso: string, now: Date): { ok: true; iso: string } | { ok: false; error: string } {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return { ok: false, error: "時間格式不對" };
  if (time - now.getTime() < SCHEDULE_LOCK_MINUTES * MINUTE_MS) {
    return { ok: false, error: `至少要在 ${SCHEDULE_LOCK_MINUTES} 分鐘之後` };
  }
  if (time - now.getTime() > SCHEDULE_MAX_DAYS * DAY_MS) {
    return { ok: false, error: `最多排到 ${SCHEDULE_MAX_DAYS} 天後` };
  }
  return { ok: true, iso: new Date(time).toISOString() };
}

/** 快捷時段：今晚 21:00（還來得及才給）、明天 早上 8:00、後天 早上 9:00 */
export function rescheduleSlots(now: Date): ScheduleSlot[] {
  const tonight = dayOffset(now, 0, 21);
  const tomorrow = dayOffset(now, 1, 8);
  const later = dayOffset(now, 2, 9);
  const laterParts = taipeiParts(later);
  const slots: Array<ScheduleSlot | null> = [
    validateReschedule(tonight.toISOString(), now).ok ? { label: "今晚 21:00", iso: tonight.toISOString() } : null,
    { label: "明天 早上 8:00", iso: tomorrow.toISOString() },
    { label: `${pad2(laterParts.month)}.${pad2(laterParts.day)} 早上 9:00`, iso: later.toISOString() },
  ];
  return slots.filter((slot): slot is ScheduleSlot => slot !== null);
}

/** <input type="datetime-local"> 的值（視為台北時間）→ ISO；格式不符回 null */
export function parseTaipeiLocal(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  return fromTaipei(y, mo, d, h, mi).toISOString();
}

/** ISO → datetime-local 值（台北） */
export function toTaipeiLocal(iso: string): string {
  const parts = taipeiParts(new Date(iso));
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}
