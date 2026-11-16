/** 搜尋字串規則：正規化、2 字門檻、過期回應序號、命中高亮切段（純邏輯） */

export const MIN_QUERY_LENGTH = 2;
export const QUERY_MAX_LENGTH = 100;
/** 輸入後等這麼久沒再打字才送出 */
export const SEARCH_DEBOUNCE_MS = 300;

export type QueryGate = "empty" | "too_short" | "ok";

/** 去頭尾空白、壓縮連續空白、截到上限；非字串視為空 */
export function normalizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return Array.from(collapsed).slice(0, QUERY_MAX_LENGTH).join("");
}

/** 空 → empty；不足 2 個 code point → too_short；否則 ok */
export function queryGate(query: string): QueryGate {
  const normalized = normalizeQuery(query);
  if (!normalized) return "empty";
  return Array.from(normalized).length < MIN_QUERY_LENGTH ? "too_short" : "ok";
}

export interface Sequencer {
  /** 取下一個序號（每次發請求前呼叫） */
  next: () => number;
  /** 回應回來時確認仍是最新一筆，否則丟棄 */
  isLatest: (id: number) => boolean;
  /** 讓所有在途請求失效（查詢清空／切 tab） */
  invalidate: () => void;
}

/** 請求序號：舊回應晚到不能蓋掉新結果 */
export function createSequencer(): Sequencer {
  let current = 0;
  let valid = false;
  return {
    next: () => {
      current += 1;
      valid = true;
      return current;
    },
    isLatest: (id) => valid && id === current,
    invalidate: () => {
      valid = false;
    },
  };
}

export interface HighlightSegment {
  text: string;
  hit: boolean;
}

/** 把標題切成命中／未命中片段（大小寫不敏感、只標第一個命中） */
export function splitHighlight(title: string, query: string): HighlightSegment[] {
  const needle = normalizeQuery(query);
  if (!needle) return [{ text: title, hit: false }];
  const index = title.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (index < 0) return [{ text: title, hit: false }];
  const before = title.slice(0, index);
  const matched = title.slice(index, index + needle.length);
  const after = title.slice(index + needle.length);
  return [
    ...(before ? [{ text: before, hit: false }] : []),
    { text: matched, hit: true },
    ...(after ? [{ text: after, hit: false }] : []),
  ];
}
