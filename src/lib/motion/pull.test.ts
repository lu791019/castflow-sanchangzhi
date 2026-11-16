import { describe, expect, it } from "vitest";
import { PULL_MAX, PULL_THRESHOLD, pullOffset, pullPastThreshold } from "./pull";

describe("pullOffset", () => {
  it("跟手阻尼 0.5×", () => {
    expect(pullOffset(100)).toBe(50);
  });
  it("上限 120", () => {
    expect(pullOffset(1000)).toBe(PULL_MAX);
  });
  it("往上推不位移", () => {
    expect(pullOffset(-40)).toBe(0);
  });
});

describe("pullPastThreshold", () => {
  it("拖曳 144px（位移 72）才算過門檻", () => {
    expect(PULL_THRESHOLD).toBe(72);
    expect(pullPastThreshold(143)).toBe(false);
    expect(pullPastThreshold(144)).toBe(true);
  });
});
