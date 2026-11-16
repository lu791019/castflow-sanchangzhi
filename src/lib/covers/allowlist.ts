/**
 * 封面來源白名單（Q-46，純函式）：讀者貼的封面網址，原址與每一跳轉址都在白名單網域 → 直接通過並補空的 poster_url；
 * 白名單外 → 待審＋警報。上傳的檔案內容無法自動判斷 → 一律待審。
 * 自家 `covers` 桶不在這裡判斷：貼回自家桶網址的一律視為上傳（source=upload）。
 */

export type CoverSource = "upload" | "url";
export type CoverReviewStatus = "approved" | "pending";

/** 常見的作品圖來源：片商資料庫、Podcast 圖庫、維基共享、售票站、美術館官網 */
export const COVER_SOURCE_DOMAINS: readonly string[] = [
  "tmdb.org", // TMDB 圖庫 image.tmdb.org
  "themoviedb.org",
  "mzstatic.com", // Apple Podcasts／iTunes 封面
  "wikimedia.org", // 維基共享 upload.wikimedia.org
  "kktix.com",
  "kktix.io", // KKTIX 活動圖 assets.kktix.io
  "opentix.life",
  "tfam.museum", // 臺北市立美術館
  "kmfa.gov.tw", // 高雄市立美術館
  "ntmofa.gov.tw", // 國立臺灣美術館
  "mocataipei.org.tw", // 台北當代藝術館
  "npm.gov.tw", // 國立故宮博物院
  // 館方展覽來源（散場之前的展覽海報）
  "nmns.edu.tw", // 國立自然科學博物館（散場之前不用它的圖：CORP same-site 別站嵌不了；讀者貼網址仍算可信來源）
  "nmmba.gov.tw", // 國立海洋生物博物館 ws.nmmba.gov.tw
  "songshanculturalpark.org", // 松山文創園區
  "nstm.gov.tw", // 國立科學工藝博物館
  "tnam.museum", // 臺南市美術館
  "ntm.gov.tw", // 國立臺灣博物館
  "nmh.gov.tw", // 國立歷史博物館
  "cksmh.gov.tw", // 中正紀念堂
  "event.culture.tw", // 文化部活動報名系統（臺博、史博、中正紀念堂的展覽圖）
  "clab.org.tw", // 臺灣當代文化實驗場 cms.clab.org.tw
  "kdmofa.tnua.edu.tw", // 關渡美術館
];

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isAllowlistedCoverHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized) return false;
  return COVER_SOURCE_DOMAINS.some((domain) => matchesDomain(normalized, domain));
}

/** hosts：貼的網址主機名＋每一跳轉址的主機名；任何一個在白名單外就待審 */
export function decideCoverStatus(input: { source: CoverSource; hosts: readonly string[] }): CoverReviewStatus {
  if (input.source === "upload") return "pending";
  if (input.hosts.length === 0) return "pending";
  return input.hosts.every(isAllowlistedCoverHost) ? "approved" : "pending";
}
