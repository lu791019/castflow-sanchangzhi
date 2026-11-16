import { describe, expect, it } from "vitest";
import { createScrimDismissGuard } from "./scrim-dismiss";

describe("createScrimDismissGuard：遮罩只在按下與放開都在遮罩上時關閉", () => {
  it("沒有在遮罩上按下的 click（觸控補發的幽靈點擊）不關閉", () => {
    const guard = createScrimDismissGuard();
    expect(guard.shouldDismiss()).toBe(false);
  });

  it("在遮罩上按下再 click → 關閉，且只算一次", () => {
    const guard = createScrimDismissGuard();
    guard.markPressStart();
    expect(guard.shouldDismiss()).toBe(true);
    expect(guard.shouldDismiss()).toBe(false);
  });
});
