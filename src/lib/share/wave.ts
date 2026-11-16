/**
 * 產生設計稿的正弦波 path：M + Q 起一個半波，之後以 T 平滑延續。
 * 例：wavePath({ y: 7, amplitude: 6, halfPeriod: 15, width: 210 })
 *   → "M0 7 Q7.5 1 15 7 T30 7 … T210 7"
 */
export interface WavePathOptions {
  y: number;
  amplitude: number;
  halfPeriod: number;
  width: number;
  startX?: number;
}

export function wavePath(options: WavePathOptions): string {
  const { y, amplitude, halfPeriod, width, startX = 0 } = options;
  const parts = [
    `M${startX} ${y}`,
    `Q${startX + halfPeriod / 2} ${y - amplitude} ${startX + halfPeriod} ${y}`,
  ];
  for (let x = startX + halfPeriod * 2; x <= width; x += halfPeriod) {
    parts.push(`T${x} ${y}`);
  }
  return parts.join(" ");
}
