"use client";

/**
 * 寬螢幕長文正文多欄（Q-60；Dex 10/15 選 B「限制欄高」）：每組欄最多約 80vh，排滿往下接下一組欄，讀者不用捲回頂端。
 * - 伺服器與第一次渲染：一組（跟以前一樣），沒 JS 也照常讀
 * - ≥1024 量每段在單欄寬下的高度 → 分組（lib/wide/column-groups.ts）；換寬度、字型載入後重算
 * - 引言不跨欄（break-inside-avoid）、小標不落欄底也不落組底；手機（<1024）不分組也沒有欄
 */

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { columnCount, columnGroups } from "@/lib/wide/column-groups";

/** 每組欄最多幾個螢幕高 */
const MAX_GROUP_VIEWPORT = 0.8;
const WIDE_QUERY = "(min-width: 1024px)";

const GROUP_CLASS =
  "lg:columns-[340px] lg:gap-12 lg:[column-rule:1px_solid_var(--color-ink-200)] lg:[&_aside]:break-inside-avoid lg:[&_h2]:break-after-avoid";
/** 第二組起：跟上一組隔開、髮絲線提示「往下接」 */
const NEXT_GROUP_CLASS = "lg:mt-10 lg:border-t lg:border-ink-200 lg:pt-10";

interface Measured {
  heights: number[];
  capacity: number;
  keepWithNext: boolean[];
}

/** 暫時把每組改成單欄、寬度＝實際欄寬，量完立刻還原（在 layout effect 裡做，不會被畫出來） */
function measure(groups: readonly HTMLElement[]): Measured | null {
  const first = groups[0];
  if (!first) return null;
  const style = getComputedStyle(first);
  const columnWidth = Number.parseFloat(style.columnWidth);
  const gap = Number.parseFloat(style.columnGap);
  if (!Number.isFinite(columnWidth) || !Number.isFinite(gap)) return null;
  const width = first.clientWidth;
  const count = columnCount(width, columnWidth, gap);
  const single = (width - (count - 1) * gap) / count;
  groups.forEach((group) => Object.assign(group.style, { columns: "auto", width: `${single}px`, display: "flow-root" }));
  const heights: number[] = [];
  const keepWithNext: boolean[] = [];
  groups.forEach((group) => {
    const blocks = Array.from(group.children) as HTMLElement[];
    const bottom = group.getBoundingClientRect().bottom;
    blocks.forEach((block, index) => {
      const next = blocks[index + 1];
      heights.push((next ? next.getBoundingClientRect().top : bottom) - block.getBoundingClientRect().top);
      keepWithNext.push(block.firstElementChild?.tagName === "H2" && block.childElementCount === 1);
    });
  });
  groups.forEach((group) => Object.assign(group.style, { columns: "", width: "", display: "" }));
  return { heights, capacity: count * MAX_GROUP_VIEWPORT * window.innerHeight, keepWithNext };
}

function sameGroups(a: readonly number[][] | null, b: readonly number[][] | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ColumnGroups({ children }: { children: ReactNode }) {
  const nodes = Children.toArray(children);
  const rootRef = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<number[][] | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wide = window.matchMedia(WIDE_QUERY);
    const regroup = () => {
      if (!wide.matches) return setGroups((current) => (current === null ? current : null));
      const measured = measure(Array.from(root.children) as HTMLElement[]);
      if (!measured) return;
      const next = columnGroups(measured.heights, measured.capacity, measured.keepWithNext);
      const value = next.length > 1 ? next : null;
      setGroups((current) => (sameGroups(current, value) ? current : value));
    };
    regroup();
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(regroup);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const layout = groups ?? [nodes.map((_, index) => index)];
  return (
    <div ref={rootRef} data-column-groups={layout.length}>
      {layout.map((indices, group) => (
        <div key={group} data-column-group="" className={`${GROUP_CLASS} ${group > 0 ? NEXT_GROUP_CLASS : ""}`}>
          {indices.map((index) => nodes[index])}
        </div>
      ))}
    </div>
  );
}
