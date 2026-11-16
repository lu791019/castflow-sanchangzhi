/**
 * 印章：由筆名生成、取代所有頭像（設計稿「P3 元件特寫 01」）。
 * - 外形：FNV-1a(筆名) mod 8，同一個筆名永遠同一枚印（換裝置也一樣），不可自選
 * - 印文：一個字。英文取首字母大寫；「阿、小、老」開頭取第二字；三字以上取最後一字；其餘取首字
 * - 四分格（第 8 形）：前兩字，讀序右上→右下→左上→左下＝一、二、一、二，左上與右下反白
 * - 只用 ink-900；線寬 24／40／64px 對應 1／1.5／2px；圓角 2px（圓與橢圓除外）
 * 幾何以 64×64 的 viewBox 計算，尺寸只換算線寬與間距。
 */

export const SEAL_SHAPE_NAMES = ["方印", "圓印", "雙框方印", "缺角方印", "白文", "橢圓", "斜線方印", "四分格"] as const;
export type SealSize = 24 | 40 | 64;

const WHITE_SHAPE = 4;
const QUAD_SHAPE = 7;
const HONORIFICS = "阿小老";
const VIEWBOX = 64;

export interface Seal {
  shape: number;
  /** SVG path（viewBox 0 0 64 64） */
  path: string;
  /** 白文：ink 實底、紙色字 */
  filled: boolean;
  /** viewBox 單位的線寬 */
  strokeWidth: number;
  strokePx: number;
  glyph: string;
  glyphPx: number;
  /** 四分格的兩個字；不是四分格為 null */
  quad: [string, string] | null;
  quadPx: number;
}

export function fnv1a(text: string): number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) as number;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function sealShape(penName: string): number {
  return fnv1a(penName) % SEAL_SHAPE_NAMES.length;
}

export function sealGlyph(penName: string): string {
  const chars = Array.from(penName.trim());
  if (chars.length === 0) return "？";
  if (/^[A-Za-z]/.test(chars[0])) return chars[0].toUpperCase();
  if (chars.length >= 2 && HONORIFICS.includes(chars[0])) return chars[1];
  return chars.length >= 3 ? chars[chars.length - 1] : chars[0];
}

const round = (n: number) => Math.round(n * 100) / 100;

function roundedRect(p: number, q: number, r: number): string {
  return (
    `M${round(p + r)} ${p}H${round(q - r)}A${r} ${r} 0 0 1 ${q} ${round(p + r)}` +
    `V${round(q - r)}A${r} ${r} 0 0 1 ${round(q - r)} ${q}H${round(p + r)}` +
    `A${r} ${r} 0 0 1 ${p} ${round(q - r)}V${round(p + r)}A${r} ${r} 0 0 1 ${round(p + r)} ${p}Z`
  );
}

function ellipse(rx: number, ry: number): string {
  return `M${round(32 - rx)} 32A${rx} ${ry} 0 1 1 ${round(32 + rx)} 32A${rx} ${ry} 0 1 1 ${round(32 - rx)} 32Z`;
}

function shapePath(shape: number, size: SealSize, strokeWidth: number): string {
  const unit = VIEWBOX / size;
  const a = round(strokeWidth / 2);
  const b = round(VIEWBOX - strokeWidth / 2);
  const r = round(2 * unit);
  const radius = round(32 - strokeWidth / 2);
  const gap = round((size <= 24 ? 3 : size <= 40 ? 4 : 5) * unit);
  const notch = 18;
  switch (shape) {
    case 1:
      return ellipse(radius, radius);
    case 2:
      return roundedRect(a, b, r) + roundedRect(round(a + gap), round(b - gap), round(r * 0.6));
    case 3:
      return (
        `M${round(b - notch)} ${a}H${round(a + r)}A${r} ${r} 0 0 0 ${a} ${round(a + r)}V${round(b - r)}` +
        `A${r} ${r} 0 0 0 ${round(a + r)} ${b}H${round(b - r)}A${r} ${r} 0 0 0 ${b} ${round(b - r)}V${round(a + notch)}`
      );
    case 5:
      return ellipse(round(radius * 0.74), radius);
    case 6:
      return `${roundedRect(a, b, r)}M${a} 42L22 ${b}`;
    default:
      return roundedRect(a, b, r);
  }
}

/** glyphOverride：作者在設定換的印文（限筆名裡的字，其他字一律忽略） */
export function sealOf(penName: string, size: SealSize, glyphOverride?: string | null): Seal {
  const shape = sealShape(penName);
  const strokePx = size <= 24 ? 1 : size <= 40 ? 1.5 : 2;
  const strokeWidth = round(strokePx * (VIEWBOX / size));
  const chars = Array.from(penName.trim());
  const glyph = glyphOverride && chars.includes(glyphOverride) ? glyphOverride : sealGlyph(penName);
  return {
    shape,
    path: shapePath(shape, size, strokeWidth),
    filled: shape === WHITE_SHAPE,
    strokeWidth,
    strokePx,
    glyph,
    glyphPx: size <= 24 ? 12 : size <= 40 ? 22 : 30,
    quad: shape === QUAD_SHAPE && chars.length > 0 ? [chars[0], chars[1] ?? chars[0]] : null,
    quadPx: size <= 24 ? 11 : size <= 40 ? 15 : 22,
  };
}
