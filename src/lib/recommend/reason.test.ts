import { describe, expect, it } from "vitest";
import { formatReason } from "./reason";
import type { Seed } from "./types";

const wrote: Seed = { workId: "w1", title: "人聲", media: "movie", tmdbId: 1, source: "wrote" };
const logged: Seed = { ...wrote, title: "師父", source: "logged" };
const planned: Seed = { ...wrote, title: "樹大招風", source: "planned" };

describe("formatReason", () => {
  it("命中：引用使用者自己的作品，動詞依來源", () => {
    expect(formatReason({ type: "hit", seed: wrote })).toBe("因為你寫過〈人聲〉");
    expect(formatReason({ type: "hit", seed: logged })).toBe("因為你記過〈師父〉");
    expect(formatReason({ type: "hit", seed: planned })).toBe("因為你排了〈樹大招風〉");
  });

  it("同導演、同演員、同類型", () => {
    expect(formatReason({ type: "director", seed: wrote, name: "阿莫多瓦" })).toBe("跟你寫過的〈人聲〉同一位導演・阿莫多瓦");
    expect(formatReason({ type: "cast", seed: logged, name: "蒂妲史雲頓" })).toBe("有你記過的〈師父〉裡的蒂妲史雲頓");
    expect(formatReason({ type: "genre", seed: planned, name: "劇情" })).toBe("跟你排進行程的〈樹大招風〉一樣是「劇情」");
  });

  it("品味資料：出門看演出、在家追劇、聽 Podcast", () => {
    expect(formatReason({ type: "taste", media: "live", side: "out" })).toBe("你喜歡出門看演出");
    expect(formatReason({ type: "taste", media: "exhibition", side: "out" })).toBe("你喜歡出門看展覽");
    expect(formatReason({ type: "taste", media: "movie", side: "out" })).toBe("你喜歡進戲院看電影");
    expect(formatReason({ type: "taste", media: "series", side: "home" })).toBe("你常在家追劇");
    expect(formatReason({ type: "taste", media: "podcast", side: null })).toBe("你常聽 Podcast");
    expect(formatReason({ type: "taste", media: "movie", side: null })).toBe("你常看電影");
    expect(formatReason({ type: "taste", media: "live", side: "home" })).toBe("你喜歡看演出");
  });

  it("品味資料：音樂用「聽」", () => {
    expect(formatReason({ type: "taste", media: "music", side: null })).toBe("你常聽音樂");
    // 音樂在哪都能聽：場域不改說法
    expect(formatReason({ type: "taste", media: "music", side: "home" })).toBe("你常聽音樂");
    expect(formatReason({ type: "taste", media: "music", side: "out" })).toBe("你常聽音樂");
  });
});
