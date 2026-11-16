/**
 * 觸控目標補到 ≥44px（UX-19）：外觀不變，用 ::before 往外撐點擊範圍。
 * 按鈕本身要能當定位基準（relative 已含在內）。
 */

/** 外觀 36px 高 → 上下各撐 4px */
export const HIT_Y4 = "relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']";
/** 外觀 32px 高 → 上下各撐 6px */
export const HIT_Y6 = "relative before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']";
