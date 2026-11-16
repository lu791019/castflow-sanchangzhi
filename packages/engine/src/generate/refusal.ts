/**
 * 生成拒絕標記：原話太短、聽不清楚時，模型依 prompt 只輸出「【無法生成】＋原因」。
 * parser 綁這個格式標記（不猜內容），帶標記的結果一律視為失敗，不得寫成正文。
 */

export const REFUSAL_MARKER = "【無法生成】";

/** 寫進 prompt 的約定（標記只在這裡定義） */
export const REFUSAL_INSTRUCTION = `## 原話不足時
如果逐字稿太短、聽不清楚，或沒有可以整理的感受，不要編造內容：每個欄位都只輸出「${REFUSAL_MARKER}」加一句原因。`;

export function isRefusal(text: string | null | undefined): boolean {
  return Boolean(text && text.includes(REFUSAL_MARKER));
}

/** 第一個帶拒絕標記的平台；都沒有回 null */
export function findRefusal(results: Readonly<Record<string, string>>): string | null {
  return Object.keys(results).find((platform) => isRefusal(results[platform])) ?? null;
}

const EXCERPT_LENGTH = 120;

export class GenerationRefusedError extends Error {
  readonly platform: string;
  readonly excerpt: string;

  constructor(platform: string, text: string) {
    super("原話不足，AI 沒有整理出文章");
    this.name = "GenerationRefusedError";
    this.platform = platform;
    this.excerpt = text.slice(0, EXCERPT_LENGTH);
  }
}
