/** RSS ingest 分層錯誤：fetch 失敗 / 非 XML / 非 RSS / 無 enclosure / 重複訂閱 分開回報 */
export type RssErrorCode =
  | "fetch_failed"
  | "invalid_xml"
  | "not_rss"
  | "no_enclosure"
  | "already_subscribed";

export class RssIngestError extends Error {
  readonly code: RssErrorCode;

  constructor(code: RssErrorCode, message: string) {
    super(message);
    this.name = "RssIngestError";
    this.code = code;
  }
}

/** 各錯誤碼對應的 HTTP status（route 層共用） */
export const RSS_ERROR_STATUS: Record<RssErrorCode, number> = {
  fetch_failed: 502,
  invalid_xml: 422,
  not_rss: 422,
  no_enclosure: 422,
  already_subscribed: 409,
};
