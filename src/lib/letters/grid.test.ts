import { describe, expect, it } from "vitest";
import { layoutCells } from "./grid";

describe("layoutCells（稿紙格一格一字）", () => {
  it("空白：三行 33 格，全空", () => {
    const layout = layoutCells("");
    expect(layout.rows).toBe(3);
    expect(layout.cells).toHaveLength(33);
    expect(layout.cells.every((cell) => cell.char === "" && !cell.over)).toBe(true);
  });

  it("一格一字，補滿到整行", () => {
    const layout = layoutCells("想說的話");
    expect(layout.cells.slice(0, 4).map((cell) => cell.char).join("")).toBe("想說的話");
    expect(layout.cells).toHaveLength(33);
  });

  it("換行跳到下一行開頭（換行本身不佔格，但算字數）", () => {
    const layout = layoutCells("一\n二");
    expect(layout.cells[0].char).toBe("一");
    expect(layout.cells[11].char).toBe("二");
    expect(layout.cells[1].char).toBe("");
  });

  it("第 141 字起標記超過", () => {
    const text = "字".repeat(143);
    const layout = layoutCells(text);
    const filled = layout.cells.filter((cell) => cell.char);
    expect(filled.filter((cell) => cell.over)).toHaveLength(3);
    expect(filled[139].over).toBe(false);
    expect(filled[140].over).toBe(true);
    expect(layout.rows).toBe(13);
  });

  it("超過十三行：行數照實際（外層負責捲動）", () => {
    const layout = layoutCells("字".repeat(160));
    expect(layout.rows).toBe(15);
    expect(layout.cells).toHaveLength(165);
  });
});

describe("layoutCells 換行邊界", () => {
  it("開頭換行、連續換行各空一列", () => {
    expect(layoutCells("\n一").cells[11].char).toBe("一");
    expect(layoutCells("一\n\n二").cells[22].char).toBe("二");
  });
});

describe("layoutCells 剛好寫滿一列再換行", () => {
  it("不多空一列（與 textarea 一致）", () => {
    expect(layoutCells(`${"字".repeat(11)}\n二`).cells[11].char).toBe("二");
  });
});
