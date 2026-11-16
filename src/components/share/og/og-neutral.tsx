import { OG_BRAND, OG_COLUMN } from "@/lib/share/og-model";
import { OG, OG_HEIGHT, OG_LEFT_WIDTH, OG_WIDTH, SERIF_FAMILY } from "./tokens";
import { VerticalText } from "./vertical-text";

/** 與 public/og/neutral-serif-tc-700.ttf 子集一致；改字要重抓子集 */
export const NEUTRAL_LINE = "真實的感受，比完美的評價更值得被聽見";

/**
 * 中性卡：私人／收回／找不到，或字型抓不到時用。不含任何文章內容，也不透露這一篇是否存在。
 * 設計稿沒有這一張，沿用 B 直排字卡的版面與分享頁頁尾的標語。
 */
export function OgNeutralCard() {
  return (
    <div style={{ display: "flex", width: OG_WIDTH, height: OG_HEIGHT, background: OG.paper, color: OG.ink950, fontFamily: SERIF_FAMILY, fontWeight: 700 }}>
      <div
        style={{
          display: "flex",
          position: "relative",
          width: OG_LEFT_WIDTH,
          height: OG_HEIGHT,
          background: OG.paper2,
          borderTop: `4px solid ${OG.ink950}`,
          borderBottom: `2px solid ${OG.ink950}`,
          borderRight: `1px solid ${OG.hairline}`,
        }}
      >
        <div style={{ position: "absolute", left: 48, top: 52, width: 12, height: 12, background: OG.ember, display: "flex" }} />
        <VerticalText text={OG_COLUMN} fontSize={60} tracking={0.12} style={{ position: "absolute", right: 64, top: 52 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", width: OG_WIDTH - OG_LEFT_WIDTH, padding: "56px 64px 48px 56px" }}>
        <span style={{ fontSize: 24, letterSpacing: "0.2em", color: OG.emberDark }}>{OG_COLUMN}</span>
        <span style={{ marginTop: 28, fontSize: 60, lineHeight: 1.3 }}>{NEUTRAL_LINE}</span>
        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: `1px solid ${OG.ink950}`, display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 26, letterSpacing: "0.1em" }}>{OG_BRAND}</span>
        </div>
      </div>
    </div>
  );
}
