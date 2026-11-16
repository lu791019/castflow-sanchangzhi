/**
 * 校樣頁的「整理失敗」判斷（UX-02）：既有草稿的正文若是模型拒絕訊息（【無法生成】），
 * 不當成可編輯、可發佈的校樣，改顯示整理失敗。原話太短就請他再說一次或改用打的。
 */

import { isRefusal } from "@castflow/engine/generate/refusal";
import { isTooShortToGenerate } from "@/lib/say/meaningful";

export type GenerateFailReason = "too_short" | "refused";

export function contentFailure(body: string, transcript: string | null): GenerateFailReason | null {
  if (!isRefusal(body)) return null;
  return isTooShortToGenerate(transcript) ? "too_short" : "refused";
}
