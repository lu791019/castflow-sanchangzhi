import type { CSSProperties } from "react";
import { verticalRuns } from "@/lib/share/og-card";

/** 拉丁字平均字寬（em），用來估橫躺段的長度 */
const LATIN_ADVANCE_EM = 0.58;

interface VerticalTextProps {
  text: string;
  fontSize: number;
  /** 字距（em） */
  tracking: number;
  style: CSSProperties;
}

/**
 * 直排（vertical-rl 的替代）：Satori 不支援 writing-mode，
 * 中文一字一格往下排；拉丁字母數字整段轉 90° 橫躺，跟瀏覽器直排的樣子一致。
 */
export function VerticalText({ text, fontSize, tracking, style }: VerticalTextProps) {
  const cell = fontSize * (1 + tracking);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", ...style }}>
      {verticalRuns(text).flatMap((run, runIndex) => {
        if (run.upright) {
          return Array.from(run.text).map((char, charIndex) => (
            <span
              key={`${runIndex}-${charIndex}`}
              style={{ display: "flex", justifyContent: "center", width: fontSize, height: cell, fontSize, lineHeight: 1 }}
            >
              {char}
            </span>
          ));
        }
        const length = Array.from(run.text).length * fontSize * (LATIN_ADVANCE_EM + tracking);
        return [
          <div key={runIndex} style={{ display: "flex", position: "relative", width: fontSize, height: length }}>
            <span
              style={{
                position: "absolute",
                left: (fontSize - length) / 2,
                top: (length - fontSize) / 2,
                width: length,
                height: fontSize,
                display: "flex",
                justifyContent: "center",
                fontSize,
                lineHeight: 1,
                letterSpacing: `${tracking}em`,
                transform: "rotate(90deg)",
                whiteSpace: "nowrap",
              }}
            >
              {run.text}
            </span>
          </div>,
        ];
      })}
    </div>
  );
}
