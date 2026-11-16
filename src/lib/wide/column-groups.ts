/**
 * 寬螢幕長文「限制欄高」（Dex 10/15 選 B，純函式）：正文多欄時每組欄最多約一個螢幕高，排滿往下接下一組欄，
 * 讀者不用捲回頂端。段落不拆，只決定在哪幾段之間換組；組數取最少、各組盡量平均（最後一組不會只剩一點），
 * 小標（keepWithNext）不留在一組的最後。實際量高度、算容量在 components/wide/column-groups.tsx。
 */

/** 實際欄數：同瀏覽器 multicol 規則（column-width＋column-gap 能塞幾欄，至少 1） */
export function columnCount(width: number, columnWidth: number, gap: number): number {
  if (columnWidth <= 0) return 1;
  return Math.max(1, Math.floor((width + gap) / (columnWidth + gap)));
}

function prefixSums(heights: readonly number[]): number[] {
  return heights.reduce<number[]>((sums, height) => [...sums, sums[sums.length - 1] + height], [0]);
}

/** 第 count 組的切點：離理想位置最近、且這組不超過容量；切在小標後面就往前退一段 */
function cutsFor(prefix: readonly number[], count: number, capacity: number, keepWithNext: readonly boolean[]): number[] {
  const total = prefix[prefix.length - 1];
  const last = prefix.length - 1;
  const cuts: number[] = [];
  for (let group = 1; group < count; group += 1) {
    const start = cuts[cuts.length - 1] ?? 0;
    if (start >= last - 1) break;
    const ideal = (total * group) / count;
    const candidates = Array.from({ length: last - start - 1 }, (_, offset) => start + 1 + offset);
    const fitting = candidates.filter((cut) => prefix[cut] - prefix[start] <= capacity);
    const pool = fitting.length > 0 ? fitting : [start + 1];
    const best = pool.reduce((chosen, cut) => (Math.abs(prefix[cut] - ideal) < Math.abs(prefix[chosen] - ideal) ? cut : chosen));
    cuts.push(keepWithNext[best - 1] && best - 1 > start ? best - 1 : best);
  }
  return cuts;
}

function toGroups(length: number, cuts: readonly number[]): number[][] {
  const bounds = [0, ...cuts, length];
  return bounds.slice(0, -1).map((start, index) => Array.from({ length: bounds[index + 1] - start }, (_, offset) => start + offset));
}

function fits(groups: readonly number[][], prefix: readonly number[], capacity: number): boolean {
  return groups.every((group) => group.length === 1 || prefix[group[group.length - 1] + 1] - prefix[group[0]] <= capacity);
}

/** 段落高度 → 分組（每組是段落索引，照原順序）；容量不合理或放得下就一組 */
export function columnGroups(heights: readonly number[], capacity: number, keepWithNext: readonly boolean[] = []): number[][] {
  if (heights.length === 0) return [];
  const prefix = prefixSums(heights);
  const total = prefix[prefix.length - 1];
  if (capacity <= 0 || total <= capacity) return [heights.map((_, index) => index)];
  for (let count = Math.ceil(total / capacity); count <= heights.length; count += 1) {
    const groups = toGroups(heights.length, cutsFor(prefix, count, capacity, keepWithNext));
    if (fits(groups, prefix, capacity)) return groups;
  }
  return heights.map((_, index) => [index]);
}
