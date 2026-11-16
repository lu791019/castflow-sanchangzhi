import { describe, expect, it } from "vitest";
import { EXCERPT_MAX_CHARS, leadExcerpt } from "./excerpt";

const long = (char: string, length: number) => char.repeat(length);

describe("leadExcerpt", () => {
  it("跳過導言（第一段短句）從內文開頭取", () => {
    const body = ["# 標題", "", "三位導演各拍一位賊王，剪在一起卻毫無縫隙，看完最留下來的是小人物。", "", "本部可說是近期最成功的港片。", "", "本片改編真實的香港三大賊王。"].join("\n");
    expect(leadExcerpt(body)).toEqual(["本部可說是近期最成功的港片。", "本片改編真實的香港三大賊王。"]);
  });

  it("最多兩段；標題與清單不算", () => {
    const body = ["## 小標", "", "第一段。", "", "- 清單", "", "第二段。", "", "第三段。"].join("\n");
    expect(leadExcerpt(body)).toEqual(["第一段。", "第二段。"]);
  });

  it(`超過 ${EXCERPT_MAX_CHARS} 字截斷並加刪節號；第一段就滿就只取一段`, () => {
    const body = [long("甲", EXCERPT_MAX_CHARS + 40), "", "第二段。"].join("\n");
    const [first, ...rest] = leadExcerpt(body);
    expect(Array.from(first)).toHaveLength(EXCERPT_MAX_CHARS + 1);
    expect(first.endsWith("…")).toBe(true);
    expect(rest).toEqual([]);
  });

  it("第二段只取剩下的字數", () => {
    const body = [long("甲", EXCERPT_MAX_CHARS - 10), "", long("乙", 30)].join("\n");
    const [, second] = leadExcerpt(body);
    expect(second).toBe(`${long("乙", 10)}…`);
  });

  it("沒有段落回空陣列", () => {
    expect(leadExcerpt("# 只有標題")).toEqual([]);
    expect(leadExcerpt("")).toEqual([]);
  });
});
