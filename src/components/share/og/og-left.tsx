import type { OgCardModel } from "@/lib/share/og-model";
import { OG, OG_HEIGHT, OG_LEFT_WIDTH, SANS_FAMILY, SERIF_FAMILY, STRIPES } from "./tokens";
import { VerticalText } from "./vertical-text";

const COLUMN = { display: "flex", position: "relative", width: OG_LEFT_WIDTH, height: OG_HEIGHT } as const;

/** A：TMDB 海報填滿左欄 */
export function PosterColumn({ image }: { image: string }) {
  return (
    <div style={{ ...COLUMN, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori 只認 img */}
      <img src={image} width={OG_LEFT_WIDTH} height={OG_HEIGHT} style={{ objectFit: "cover" }} alt="" />
    </div>
  );
}

/** B：直排字卡（作品名、場地、側標） */
export function PlateColumn({ plate }: { plate: OgCardModel["plate"] }) {
  return (
    <div
      style={{
        ...COLUMN,
        background: OG.paper2,
        borderTop: `4px solid ${OG.ink950}`,
        borderBottom: `2px solid ${OG.ink950}`,
        borderRight: `1px solid ${OG.hairline}`,
      }}
    >
      <div style={{ position: "absolute", left: 48, top: 52, width: 12, height: 12, background: OG.ember, display: "flex" }} />
      <div style={{ position: "absolute", right: 64, top: 52, display: "flex", flexDirection: "row-reverse", gap: 18 }}>
        <VerticalText
          text={plate.title}
          fontSize={plate.titleSize}
          tracking={0.12}
          style={{ fontFamily: SERIF_FAMILY, fontWeight: 700, color: OG.ink950 }}
        />
        {plate.subtitle ? (
          <VerticalText
            text={plate.subtitle}
            fontSize={34}
            tracking={0.12}
            style={{ marginTop: 128, fontFamily: SERIF_FAMILY, fontWeight: 700, color: OG.ink800 }}
          />
        ) : null}
      </div>
      <VerticalText
        text={plate.label}
        fontSize={22}
        tracking={0.2}
        style={{ position: "absolute", left: 48, bottom: 50, fontFamily: SANS_FAMILY, fontWeight: 400, color: OG.ink600 }}
      />
    </div>
  );
}

/** C：節目封面 1:1 ＋「EP7」＋節目名＋〈單集名〉 */
export function PodcastColumn({ podcast, image }: { podcast: NonNullable<OgCardModel["podcast"]>; image: string | null }) {
  return (
    <div
      style={{
        ...COLUMN,
        flexDirection: "column",
        background: OG.paper2,
        borderRight: `1px solid ${OG.hairline}`,
        padding: "48px 40px 0",
      }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori 只認 img
        <img src={image} width={320} height={320} style={{ objectFit: "cover", border: `1px solid ${OG.hairline}` }} alt="" />
      ) : (
        <div style={{ display: "flex", width: 320, height: 320, background: STRIPES, border: `1px solid ${OG.hairline}` }} />
      )}
      <div
        style={{
          marginTop: 28,
          paddingTop: 18,
          borderTop: `2px solid ${OG.ink950}`,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: SERIF_FAMILY, fontSize: 44, lineHeight: 1, fontWeight: 700, color: OG.ink950, letterSpacing: "0.04em" }}>
          {podcast.headline}
        </span>
        {podcast.show ? (
          <span style={{ fontFamily: SANS_FAMILY, fontSize: 22, color: OG.ink600 }}>{podcast.show}</span>
        ) : null}
      </div>
      {podcast.episodeTitle ? (
        <span style={{ marginTop: 14, fontFamily: SERIF_FAMILY, fontWeight: 600, fontSize: 26, color: OG.ink800 }}>
          {podcast.episodeTitle}
        </span>
      ) : null}
    </div>
  );
}
