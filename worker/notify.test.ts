import { describe, expect, it, vi } from "vitest";
import { createNotifier, type NotifierOptions } from "./notify.ts";

function okResponse(): Response {
  return new Response("{}", { status: 200 });
}

function mockFetch(responder: () => Response) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    responder(),
  );
}

function setup(overrides: Partial<NotifierOptions> = {}) {
  const appendFn = vi.fn(async (_filePath: string, _line: string) => {});
  const logFn = vi.fn();
  const fetchFn = mockFetch(okResponse);
  const notify = createNotifier({
    alertLogPath: "/tmp/alerts.log",
    appendFn,
    logFn,
    fetchFn: fetchFn as unknown as typeof fetch,
    ...overrides,
  });
  return { notify, appendFn, logFn, fetchFn };
}

describe("createNotifier", () => {
  it("永遠寫 console 與警報檔（JSON line）", async () => {
    const { notify, appendFn, logFn } = setup();
    const alert = await notify("info", "worker 啟動", "測試");
    expect(logFn).toHaveBeenCalledOnce();
    expect(appendFn).toHaveBeenCalledWith(
      "/tmp/alerts.log",
      `${JSON.stringify(alert)}\n`,
    );
  });

  it("info 不外推；warn 在 webhook 設定時外推", async () => {
    const { notify, fetchFn } = setup({ webhookUrl: "https://hook.example/x" });
    await notify("info", "一般訊息");
    expect(fetchFn).not.toHaveBeenCalled();
    await notify("warn", "mlx 轉錄失敗，降級改走 Groq", "細節");
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[0][0]).toBe("https://hook.example/x");
  });

  it("LINE token + to 齊備時推 LINE push", async () => {
    const { notify, fetchFn } = setup({ lineToken: "tok", lineTo: "Uxxx" });
    await notify("error", "轉錄全數失敗");
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api.line.me/v2/bot/message/push");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const body = JSON.parse(init?.body as string) as { to: string };
    expect(body.to).toBe("Uxxx");
  });

  it("同 level+title 在節流窗內只外推一次，仍照寫檔", async () => {
    let currentMs = 0;
    const { notify, fetchFn, appendFn } = setup({
      webhookUrl: "https://hook.example/x",
      throttleMs: 60_000,
      now: () => new Date(currentMs),
    });
    await notify("warn", "重複警報");
    currentMs = 30_000;
    await notify("warn", "重複警報");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(appendFn).toHaveBeenCalledTimes(2);
    currentMs = 61_000;
    await notify("warn", "重複警報");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("外推失敗不拋出，改記一筆外推失敗警報", async () => {
    const fetchFn = mockFetch(() => new Response("err", { status: 500 }));
    const { notify, appendFn } = setup({
      webhookUrl: "https://hook.example/x",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(notify("error", "原始警報")).resolves.toBeTruthy();
    const lines = appendFn.mock.calls.map((call) => call[1]);
    expect(lines.some((line) => line.includes("警報外推失敗"))).toBe(true);
  });

  it("Discord webhook 送 { content }（Discord 不吃原始 JSON）", async () => {
    const { notify, fetchFn } = setup({ webhookUrl: "https://discord.com/api/webhooks/1/abc" });
    await notify("warn", "來信被檢舉", "letter=1");
    const body = JSON.parse(String(fetchFn.mock.calls[0][1]?.body));
    expect(body).toEqual({ content: expect.stringContaining("來信被檢舉 — letter=1") });
  });

  it("Slack webhook 送 { text }", async () => {
    const { notify, fetchFn } = setup({ webhookUrl: "https://hooks.slack.com/services/x" });
    await notify("error", "轉錄失敗");
    const body = JSON.parse(String(fetchFn.mock.calls[0][1]?.body));
    expect(body).toEqual({ text: expect.stringContaining("轉錄失敗") });
  });

  it("沒有任何外推管道時，第一筆 warn/error 大聲記一次「警報送不出去」（降級不靜默）", async () => {
    const { notify, logFn, fetchFn } = setup();
    await notify("warn", "A");
    await notify("error", "B");
    const loud = logFn.mock.calls.filter(([line]) => String(line).includes("沒有設定警報外推管道"));
    expect(loud).toHaveLength(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

