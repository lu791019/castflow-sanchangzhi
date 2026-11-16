import { describe, expect, it, vi } from "vitest";
import { createKeyedStore } from "./keyed-store";

describe("createKeyedStore", () => {
  it("依 key 存取；沒有回 fallback", () => {
    const store = createKeyedStore<string[]>([]);
    expect(store.get("w1")).toEqual([]);
    store.set("w1", ["a"]);
    expect(store.get("w1")).toEqual(["a"]);
    expect(store.get("w2")).toEqual([]);
  });

  it("update 以前一個值算新值，不改舊陣列", () => {
    const store = createKeyedStore<string[]>([]);
    store.set("w1", ["a"]);
    const before = store.get("w1");
    store.update("w1", (previous) => [...previous, "b"]);
    expect(store.get("w1")).toEqual(["a", "b"]);
    expect(before).toEqual(["a"]);
  });

  it("寫入通知訂閱者；取消訂閱後不再通知", () => {
    const store = createKeyedStore<number>(0);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set("k", 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set("k", 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
