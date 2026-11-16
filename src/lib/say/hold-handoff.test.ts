import { describe, expect, it, vi } from "vitest";
import { beginHoldHandoff, HOLD_HANDOFF_TTL_MS, takeHoldHandoff } from "./hold-handoff";

function fakeTarget() {
  const handlers = new Map<string, () => void>();
  return {
    addEventListener: vi.fn((type: string, handler: () => void) => handlers.set(type, handler)),
    removeEventListener: vi.fn((type: string) => handlers.delete(type)),
    fire: (type: string) => handlers.get(type)?.(),
    handlers,
  };
}

describe("hold handoff", () => {
  it("手指還按著：放開時通知一次，並拆掉監聽", () => {
    const target = fakeTarget();
    beginHoldHandoff(target as never, 1000);
    const handoff = takeHoldHandoff(1500);
    expect(handoff?.released()).toBe(false);
    const onRelease = vi.fn();
    handoff?.onRelease(onRelease);
    target.fire("pointerup");
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(handoff?.released()).toBe(true);
    expect(target.handlers.size).toBe(0);
  });

  it("取走前已放開：released 為 true，onRelease 不再呼叫", () => {
    const target = fakeTarget();
    beginHoldHandoff(target as never, 1000);
    target.fire("pointercancel");
    const handoff = takeHoldHandoff(1200);
    expect(handoff?.released()).toBe(true);
    const onRelease = vi.fn();
    handoff?.onRelease(onRelease);
    expect(onRelease).not.toHaveBeenCalled();
  });

  it("只能取一次；逾時作廢", () => {
    beginHoldHandoff(fakeTarget() as never, 1000);
    expect(takeHoldHandoff(1100)).not.toBeNull();
    expect(takeHoldHandoff(1100)).toBeNull();
    beginHoldHandoff(fakeTarget() as never, 1000);
    expect(takeHoldHandoff(1000 + HOLD_HANDOFF_TTL_MS + 1)).toBeNull();
  });

  it("取消訂閱後放開不通知", () => {
    const target = fakeTarget();
    beginHoldHandoff(target as never, 1000);
    const onRelease = vi.fn();
    const unsubscribe = takeHoldHandoff(1000)!.onRelease(onRelease);
    unsubscribe();
    target.fire("pointerup");
    expect(onRelease).not.toHaveBeenCalled();
  });
});
