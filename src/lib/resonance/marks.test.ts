import { describe, expect, it } from "vitest";
import { passageMarkView } from "./marks";

describe("句邊記號四態", () => {
  it("a 未標：什麼都不畫", () => {
    expect(passageMarkView({ count: 0, mine: false })).toEqual({
      state: "none",
      numeral: "",
      buttonLabel: "這句我也是",
      actionLabel: "這句我也是",
    });
  });

  it("b 只有你：不寫數字", () => {
    const view = passageMarkView({ count: 1, mine: true });
    expect(view.state).toBe("mine");
    expect(view.numeral).toBe("");
    expect(view.actionLabel).toBe("收回記號");
    expect(view.buttonLabel).toBe("你已在這段留下記號，共 1 人。點一下可收回");
  });

  it("c 他人標了：人數", () => {
    const view = passageMarkView({ count: 7, mine: false });
    expect(view.state).toBe("others");
    expect(view.numeral).toBe("7");
    expect(view.buttonLabel).toBe("這句我也是（已有 7 人）");
  });

  it("d 兩者皆有：數字含你在內", () => {
    const view = passageMarkView({ count: 8, mine: true });
    expect(view.state).toBe("both");
    expect(view.numeral).toBe("8");
    expect(view.buttonLabel).toBe("你已在這段留下記號，共 8 人。點一下可收回");
  });

  it("百人以上照寫數字", () => {
    expect(passageMarkView({ count: 150, mine: false }).numeral).toBe("150");
  });

  it("資料不一致（mine 但 count 0）以至少一人計", () => {
    expect(passageMarkView({ count: 0, mine: true }).state).toBe("mine");
  });
});
