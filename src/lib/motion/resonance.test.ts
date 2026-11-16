import { describe, expect, it } from "vitest";
import { movedTooFar, RESONANCE_LONG_PRESS_MS } from "./resonance";

describe("長按手勢", () => {
  it("沿用 press.longPress 450ms", () => {
    expect(RESONANCE_LONG_PRESS_MS).toBe(450);
  });
  it("移動超過 10px 視為捲動", () => {
    expect(movedTooFar(3, 4)).toBe(false);
    expect(movedTooFar(8, 8)).toBe(true);
    expect(movedTooFar(0, -11)).toBe(true);
  });
});
