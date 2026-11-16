import type { CSSProperties } from "react";
import type { OgCardModel } from "@/lib/share/og-model";
import { OG, SERIF_FAMILY } from "./tokens";

/** 署名印章 40px（token seal：OG 署名用 40；形狀依 P3 印章規則，Satori 畫不出的切角／斜線退成方章） */
function sealBox(shape: number): CSSProperties {
  const base: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    border: `1.5px solid ${OG.ink900}`,
    borderRadius: 2,
    color: OG.ink900,
    fontFamily: SERIF_FAMILY,
    fontWeight: 700,
    lineHeight: 1,
  };
  if (shape === 1) return { ...base, borderRadius: 20 };
  if (shape === 2) return { ...base, boxShadow: `inset 0 0 0 2px ${OG.paper}, inset 0 0 0 3px ${OG.ink900}` };
  if (shape === 4) return { ...base, background: OG.ink900, color: OG.paper };
  if (shape === 5) return { ...base, height: 34, borderRadius: 20 };
  if (shape === 7) return { ...base, flexWrap: "wrap", alignContent: "center", padding: 3 };
  return base;
}

export function OgSeal({ seal }: { seal: NonNullable<OgCardModel["seal"]> }) {
  const quad = seal.chars.length === 4;
  return (
    <div style={sealBox(seal.shape)}>
      {seal.chars.map((char, index) => (
        <span
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: quad ? 15 : 37,
            height: quad ? 15 : 37,
            fontSize: quad ? 13 : 22,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
