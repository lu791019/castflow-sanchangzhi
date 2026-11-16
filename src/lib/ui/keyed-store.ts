/**
 * 頁面存活期間的小型共用狀態（依 key，例如作品 id）：給 useSyncExternalStore 用。
 * 用途：送出成功後「直接換畫面」的結果不放在元件 state——Next 背景 refresh 套上較舊的回應而重掛元件時，換好的畫面不會掉回去。
 * 值一律整個換新（不改舊物件）。
 */

export interface KeyedStore<T> {
  get: (key: string) => T;
  set: (key: string, value: T) => void;
  update: (key: string, next: (previous: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createKeyedStore<T>(fallback: T): KeyedStore<T> {
  let values = new Map<string, T>();
  const listeners = new Set<() => void>();
  const set = (key: string, value: T) => {
    values = new Map(values).set(key, value);
    listeners.forEach((listener) => listener());
  };
  const get = (key: string) => (values.has(key) ? (values.get(key) as T) : fallback);
  return {
    get,
    set,
    update: (key, next) => set(key, next(get(key))),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
