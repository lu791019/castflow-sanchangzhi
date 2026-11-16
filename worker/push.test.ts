import { describe, expect, it, vi } from "vitest";
import { createPushSender, type SendNotificationFn } from "./push.ts";

const VAPID = { publicKey: "pub", privateKey: "priv", subject: "mailto:a@b.test" };
const SUB = { endpoint: "https://push.example/s", keys: { p256dh: "p", auth: "a" }, userId: "user-a" };
const PAYLOAD = { title: "昨晚的《海街日記》", body: "b", url: "/say?journal=j", tag: "t" };

function webPushError(statusCode: number, body = ""): Error {
  return Object.assign(new Error("Received unexpected response code"), { statusCode, body });
}

describe("createPushSender", () => {
  it("成功：帶 VAPID 與 JSON payload", async () => {
    const send = vi.fn(async () => ({ statusCode: 201, body: "", headers: {} }));
    const result = await createPushSender(VAPID, send as unknown as SendNotificationFn)(SUB, PAYLOAD);
    expect(result).toEqual({ ok: true });
    // 只把 endpoint 與 keys 交給 web-push，不外帶 userId
    expect(send).toHaveBeenCalledWith(
      { endpoint: SUB.endpoint, keys: SUB.keys },
      JSON.stringify(PAYLOAD),
      expect.objectContaining({
        vapidDetails: { subject: VAPID.subject, publicKey: "pub", privateKey: "priv" },
      }),
    );
  });

  it.each([404, 410])("%i → gone", async (status) => {
    const send = vi.fn(async () => Promise.reject(webPushError(status)));
    const result = await createPushSender(VAPID, send as unknown as SendNotificationFn)(SUB, PAYLOAD);
    expect(result).toMatchObject({ ok: false, gone: true });
  });

  it("500 → 非 gone，訊息含狀態與 body", async () => {
    const send = vi.fn(async () => Promise.reject(webPushError(500, "server sad")));
    const result = await createPushSender(VAPID, send as unknown as SendNotificationFn)(SUB, PAYLOAD);
    expect(result).toMatchObject({ ok: false, gone: false });
    if (!result.ok) expect(result.message).toContain("500");
    if (!result.ok) expect(result.message).toContain("server sad");
  });

  it("網路錯誤 → 非 gone", async () => {
    const send = vi.fn(async () => Promise.reject(new Error("ENOTFOUND")));
    const result = await createPushSender(VAPID, send as unknown as SendNotificationFn)(SUB, PAYLOAD);
    expect(result).toMatchObject({ ok: false, gone: false });
    if (!result.ok) expect(result.message).toContain("network");
  });
});
