import { VerticalDigits } from "@/components/ui/vertical-digits";
import type { ResonanceLayout, ResonanceQuote } from "@/lib/works/resonance";

interface ResonanceBlockProps {
  layout: ResonanceLayout;
  /** E 態下方文案用：「這一集」/「這部作品」 */
  subjectLabel: string;
  verb: "看" | "聽";
}

function VerticalQuote({
  item,
  rank,
  isLast,
}: {
  item: ResonanceQuote;
  rank: number;
  isLast: boolean;
}) {
  const isFirst = rank === 1;
  return (
    <div className={isLast ? "" : "ml-2.5 border-l border-ink-200 pl-2.5"}>
      <span
        className={`ml-2 block font-serif-tc text-note leading-[1.6] font-bold ${
          isFirst ? "text-ember-dark" : "text-ink-600"
        }`}
      >
        <VerticalDigits text={String(rank)} />
      </span>
      {isFirst ? (
        <p className="m-0 font-serif-tc text-quote leading-[1.5] font-semibold tracking-[0.06em] text-ink-950">
          <span className="text-ember">「</span>
          {item.quote}
          <span className="text-ember">」</span>
        </p>
      ) : (
        <p className="m-0 font-serif-tc text-prose leading-[1.6] tracking-[0.06em] text-ink-800">
          「{item.quote}」
        </p>
      )}
      <span className="mr-1.5 block text-end text-caption leading-[1.6] text-ink-600">
        ——{item.author}
      </span>
    </div>
  );
}

function Manuscript() {
  return (
    <div className="flex justify-center border-y border-ink-950 py-5">
      {/* manuscript.cell 30×30 · 10 欄 × 8 列 */}
      <div
        aria-hidden="true"
        className="work-manuscript relative h-[240px] w-[300px] border-r border-b border-ink-200"
      >
        <span className="work-caret absolute top-1.5 right-[13px] block h-[18px] w-0.5 bg-ember" />
        <span className="absolute top-0 right-[30px] box-border h-[240px] w-[30px] pt-[7px] font-serif-tc text-lede leading-[30px] tracking-[15px] text-ink-300 [writing-mode:vertical-rl]">
          這一行留給你
        </span>
      </div>
    </div>
  );
}

/** 「大家最有共鳴的一句」：A 三句 / B 兩句直排、C 橫排、E 空白稿紙 */
export function ResonanceBlock({ layout, subjectLabel, verb }: ResonanceBlockProps) {
  return (
    <section className="mt-[52px]">
      <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">共鳴</span>
      <h2 className="mt-2 mb-0 font-serif-tc text-section font-bold text-ink-950">
        大家最有共鳴的一句
      </h2>

      {layout.variant === "E" ? (
        <div className="mt-5">
          <Manuscript />
          <p className="mt-6 mb-0 font-serif-tc text-quote leading-[1.6] font-semibold text-ink-950">
            還沒有人說過{subjectLabel}。
            <br />
            <span className="text-ember-dark">當第一個留下聲音的人。</span>
          </p>
          <p className="mt-2.5 mb-0 text-note leading-[1.8] text-ink-700">
            你說的第一句，會被寫進這張稿紙最右邊的那一行。之後{verb}完的人，都會先讀到它。
          </p>
        </div>
      ) : null}

      {layout.variant === "C" ? (
        <div className="mt-5 border-y border-ink-950 pt-[22px] pb-5">
          <span
            aria-hidden="true"
            className="block h-[30px] font-serif-tc text-[56px] leading-[0.6] text-ember"
          >
            「
          </span>
          <p className="m-0 font-serif-tc text-quote leading-[1.65] font-semibold text-ink-950">
            {layout.quote.quote}
          </p>
          <div className="mt-3 flex justify-between gap-3 text-caption text-ink-600">
            <span>——目前唯一的一段・{layout.quote.author}</span>
            <span className="flex-none">等第二句</span>
          </div>
        </div>
      ) : null}

      {layout.variant === "A" || layout.variant === "B" ? (
        <>
          <div className="mt-5 flex justify-end overflow-hidden border-y border-ink-950 py-[22px]">
            <div
              className={`flex flex-col [writing-mode:vertical-rl] ${
                layout.variant === "A" ? "h-[336px]" : "h-[296px]"
              }`}
            >
              {layout.quotes.map((item, index) => (
                <VerticalQuote
                  key={`${item.author}-${index}`}
                  item={item}
                  rank={index + 1}
                  isLast={index === layout.quotes.length - 1}
                />
              ))}
            </div>
          </div>
          <div className="mt-2.5 flex justify-between text-eyebrow tracking-[0.08em] text-ink-600">
            {/* TODO(resonance): 共鳴數欄位上線後改「依共鳴排序」 */}
            <span>由右至左讀・依發表時間</span>
            <span>共鳴・即將開放</span>
          </div>
        </>
      ) : null}
    </section>
  );
}
