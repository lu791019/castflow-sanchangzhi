import { describe, expect, it } from "vitest";
import { parseCreateJournalInput, parsePushSubscription, parseRating } from "./validate";

const NOW = new Date("2026-10-09T15:00:00Z");
const WORK_ID = "11111111-1111-1111-1111-111111111111";

describe("parseCreateJournalInput", () => {
  it("只記名稱 + 預設 venue other", () => {
    const result = parseCreateJournalInput(
      { workTitle: "  海街日記 ", experiencedAt: "2026-10-07T13:00:00Z" },
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        workId: null,
        workTitle: "海街日記",
        experiencedAt: new Date("2026-10-07T13:00:00Z"),
        venue: "other",
        companions: null,
        rating: null,
        status: "recorded",
      },
    });
  });

  it("看過可以打星（含半顆）", () => {
    const result = parseCreateJournalInput({ workTitle: "a", experiencedAt: "2026-10-07T13:00:00Z", rating: 4.5 }, NOW);
    expect(result.ok && result.value.rating).toBe(4.5);
  });

  it("排行程不能打星", () => {
    const result = parseCreateJournalInput({ workTitle: "a", experiencedAt: "2026-10-20T13:00:00Z", rating: 4 }, NOW);
    expect(result).toEqual({ ok: false, error: "還沒看的場次不能打星" });
  });

  it("帶作品 id、場域、同行者", () => {
    const result = parseCreateJournalInput(
      { workId: WORK_ID, experiencedAt: "2026-10-07T13:00:00Z", venue: "cinema", companions: "小安" },
      NOW,
    );
    expect(result.ok && result.value).toMatchObject({ workId: WORK_ID, venue: "cinema", companions: "小安" });
  });

  it.each([
    ["非物件", null, "JSON"],
    ["無作品也無名稱", { experiencedAt: "2026-10-07T13:00:00Z" }, "至少"],
    ["空白名稱", { workTitle: "  ", experiencedAt: "2026-10-07T13:00:00Z" }, "至少"],
    ["workId 非 uuid", { workId: "x", experiencedAt: "2026-10-07T13:00:00Z" }, "workId"],
    ["缺時間", { workTitle: "a" }, "experiencedAt"],
    ["壞時間", { workTitle: "a", experiencedAt: "nope" }, "有效"],
    ["排太遠（超過一年）", { workTitle: "a", experiencedAt: "2027-10-10T00:00:00Z" }, "365"],
    ["venue 不合法", { workTitle: "a", experiencedAt: "2026-10-07T13:00:00Z", venue: "moon" }, "venue"],
    ["名稱過長", { workTitle: "長".repeat(201), experiencedAt: "2026-10-07T13:00:00Z" }, "200"],
    ["同行者非文字", { workTitle: "a", experiencedAt: "2026-10-07T13:00:00Z", companions: 3 }, "companions"],
  ])("%s → 錯誤", (_label, body, fragment) => {
    const result = parseCreateJournalInput(body, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(fragment);
  });

  it("未來時間 → 計畫中（排行程）；過去或 10 分鐘內 → recorded", () => {
    const planned = parseCreateJournalInput({ workTitle: "a", experiencedAt: "2026-10-10T00:00:00Z" }, NOW);
    expect(planned.ok && planned.value.status).toBe("planned");
    const recorded = parseCreateJournalInput({ workTitle: "a", experiencedAt: "2026-10-07T13:00:00Z" }, NOW);
    expect(recorded.ok && recorded.value.status).toBe("recorded");
  });

  it("容許 10 分鐘內的時鐘誤差", () => {
    expect(
      parseCreateJournalInput({ workTitle: "a", experiencedAt: "2026-10-09T15:05:00Z" }, NOW).ok,
    ).toBe(true);
  });
});

describe("parsePushSubscription", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    keys: { p256dh: "BPkey", auth: "authkey" },
  };

  it("合法訂閱", () => {
    expect(parsePushSubscription(valid, "UA")).toEqual({
      ok: true,
      value: { ...valid, userAgent: "UA" },
    });
  });

  it.each([
    ["非 https", { ...valid, endpoint: "http://x.test/a" }],
    ["壞網址", { ...valid, endpoint: "not a url" }],
    ["缺 keys", { endpoint: valid.endpoint }],
    ["缺 auth", { ...valid, keys: { p256dh: "a" } }],
    ["null", null],
  ])("%s → 錯誤", (_label, body) => {
    expect(parsePushSubscription(body, null).ok).toBe(false);
  });
});

describe("parseRating", () => {
  it.each([[undefined, null], [null, null], [0.5, 0.5], [3, 3], [5, 5]])("%s → %s", (input, expected) => {
    expect(parseRating(input)).toEqual({ ok: true, value: expected });
  });

  it.each([[0], [5.5], [4.3], [-1], ["4"], [Number.NaN], [Number.POSITIVE_INFINITY]])("拒絕 %s", (input) => {
    expect(parseRating(input).ok).toBe(false);
  });
});
