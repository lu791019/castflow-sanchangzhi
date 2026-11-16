import { describe, expect, it } from "vitest";
import { FORCE_KEY, isForced, parseState, readState, serializeState, tourKey, writeState } from "./storage";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("tourKey", () => {
  it("登入者每人一份、訪客一份", () => {
    expect(tourKey("member", "u-1")).toBe("castflow.tour.member.u-1");
    expect(tourKey("member", "u-2")).not.toBe(tourKey("member", "u-1"));
    expect(tourKey("guest", null)).toBe("castflow.tour.guest");
  });
});

describe("parseState／serializeState", () => {
  it("來回一致", () => {
    const state = { status: "active", step: "log-work", explicit: true } as const;
    expect(parseState(serializeState(state))).toEqual(state);
    expect(parseState(serializeState({ status: "done" }))).toEqual({ status: "done" });
  });

  it("壞資料、不認得的步驟一律當沒有", () => {
    expect(parseState(null)).toBeNull();
    expect(parseState("{")).toBeNull();
    expect(parseState('{"status":"active","step":"nope"}')).toBeNull();
    expect(parseState('"done"')).toBeNull();
  });

  it("explicit 缺漏當 false", () => {
    expect(parseState('{"status":"active","step":"goal"}')).toEqual({ status: "active", step: "goal", explicit: false });
  });
});

describe("readState／writeState", () => {
  it("寫了讀得回來", () => {
    const storage = memoryStorage();
    writeState(storage, "k", { status: "done" });
    expect(readState(storage, "k")).toEqual({ status: "done" });
  });

  it("儲存被擋（無痕等）：讀當沒有、寫不丟錯", () => {
    expect(readState(throwing, "k")).toBeNull();
    expect(() => writeState(throwing, "k", { status: "done" })).not.toThrow();
  });
});

describe("isForced", () => {
  it("只有 force 旗標為 1 才算", () => {
    expect(isForced(memoryStorage({ [FORCE_KEY]: "1" }))).toBe(true);
    expect(isForced(memoryStorage())).toBe(false);
    expect(isForced(throwing)).toBe(false);
  });
});
