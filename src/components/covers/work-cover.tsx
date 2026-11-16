/**
 * 作品封面（封面補齊，Dex 10/13 晚：海報要留但不能空）。目錄、索引、散場之前、作品特輯、場刊共用。
 * 有圖放圖（失敗退字卡）；沒圖一律「字卡封面」：紙底、墨線框（上緣 2px）、直排作品名，
 * 場外下方加場地與日期——展覽多一圈細框，演出日期壓在圓章裡，跟印章風格一致。不再出現空的斜線紋。
 * 音樂（專輯，1:1）：左下角是唱片圈（兩道細圓），取代影劇／Podcast 的燒橙小方塊。
 */

import { VerticalDigits } from "@/components/ui/vertical-digits";
import { coverModel, type CoverInput, type CoverModel, type CoverSize } from "@/lib/covers/cover";
import { CoverImage } from "./cover-image";

interface WorkCoverProps {
  cover: CoverInput;
  size: CoverSize;
  /** 尺寸與版位（寬高、絕對定位等） */
  className: string;
  /** 字卡左上的燒橙直排小字（期號、演出日期）；圖片時不顯示 */
  mark?: string;
  /** 圖片的替代文字；裝飾用途（旁邊已有作品名）留空 */
  alt?: string;
  eager?: boolean;
  /** 字卡底色：預設 paper-2；放在 paper-2 色帶上（場刊）用 paper */
  surface?: "paper" | "paper-2";
}

type CardModel = Extract<CoverModel, { type: "card" }>;

const TITLE_TEXT: Record<CoverSize, string> = {
  xs: "text-[10px] tracking-[0.04em]",
  sm: "text-[12px] tracking-[0.08em]",
  md: "text-[15px] tracking-[0.12em]",
  lg: "text-[19px] tracking-[0.16em]",
  xl: "text-[30px] tracking-[0.2em]",
};

/** 英文為主的片名橫排（UX-25）：字級比直排小一階，長字可在任意處換行，超過行數收刪節號 */
const HORIZONTAL_TEXT: Record<CoverSize, string> = {
  xs: "text-[9px] line-clamp-2",
  sm: "text-[11px] line-clamp-3",
  md: "text-[13px] line-clamp-3",
  lg: "text-[16px] line-clamp-4",
  xl: "text-[24px] line-clamp-4",
};

function CardTitle({ model, size }: { model: CardModel; size: CoverSize }) {
  if (model.orientation === "horizontal") {
    return (
      <span
        data-title-orientation="horizontal"
        className={`min-w-0 flex-1 text-right font-serif-tc leading-[1.2] font-bold tracking-[0.02em] break-words text-ink-950 [overflow-wrap:anywhere] ${HORIZONTAL_TEXT[size]}`}
      >
        {model.columns[0]}
      </span>
    );
  }
  return (
    <span className={`flex min-h-0 flex-row-reverse gap-[0.2em] font-serif-tc leading-[1.15] font-bold text-ink-950 ${TITLE_TEXT[size]}`}>
      {model.columns.map((column, index) => (
        <span key={index} className="[writing-mode:vertical-rl]">
          {column}
        </span>
      ))}
    </span>
  );
}

const DETAIL_TEXT: Record<CoverSize, string> = {
  xs: "",
  sm: "",
  md: "text-[9px]",
  lg: "text-[11px]",
  xl: "text-[13px]",
};

const SEAL_SIZE: Record<CoverSize, string> = {
  xs: "",
  sm: "",
  md: "size-[30px] text-[8px]",
  lg: "size-[38px] text-[10px]",
  xl: "size-[52px] text-[12px]",
};

function LiveSeal({ date, size }: { date: string; size: CoverSize }) {
  const [start] = date.split(" – ");
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full border-[1.5px] border-ember-dark font-serif-tc leading-none font-bold text-ember-dark tabular-nums ${SEAL_SIZE[size]}`}
    >
      {start}
    </span>
  );
}

function CardDetails({ model, size }: { model: CardModel; size: CoverSize }) {
  if (!model.venue && !model.date) return null;
  const live = model.style === "live";
  return (
    <div className={`relative flex items-end gap-1.5 border-t border-ink-300 pt-1 ${DETAIL_TEXT[size]}`}>
      {live && model.date ? <LiveSeal date={model.date} size={size} /> : null}
      <span className="flex min-w-0 flex-col gap-px leading-[1.3] text-ink-700">
        {model.venue ? <span className="truncate">{model.venue}</span> : null}
        {model.date && !live ? <span className="text-ink-600 tabular-nums">{model.date}</span> : null}
        {model.date && live && model.date.includes(" – ") ? (
          <span className="text-ink-600 tabular-nums">{model.date}</span>
        ) : null}
      </span>
    </div>
  );
}

function TypeCard({ model, size, className, mark, surface }: { model: CardModel; size: CoverSize } & Pick<WorkCoverProps, "className" | "mark" | "surface">) {
  const roomy = size !== "xs" && size !== "sm";
  return (
    <span
      role="img"
      aria-label={`${model.columns.join("")}（${model.label}字卡）`}
      data-cover="card"
      data-cover-style={model.style}
      className={`relative box-border flex flex-none flex-col overflow-hidden border border-t-2 border-ink-950 ${
        surface === "paper" ? "bg-paper" : "bg-paper-2"
      } ${roomy ? "p-2" : "p-1"} ${className}`}
    >
      {model.style === "exhibition" ? (
        <span aria-hidden="true" className={`pointer-events-none absolute border-[0.5px] border-ink-600 ${roomy ? "inset-[4px]" : "inset-[2px]"}`} />
      ) : null}
      <span className="relative flex min-h-0 flex-1 justify-between gap-1">
        <span className="flex flex-col items-start justify-between">
          {mark && roomy ? (
            <span className={`text-ember-dark [writing-mode:vertical-rl] ${DETAIL_TEXT[size]} tracking-[0.2em]`}>
              <VerticalDigits text={mark} />
            </span>
          ) : roomy ? (
            <span className={`text-ink-600 [writing-mode:vertical-rl] ${DETAIL_TEXT[size]} tracking-[0.2em]`}>{model.label}</span>
          ) : (
            <span />
          )}
          {model.style === "screen" || model.style === "podcast" ? (
            <span aria-hidden="true" className={`block bg-ember ${roomy ? "size-2" : "size-1"}`} />
          ) : model.style === "music" ? (
            <span
              aria-hidden="true"
              data-cover-mark="record"
              className={`flex items-center justify-center rounded-full border border-ink-950 ${roomy ? "size-4" : "size-2.5"}`}
            >
              <span className="block size-1 rounded-full bg-ember" />
            </span>
          ) : null}
        </span>
        <CardTitle model={model} size={size} />
      </span>
      {roomy ? <CardDetails model={model} size={size} /> : null}
    </span>
  );
}

export function WorkCover({ cover, size, className, mark, alt = "", eager, surface = "paper-2" }: WorkCoverProps) {
  const model = coverModel(cover, size);
  const card = (fallbackModel: CardModel) => (
    <TypeCard model={fallbackModel} size={size} className={className} mark={mark} surface={surface} />
  );
  if (model.type === "card") return card(model);
  return (
    <CoverImage
      url={model.url}
      alt={alt}
      eager={eager}
      className={className}
      fallback={card(coverModel({ ...cover, posterUrl: null }, size) as CardModel)}
    />
  );
}
