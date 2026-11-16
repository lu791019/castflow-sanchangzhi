/** 回信稿紙格的排版（一格一字、一列 11 格；換行跳到下一列；第 141 字起標記超過） */

import { GRID_COLUMNS, GRID_MIN_ROWS, LETTER_LIMIT } from "./rules";

export interface GridCell {
  char: string;
  over: boolean;
}

export interface GridLayout {
  cells: GridCell[];
  rows: number;
}

const EMPTY: GridCell = { char: "", over: false };

function padToRow(cells: GridCell[]): GridCell[] {
  const remainder = cells.length % GRID_COLUMNS;
  return remainder === 0 ? cells : [...cells, ...Array<GridCell>(GRID_COLUMNS - remainder).fill(EMPTY)];
}

export function layoutCells(text: string): GridLayout {
  const chars = Array.from(text);
  // lineLength：自上一個換行起的字數（判斷換行要補幾格）
  const { cells } = chars.reduce<{ cells: GridCell[]; lineLength: number }>(
    (acc, char, index) => {
      if (char !== "\n") {
        return { cells: [...acc.cells, { char, over: index >= LETTER_LIMIT }], lineLength: acc.lineLength + 1 };
      }
      // 空行空一整列；剛好寫滿一列不再補；其餘補滿這一列
      if (acc.lineLength === 0) return { cells: [...acc.cells, ...Array<GridCell>(GRID_COLUMNS).fill(EMPTY)], lineLength: 0 };
      return { cells: padToRow(acc.cells), lineLength: 0 };
    },
    { cells: [], lineLength: 0 },
  );
  const rows = Math.max(GRID_MIN_ROWS, Math.ceil(cells.length / GRID_COLUMNS));
  const total = rows * GRID_COLUMNS;
  return { cells: [...cells, ...Array<GridCell>(total - cells.length).fill(EMPTY)], rows };
}
