/**
 * 多鍵 TTL 快取（TMDB 詳情 24 小時）：同一個 key 並發共用一個 promise；失敗不進快取；超過上限丟最舊的。
 * 存在 process 記憶體裡（Cloud Run 縮到零就重來，代價是第一位訪客多等一次 TMDB）。
 */

export interface TtlCacheOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

export interface TtlCache<T> {
  get: (key: string, load: () => Promise<T>) => Promise<T>;
}

export function createTtlCache<T>({ ttlMs, maxEntries, now = Date.now }: TtlCacheOptions): TtlCache<T> {
  const entries = new Map<string, { value: T; loadedAt: number }>();
  const inflight = new Map<string, Promise<T>>();

  function remember(key: string, value: T): void {
    entries.delete(key);
    entries.set(key, { value, loadedAt: now() });
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  }

  return {
    get: (key, load) => {
      const hit = entries.get(key);
      if (hit && now() - hit.loadedAt < ttlMs) return Promise.resolve(hit.value);
      const pending = inflight.get(key);
      if (pending) return pending;
      const request = load()
        .then((value) => {
          remember(key, value);
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, request);
      return request;
    },
  };
}
