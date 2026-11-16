/**
 * 「大家最有共鳴的一句」（P3 作品特輯 A/B/C，resonance.layout）：
 * 兩句以上直排、依共鳴排序，第一句下方列出「阿哲、Kai 和另外 9 人也這樣想」；
 * 只有一句橫排並留「等第二句」格；零句用稿紙空行。
 */

import { VerticalDigits } from "@/components/ui/vertical-digits";
import { PenSeal } from "@/components/seal/pen-seal";
import { verticalQuoteText, type FeatureQuoteCandidate, type FeatureResonanceLayout, type ResonanceSource } from "@/lib/resonance/feature";
import { dayLabel } from "@/lib/resonance/week";

interface FeatureResonanceProps {
  layout: FeatureResonanceLayout;
  source: ResonanceSource | null;
  /** 「《花樣年華》」或「《慢慢說》第 121 集」 */
  workName: string;
  /** 零句文案：「這一集」／「這部作品」 */
  subjectLabel: string;
  verb: "看" | "聽";
}

function VerticalQuote({ item, rank, isLast }: { item: FeatureQuoteCandidate; rank: number; isLast: boolean }) {
  const isFirst = rank === 0;
  return (
    <div className={isLast ? "" : "ml-3 border-l border-ink-200 pl-3"}>
      <span className={`ml-2 block font-serif-tc text-note leading-[1.6] font-bold ${isFirst ? "text-ember-dark" : "text-ink-600"}`}>
        <VerticalDigits text={String(rank + 1)} />
      </span>
      {isFirst ? (
        <p className="m-0 font-serif-tc text-quote leading-[1.5] font-semibold tracking-[0.06em] text-ink-950">
          <span className="text-ember">「</span>
          {verticalQuoteText(item.text)}
          <span className="text-ember">」</span>
        </p>
      ) : (
        <p className="m-0 font-serif-tc text-prose leading-[1.6] tracking-[0.06em] text-ink-800">「{verticalQuoteText(item.text)}」</p>
      )}
      <span className="mr-1.5 block text-end text-caption leading-[1.6] text-ink-600">——{item.author}</span>
    </div>
  );
}

function SourceLine({ source }: { source: ResonanceSource }) {
  const names = source.names.map((name, index) => (
    <span key={name}>
      {index > 0 ? "、" : null}
      <span className="font-serif-tc font-bold text-ink-950">{name}</span>
    </span>
  ));
  const others = (
    <span className="font-serif-tc font-bold text-ember-deep">{source.others}</span>
  );
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <span className="font-serif-tc text-note font-bold text-ember-dark">1</span>
      <span className="flex min-w-0 items-center gap-2">
        {source.names.length > 0 ? (
          <span className="flex gap-1">
            {source.names.map((name) => (
              <PenSeal key={name} penName={name} size={24} />
            ))}
          </span>
        ) : null}
        <span className="text-note text-ink-700" data-resonance-source>
          {names}
          {source.names.length === 0 ? <>有 {others} 人也這樣想</> : null}
          {source.names.length > 0 && source.others > 0 ? <> 和另外 {others} 人也這樣想</> : null}
          {source.names.length > 0 && source.others === 0 ? " 也這樣想" : null}
        </span>
      </span>
    </div>
  );
}

function Manuscript() {
  return (
    <div className="flex justify-center border-y border-ink-950 py-5">
      <div aria-hidden="true" className="work-manuscript relative h-[240px] w-[300px] border-r border-b border-ink-200">
        <span className="work-caret absolute top-1.5 right-[13px] block h-[18px] w-0.5 bg-ember" />
        <span className="absolute top-0 right-[30px] box-border h-[240px] w-[30px] pt-[7px] font-serif-tc text-lede leading-[30px] tracking-[15px] text-ink-300 [writing-mode:vertical-rl]">
          這一行留給你
        </span>
      </div>
    </div>
  );
}

export function FeatureResonance({ layout, source, workName, subjectLabel, verb }: FeatureResonanceProps) {
  return (
    <section className="mt-[52px]" data-feature-resonance={layout.variant}>
      <span className="text-eyebrow font-bold tracking-[0.24em] text-ember-dark">共鳴</span>
      <h2 className="mt-2 mb-0 font-serif-tc text-section font-bold text-ink-950">
        {layout.variant === "single" ? "目前只有一句" : "大家最有共鳴的一句"}
      </h2>

      {layout.variant === "empty" ? (
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

      {layout.variant === "single" ? (
        <div className="mt-5 border-y border-ink-950 pt-[22px] pb-5">
          <p className="m-0 font-serif-tc text-quote leading-[1.6] font-semibold tracking-[0.04em] text-ink-950">
            <span className="text-ember">「</span>
            {layout.quote.text}
            <span className="text-ember">」</span>
          </p>
          <span className="mt-2.5 block text-right text-caption text-ink-600">
            ——{layout.quote.author}・{dayLabel(new Date(layout.quote.publishedAt))}
          </span>
          <div className="mt-5 flex items-center gap-2.5">
            <span className="font-serif-tc text-note font-bold text-ink-600">二</span>
            <div aria-hidden="true" className="work-manuscript relative box-border h-[31px] flex-1 border-r border-b border-ink-200">
              <span className="absolute top-0 left-0 flex h-[30px] items-center pl-2 font-serif-tc text-lede tracking-[15px] text-ink-600">
                等第二句
              </span>
              <span className="work-caret absolute top-[7px] left-32 block h-[17px] w-0.5 bg-ember" />
            </div>
          </div>
          <p className="mt-3.5 mb-0 text-note leading-[1.8] text-ink-700">
            下一個說{workName}的人，他的一句會寫進這一格。兩句之後，這裡會改成直排，依共鳴排序。
          </p>
        </div>
      ) : null}

      {layout.variant === "vertical" ? (
        <>
          <div className="mt-5 flex justify-end overflow-hidden border-y border-ink-950 py-[22px]">
            <div className={`flex flex-col [writing-mode:vertical-rl] ${layout.quotes.length >= 3 ? "h-[336px]" : "h-[296px]"}`}>
              {layout.quotes.map((item, index) => (
                <VerticalQuote key={`${item.episodeId}-${index}`} item={item} rank={index} isLast={index === layout.quotes.length - 1} />
              ))}
            </div>
          </div>
          {source ? <SourceLine source={source} /> : null}
          <p className="mt-2 mb-0 text-right text-eyebrow tracking-[0.08em] text-ink-600">
            由右至左讀・{layout.quotes[0].count > 0 ? "依共鳴排序" : "依發表時間"}
          </p>
        </>
      ) : null}
    </section>
  );
}
