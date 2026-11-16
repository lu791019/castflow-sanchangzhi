import { describe, expect, it } from "vitest";
import { liveKey, normalizeLiveName, splitProgrammeTitle } from "./name";

describe("normalizeLiveName", () => {
  it("去掉空白、標點、全半形差異，英文轉小寫", () => {
    expect(normalizeLiveName("島嶼夜歌・草地音樂會")).toBe("島嶼夜歌草地音樂會");
    expect(normalizeLiveName(" 島嶼夜歌 草地音樂會 ")).toBe("島嶼夜歌草地音樂會");
    expect(normalizeLiveName("島嶼夜歌．草地音樂會！")).toBe("島嶼夜歌草地音樂會");
    expect(normalizeLiveName("「島嶼夜歌」-草地音樂會")).toBe("島嶼夜歌草地音樂會");
    expect(normalizeLiveName("ＦＵＪＩ Rock '26")).toBe("fujirock26");
    expect(normalizeLiveName("Fuji  ROCK 26")).toBe("fujirock26");
  });

  it("繁簡、錯字不合併（只做機械正規化）", () => {
    expect(normalizeLiveName("島嶼夜歌")).not.toBe(normalizeLiveName("岛屿夜歌"));
  });

  it("全是標點時回空字串", () => {
    expect(normalizeLiveName("・・！")).toBe("");
  });
});

describe("liveKey", () => {
  it("正規化後截到 200 字；空的回 null", () => {
    expect(liveKey("光的抄寫・攝影展")).toBe("光的抄寫攝影展");
    expect(liveKey("！！")).toBeNull();
    expect(Array.from(liveKey("字".repeat(260)) ?? "").length).toBe(200);
  });
});

describe("splitProgrammeTitle", () => {
  it("在第一個「・」之後斷行，字卡用前半", () => {
    expect(splitProgrammeTitle("島嶼夜歌・草地音樂會")).toEqual({
      lines: ["島嶼夜歌・", "草地音樂會"],
      plate: "島嶼夜歌",
    });
  });

  it("沒有分隔就一行，字卡取前六字", () => {
    expect(splitProgrammeTitle("光的抄寫")).toEqual({ lines: ["光的抄寫"], plate: "光的抄寫" });
    expect(splitProgrammeTitle("春天的海邊音樂節第二輪").plate).toBe("春天的海邊音");
  });

  it("空白分隔也可斷行", () => {
    expect(splitProgrammeTitle("Fuji Rock 2026")).toEqual({ lines: ["Fuji", "Rock 2026"], plate: "Fuji" });
  });

  it("字卡開頭是英文字：整個字留著，不從字中間切（UX-25「uxaud / i」）", () => {
    expect(splitProgrammeTitle("uxaudit 測試演出").plate).toBe("uxaudit");
    expect(splitProgrammeTitle("Coldplay2026台北").plate).toBe("Coldplay2026");
    expect(splitProgrammeTitle("Supercalifragilistic").plate).toBe("Supercalifragi");
    // 中文後面接英文字、六字剛好切在英文字中間：整個英文字不放
    expect(splitProgrammeTitle("補封面cxzwf").plate).toBe("補封面");
    expect(splitProgrammeTitle("光影cx").plate).toBe("光影cx");
  });
});
