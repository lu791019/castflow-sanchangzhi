import type { ReactNode } from "react";
import type { ArticleBlock } from "@/lib/share/article";
import { ResonantPassage } from "@/components/resonance/resonant-passage";
import { ColumnGroups } from "@/components/wide/column-groups";
import { PullQuote } from "./pull-quote";

interface ArticleBodyProps {
  blocks: ArticleBlock[];
  pullQuote?: string | null;
  quoteAuthor?: string | null;
  quoteAfter: number;
  /** 共鳴（P3）：block 位置 → 段雜湊；有給時段落可長按留「這句我也是」，正文留出句邊欄。需包在 ResonanceProvider 內 */
  passageHashes?: Record<number, string>;
  /** 寬螢幕正文多欄、每組限欄高（components/wide/column-groups.tsx）；手機不受影響 */
  wideColumns?: boolean;
}

/**
 * 段距：每段各包一層 div（後面可能接引言），`last:` 會套到每一段，所以只有整篇最後一段不留段距。
 */
const PARAGRAPH_CLASS = "mt-0 mb-[1.2em]";
const LAST_PARAGRAPH_CLASS = "mt-0 mb-0";

/** 段落外殼：有雜湊 → 可留記號的段；沒有 → 一般 <p> */
function Paragraph({
  hash,
  className,
  children,
  trailing,
}: {
  hash?: string;
  className: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  if (hash) {
    return (
      <ResonantPassage hash={hash} className={className} trailing={trailing}>
        {children}
      </ResonantPassage>
    );
  }
  return (
    <p className={className}>
      {children}
      {trailing}
    </p>
  );
}

function DropCapParagraph({ text, hash }: { text: string; hash?: string }) {
  const chars = Array.from(text);
  return (
    <Paragraph hash={hash} className="mt-0 mb-[1.2em]">
      {/* 寬版（Q-60）首字再放大（雛型 104px） */}
      <span className="float-left mt-1.5 mr-2.5 font-serif-tc text-[60px] leading-[0.92] font-bold text-ink-950 lg:mt-2 lg:mr-3.5 lg:text-[104px] lg:leading-[0.86] lg:font-black">
        {chars[0]}
      </span>
      {chars.slice(1).join("")}
    </Paragraph>
  );
}

function EndMark() {
  return (
    <span
      aria-hidden="true"
      className="ml-1.5 inline-block size-2 bg-ember align-[1px]"
    />
  );
}

/** 正文：首段 drop cap、尾段紅方塊收筆、指定位置插入 pull quote */
export function ArticleBody({
  blocks,
  pullQuote,
  quoteAuthor,
  quoteAfter,
  passageHashes,
  wideColumns = false,
}: ArticleBodyProps) {
  const firstParagraph = blocks.findIndex((block) => block.type === "paragraph");
  const lastParagraph = blocks.reduce(
    (last, block, index) => (block.type === "paragraph" ? index : last),
    -1,
  );

  const nodes = blocks.map((block, index) => {
    const quote =
      pullQuote && index + 1 === quoteAfter ? (
        <PullQuote quote={pullQuote} author={quoteAuthor} />
      ) : null;
    if (block.type === "heading") {
      return (
        <div key={index}>
          <h2 className="mt-10 mb-4 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">
            {block.text}
          </h2>
          {quote}
        </div>
      );
    }
    if (block.type === "list") {
      return (
        <div key={index}>
          <ul className="mt-0 mb-[1.2em] list-none pl-0">
            {block.items.map((item) => (
              <li
                key={item}
                className="relative pl-5 before:absolute before:top-[0.9em] before:left-0 before:h-px before:w-3 before:bg-ember"
              >
                {item}
              </li>
            ))}
          </ul>
          {quote}
        </div>
      );
    }
    if (index === firstParagraph && block.text.length > 1) {
      return (
        <div key={index}>
          <DropCapParagraph text={block.text} hash={passageHashes?.[index]} />
          {quote}
        </div>
      );
    }
    return (
      <div key={index}>
        <Paragraph
          hash={passageHashes?.[index]}
          className={index === blocks.length - 1 && !quote ? LAST_PARAGRAPH_CLASS : PARAGRAPH_CLASS}
          trailing={index === lastParagraph ? <EndMark /> : null}
        >
          {block.text}
        </Paragraph>
        {quote}
      </div>
    );
  });

  return (
    <article
      className={`mt-9 text-justify ${passageHashes ? "pr-1 pl-3" : ""} text-prose leading-[1.9] tracking-[0.035em] text-ink-900`}
    >
      {wideColumns ? <ColumnGroups>{nodes}</ColumnGroups> : nodes}
    </article>
  );
}
