/** OG 卡色票與字族（設計稿 P2 OG 預覽卡原始 HTML 的色值；Satori 不吃 CSS 變數） */
export const OG = {
  paper: "#FAF8F4",
  paper2: "#F3F0EA",
  stripe: "#E9E5DE",
  hairline: "#DAD5CC",
  ink950: "#141210",
  ink900: "#1F1C19",
  ink800: "#2E2A26",
  ink700: "#4A4540",
  ink600: "#67615A",
  ink400: "#8C857D",
  ember: "#C9562A",
  emberDark: "#B4471B",
} as const;

export const SERIF_FAMILY = "Noto Serif TC";
export const SANS_FAMILY = "Noto Sans TC";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
/** og.card：左欄 400（1/3） */
export const OG_LEFT_WIDTH = 400;

export const STRIPES = `repeating-linear-gradient(135deg, ${OG.stripe} 0px, ${OG.stripe} 10px, ${OG.paper2} 10px, ${OG.paper2} 20px)`;
