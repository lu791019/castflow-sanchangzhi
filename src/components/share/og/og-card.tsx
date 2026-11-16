import { OG_BRAND, OG_COLUMN, type OgCardModel } from "@/lib/share/og-model";
import { PlateColumn, PodcastColumn, PosterColumn } from "./og-left";
import { OgSeal } from "./og-seal";
import { OG, OG_HEIGHT, OG_LEFT_WIDTH, OG_WIDTH, SANS_FAMILY, SERIF_FAMILY } from "./tokens";

/** 左欄依版型；海報抓不到時（image 為 null）A 版改畫直排字卡 */
function LeftColumn({ model, image }: { model: OgCardModel; image: string | null }) {
  if (model.variant === "podcast" && model.podcast) return <PodcastColumn podcast={model.podcast} image={image} />;
  if (model.variant === "poster" && image) return <PosterColumn image={image} />;
  return <PlateColumn plate={model.plate} />;
}

/** 刊頭：散場之後 —— 第 0142 號 */
function Eyebrow({ issue }: { issue: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: SANS_FAMILY, fontSize: 24, fontWeight: 700, letterSpacing: "0.2em" }}>
      <span style={{ color: OG.emberDark }}>{OG_COLUMN}</span>
      <span style={{ display: "flex", width: 40, height: 2, background: OG.ink400 }} />
      <span style={{ color: OG.ink700 }}>{issue}</span>
    </div>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", position: "relative", marginTop: 32, paddingLeft: 40 }}>
      <span style={{ position: "absolute", left: -4, top: -6, fontFamily: SERIF_FAMILY, fontWeight: 700, fontSize: 44, lineHeight: 1, color: OG.ember }}>
        「
      </span>
      <span style={{ fontFamily: SERIF_FAMILY, fontSize: 34, lineHeight: 1.6, fontWeight: 600, color: OG.ink900 }}>{text}</span>
    </div>
  );
}

function Footer({ model }: { model: OgCardModel }) {
  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: 20,
        borderTop: `1px solid ${OG.ink950}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flexShrink: 1 }}>
        {model.seal ? <OgSeal seal={model.seal} /> : null}
        <div style={{ display: "flex", alignItems: "baseline", fontFamily: SANS_FAMILY, fontSize: 24, color: OG.ink700, whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: OG.ink950 }}>{model.author}</span>
          {model.byline ? <span>・{model.byline}</span> : null}
        </div>
      </div>
      <span style={{ flexShrink: 0, fontFamily: SERIF_FAMILY, fontSize: 26, fontWeight: 700, letterSpacing: "0.1em", color: OG.ink950 }}>
        {OG_BRAND}
      </span>
    </div>
  );
}

/** OG 預覽卡 1200×630（A 有海報／B 直排字卡／C Podcast 共用右欄） */
export function OgCard({ model, image }: { model: OgCardModel; image: string | null }) {
  return (
    <div style={{ display: "flex", width: OG_WIDTH, height: OG_HEIGHT, background: OG.paper, color: OG.ink900 }}>
      <LeftColumn model={model} image={image} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: OG_WIDTH - OG_LEFT_WIDTH,
          height: OG_HEIGHT,
          padding: "56px 64px 48px 56px",
        }}
      >
        <Eyebrow issue={model.issue} />
        <span
          style={{
            marginTop: 28,
            fontFamily: SERIF_FAMILY,
            fontSize: model.title.fontSize,
            lineHeight: 1.3,
            fontWeight: 700,
            color: OG.ink950,
          }}
        >
          {model.title.text}
        </span>
        {model.quote ? <Quote text={model.quote} /> : null}
        <Footer model={model} />
      </div>
    </div>
  );
}
