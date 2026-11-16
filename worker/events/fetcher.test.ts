import { describe, expect, it } from "vitest";
import { createPoliteFetcher, EVENTS_USER_AGENT, siteOf } from "./fetcher.ts";

function fakeClock() {
  let time = 0;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
    advance: (ms: number) => {
      time += ms;
    },
    sleeps,
  };
}

describe("createPoliteFetcher", () => {
  it("同一網站兩次請求至少隔 1.1 秒；不同網站不互等；帶 User-Agent", async () => {
    const clock = fakeClock();
    const seen: Array<{ url: string; ua: string | undefined; at: number }> = [];
    const fetcher = createPoliteFetcher({
      fetch: (async (url: string, init?: RequestInit) => {
        seen.push({ url, ua: (init?.headers as Record<string, string>)["User-Agent"], at: clock.now() });
        return new Response("ok");
      }) as typeof fetch,
      now: clock.now,
      sleep: clock.sleep,
    });
    await Promise.all([fetcher.getText("https://a.test/1"), fetcher.getText("https://a.test/2"), fetcher.getText("https://b.test/1")]);
    const aTimes = seen.filter((item) => item.url.startsWith("https://a.test")).map((item) => item.at);
    expect(aTimes[1] - aTimes[0]).toBeGreaterThanOrEqual(1100);
    expect(seen.every((item) => item.ua === EVENTS_USER_AGENT)).toBe(true);
    expect(fetcher.counts()).toEqual({ a: 2, b: 1 });
  });

  it("同一主網域的不同子網域也算同一站（KKTIX 各主辦頁）", async () => {
    expect(siteOf("https://kktix.com/events.atom")).toBe("kktix");
    expect(siteOf("https://comedyclub.kktix.cc/events/x")).toBe("kktix");
    expect(siteOf("https://www.tfam.museum/ashx/Exhibition.ashx")).toBe("tfam");
    // .gov.tw／.edu.tw／.org.tw 不能都算成同一站
    expect(siteOf("https://www.nmns.edu.tw/backend/opendata/Exhibition/list")).toBe("nmns");
    expect(siteOf("https://kdmofa.tnua.edu.tw/mod/exhibition/index.php")).toBe("tnua");
    expect(siteOf("https://www.nmh.gov.tw/News_Actives_photo.aspx")).toBe("nmh");
    expect(siteOf("https://www.mocataipei.org.tw/tw/ExhibitionAndEvent/Exhibitions")).toBe("mocataipei");
    expect(siteOf("https://event.culture.tw/mocweb/reg/NTM/Detail.init.ctr")).toBe("culture");
    const clock = fakeClock();
    const at: number[] = [];
    const fetcher = createPoliteFetcher({
      fetch: (async () => {
        at.push(clock.now());
        return new Response("ok");
      }) as typeof fetch,
      now: clock.now,
      sleep: clock.sleep,
    });
    await Promise.all([fetcher.getText("https://kktix.com/events.atom"), fetcher.getText("https://a.kktix.cc/events/1")]);
    expect(at[1] - at[0]).toBeGreaterThanOrEqual(1100);
  });

  it("非 2xx 丟錯（含網址與狀態碼），不影響同站下一個請求", async () => {
    const clock = fakeClock();
    const fetcher = createPoliteFetcher({
      fetch: (async (url: string) => new Response("x", { status: url.endsWith("/bad") ? 403 : 200 })) as typeof fetch,
      now: clock.now,
      sleep: clock.sleep,
    });
    await expect(fetcher.getText("https://a.test/bad")).rejects.toThrow("https://a.test/bad 回應 403");
    await expect(fetcher.getText("https://a.test/ok")).resolves.toBe("x");
  });

  it("postJson 送 JSON、回應不是 JSON 丟錯", async () => {
    const clock = fakeClock();
    const fetcher = createPoliteFetcher({
      fetch: (async (_url: string, init?: RequestInit) =>
        new Response(init?.body === '{"a":1}' ? '{"ok":true}' : "<html>")) as typeof fetch,
      now: clock.now,
      sleep: clock.sleep,
    });
    await expect(fetcher.postJson("https://a.test/x", '{"a":1}')).resolves.toEqual({ ok: true });
    await expect(fetcher.postJson("https://a.test/x", "{}")).rejects.toThrow("不是 JSON");
  });
});
