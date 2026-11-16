/**
 * 品味問卷要問哪幾題（純函式，Q-63）：原本 3 題（媒介、在家／出門、挑 3 部）；
 * ①勾了演出或展覽才問④常在哪個縣市，勾了演出才問⑤演出想看哪種。沒勾的人跟以前一樣只有 3 題。
 */

import type { MediaKey } from "./types";

export type TasteStep = "media" | "setting" | "picks" | "city" | "live";

const BASE_STEPS: readonly TasteStep[] = ["media", "setting", "picks"];

export function asksCity(media: readonly MediaKey[]): boolean {
  return media.includes("live") || media.includes("exhibition");
}

export function asksLiveKinds(media: readonly MediaKey[]): boolean {
  return media.includes("live");
}

export function tasteSteps(media: readonly MediaKey[]): TasteStep[] {
  return [...BASE_STEPS, ...(asksCity(media) ? (["city"] as const) : []), ...(asksLiveKinds(media) ? (["live"] as const) : [])];
}
