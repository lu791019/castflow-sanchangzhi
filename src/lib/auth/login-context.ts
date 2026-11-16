/** 登入頁依「從哪裡來」補一句情境說明（先填後登入的流程，讓人知道內容不會丟） */

const NOTES: ReadonlyArray<{ pattern: RegExp; note: string }> = [
  { pattern: /^\/journal\/new\?(?:.*&)?resume=1(?:&|$)/, note: "剛剛記一筆填的會先留著，登入後接著記。" },
  { pattern: /^\/say\?(?:.*&)?resume=1(?:&|$)/, note: "剛剛說的、寫的會先留著，登入後接著整理。" },
];

export function loginContextNote(next: string): string | null {
  return NOTES.find(({ pattern }) => pattern.test(next))?.note ?? null;
}
