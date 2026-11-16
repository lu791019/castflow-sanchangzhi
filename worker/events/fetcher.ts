/**
 * 禮貌抓取：可識別 User-Agent、逾時 15 秒、同一網站序列化且兩次請求至少隔 1.1 秒（每站每秒最多 1 次）。
 * 「同一網站」以主網域名稱算（kktix.com 與各主辦的 *.kktix.cc 都算 kktix；www.opentix.life 算 opentix；
 * www.nmh.gov.tw 算 nmh，不把所有 .gov.tw 當成同一站），
 * 不同網站各自排隊、可以平行。非 2xx 一律丟錯（例如 Cloudflare 驗證頁 403），不重試、不繞。
 */

export const EVENTS_USER_AGENT = "CastflowBot/0.1 (+https://castflow.daydreamdex.com)";
export const EVENTS_TIMEOUT_MS = 15_000;
export const EVENTS_MIN_INTERVAL_MS = 1_100;

export interface PoliteFetcherDeps {
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  minIntervalMs?: number;
  timeoutMs?: number;
}

export interface PoliteFetcher {
  getText(url: string): Promise<string>;
  postJson(url: string, body: string): Promise<unknown>;
  /** 各網站（主網域名稱）實際打出去的請求數 */
  counts(): Record<string, number>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 國家網域底下的通用二級網域（gov.tw、edu.tw、org.tw…）：主網域名稱要再往前一層 */
const SECOND_LEVEL = new Set(["com", "org", "gov", "edu", "net", "idv", "co", "ac", "or", "go"]);

/** 主網域名稱：a.kktix.cc → kktix、www.tfam.museum → tfam、www.nmh.gov.tw → nmh、127.0.0.1 → 原樣 */
export function siteOf(url: string): string {
  const host = new URL(url).hostname;
  if (/^[\d.]+$/.test(host) || !host.includes(".")) return host;
  const labels = host.split(".");
  const country = labels.length >= 3 && labels[labels.length - 1].length === 2 && SECOND_LEVEL.has(labels[labels.length - 2]);
  return labels[labels.length - (country ? 3 : 2)];
}

export function createPoliteFetcher(deps: PoliteFetcherDeps): PoliteFetcher {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const minInterval = deps.minIntervalMs ?? EVENTS_MIN_INTERVAL_MS;
  const timeoutMs = deps.timeoutMs ?? EVENTS_TIMEOUT_MS;
  const queues = new Map<string, Promise<unknown>>();
  const lastAt = new Map<string, number>();
  const counter = new Map<string, number>();

  /** 同一個 host 一次一個；輪到時距離上一次不足間隔就先等 */
  function schedule<T>(url: string, task: () => Promise<T>): Promise<T> {
    const host = siteOf(url);
    const previous = queues.get(host) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const wait = (lastAt.get(host) ?? -Infinity) + minInterval - now();
        if (wait > 0) await sleep(wait);
        lastAt.set(host, now());
        counter.set(host, (counter.get(host) ?? 0) + 1);
        return task();
      });
    queues.set(host, run);
    return run;
  }

  async function request(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await deps.fetch(url, {
        ...init,
        headers: { "User-Agent": EVENTS_USER_AGENT, ...(init.headers as Record<string, string> | undefined) },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
    } catch (error) {
      throw new Error(`${url}：${error instanceof Error ? error.message : "連線失敗"}`);
    }
    if (!response.ok) throw new Error(`${url} 回應 ${response.status}`);
    return response;
  }

  return {
    getText: (url) => schedule(url, async () => (await request(url, { method: "GET" })).text()),
    postJson: (url, body) =>
      schedule(url, async () => {
        const response = await request(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
        });
        try {
          return (await response.json()) as unknown;
        } catch {
          throw new Error(`${url} 不是 JSON`);
        }
      }),
    counts: () => Object.fromEntries(counter),
  };
}
