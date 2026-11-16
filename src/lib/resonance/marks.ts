/**
 * 句邊共鳴記號四態（P3 元件特寫 02）：
 * a 未標＝不畫；b 只有你＝燒橙 2px、不寫數字；c 他人＝ink-300 1px＋人數；d 兩者＝燒橙 2px＋粗體人數（含你）。
 * 讀螢幕名稱照 04 規格。
 */

export type MarkState = "none" | "mine" | "others" | "both";

export interface PassageMark {
  /** 這段的總人數（含你） */
  count: number;
  mine: boolean;
}

export interface PassageMarkView {
  state: MarkState;
  /** 句邊直排人數；只有你或沒有人時為空字串 */
  numeral: string;
  /** 段尾隱形按鈕的讀螢幕名稱 */
  buttonLabel: string;
  /** 浮層按鈕的字 */
  actionLabel: "這句我也是" | "收回記號";
}

export function passageMarkView({ count, mine }: PassageMark): PassageMarkView {
  const total = mine ? Math.max(1, count) : Math.max(0, count);
  if (mine) {
    return {
      state: total > 1 ? "both" : "mine",
      numeral: total > 1 ? String(total) : "",
      buttonLabel: `你已在這段留下記號，共 ${total} 人。點一下可收回`,
      actionLabel: "收回記號",
    };
  }
  if (total === 0) {
    return { state: "none", numeral: "", buttonLabel: "這句我也是", actionLabel: "這句我也是" };
  }
  const numeral = String(total);
  return { state: "others", numeral, buttonLabel: `這句我也是（已有 ${numeral} 人）`, actionLabel: "這句我也是" };
}

/** 標記／收回後的新狀態（樂觀更新用） */
export function toggleMark(mark: PassageMark): PassageMark {
  return mark.mine
    ? { count: Math.max(0, mark.count - 1), mine: false }
    : { count: Math.max(0, mark.count) + 1, mine: true };
}
