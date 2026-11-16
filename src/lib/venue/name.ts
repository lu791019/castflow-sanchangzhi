/**
 * 場外名稱（純函式）：沒有外部資料源，演出名／展覽名都是手寫，
 * 比對前先做機械正規化（不做繁簡轉換、不猜錯字）。
 */

const MAX_KEY_LENGTH = 200;
const PLATE_MAX = 6;
/** 英文字橫躺約半字寬：字卡開頭是英文字時整個字留著（最多 14 字母），不從字中間切（UX-25） */
const LATIN_PLATE_MAX = 14;
const LEADING_LATIN_WORD = /^[A-Za-z0-9À-ɏ'’&.!?-]+/;
/** 標點、符號、空白一律拿掉：「島嶼夜歌・草地音樂會」＝「島嶼夜歌 草地音樂會」＝「「島嶼夜歌」草地音樂會！」 */
const NOISE = /[\p{P}\p{S}\p{Z}\s]/gu;
const TITLE_BREAKS = ["・", "‧", "·"];

/** NFKC（全形英數 → 半形）→ 小寫 → 去標點符號空白 */
export function normalizeLiveName(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(NOISE, "");
}

/** works.live_key：正規化後最多 200 字；正規化完是空的回 null（不可比對） */
export function liveKey(name: string): string | null {
  const key = Array.from(normalizeLiveName(name)).slice(0, MAX_KEY_LENGTH).join("");
  return key || null;
}

export interface ProgrammeTitle {
  /** 明體 30 的兩行（第一行保留「・」） */
  lines: string[];
  /** 直排字卡的字：分隔前那段，最多六字 */
  plate: string;
}

const TRAILING_LATIN_WORD = /[A-Za-z0-9À-ɏ'’&.!?-]+$/;

function plateOf(head: string): string {
  const latin = head.match(LEADING_LATIN_WORD)?.[0];
  if (latin && latin.length > 1) return latin.slice(0, LATIN_PLATE_MAX);
  const chars = Array.from(head);
  const plate = chars.slice(0, PLATE_MAX).join("");
  // 六字剛好切在英文字中間：那個英文字整個不放
  const cutWord = chars.length > PLATE_MAX && TRAILING_LATIN_WORD.test(plate) && LEADING_LATIN_WORD.test(chars[PLATE_MAX]);
  return cutWord ? plate.replace(TRAILING_LATIN_WORD, "") || plate : plate;
}

function firstBreak(title: string): { index: number; mark: string } | null {
  const marks = [...TITLE_BREAKS, " "]
    .map((mark) => ({ index: title.indexOf(mark), mark }))
    .filter(({ index }) => index > 0 && index < title.length - 1);
  if (marks.length === 0) return null;
  return marks.reduce((first, next) => (next.index < first.index ? next : first));
}

/** 場刊標題斷行：「島嶼夜歌・草地音樂會」→「島嶼夜歌・／草地音樂會」，字卡「島嶼夜歌」 */
export function splitProgrammeTitle(rawTitle: string): ProgrammeTitle {
  const title = rawTitle.trim();
  const cut = firstBreak(title);
  if (!cut) {
    return { lines: [title], plate: plateOf(title) };
  }
  const head = title.slice(0, cut.index);
  const tail = title.slice(cut.index + cut.mark.length).trim();
  const first = cut.mark === " " ? head : `${head}${cut.mark}`;
  return { lines: [first, tail], plate: plateOf(head) };
}
