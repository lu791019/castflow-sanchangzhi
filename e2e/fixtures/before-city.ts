/**
 * 散場之前的出門類活動（演出、展覽）在雲端有大量真資料（臺北、高雄每月上百場），測試種的卡會被照日期擠出上限。
 * 不動真資料：測試把自己的活動放在真資料很少的縣市，先替測試帳號選好那個縣市，只在那裡找自己的卡。
 * 10/15 雲端未來 38 天：澎湖縣演出 2、展覽 0；金門縣演出 1、展覽 0；花蓮縣演出 4、展覽 0（上限是演出 16、展覽 10）。
 * 真資料變多到擠掉測試卡時，換一個更冷門的縣市。
 */

import { expect, type Page } from "@playwright/test";

export const QUIET_CITY = { name: "澎湖縣", short: "澎湖", address: "澎湖縣馬公市治平路1號" } as const;
export const QUIET_CITY_B = { name: "金門縣", short: "金門", address: "金門縣金城鎮民生路1號" } as const;
export const QUIET_CITY_C = { name: "花蓮縣", short: "花蓮", address: "花蓮縣花蓮市中山路1號" } as const;

/** 已登入的 page：替這個帳號存「在哪個縣市」（null＝全部縣市），之後打開散場之前就只看該縣市 */
export async function saveBeforeCity(page: Page, city: string | null): Promise<void> {
  const response = await page.request.post("/api/before/city", { data: { city } });
  expect(response.status(), "存縣市 /api/before/city").toBe(200);
}
