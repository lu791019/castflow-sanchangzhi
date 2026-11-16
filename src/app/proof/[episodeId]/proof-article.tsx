"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import {
  isModified,
  paragraphNumber,
  proofQuoteAfter,
  splitLede,
  type ProofDoc,
  type ProofTarget,
} from "@/lib/proof/document";
import type { ArticleBlock } from "@/lib/share/article";

export interface ProofArticleProps {
  doc: ProofDoc;
  original: ProofDoc;
  editing: ProofTarget | null;
  byline: string;
  quote: string | null;
  onEdit: (target: ProofTarget) => void;
  onChange: (target: ProofTarget, text: string) => void;
  onRevert: (target: ProofTarget) => void;
  onDone: () => void;
}

function sameTarget(a: ProofTarget | null, b: ProofTarget): boolean {
  if (!a) return false;
  if (a.kind === "title" || b.kind === "title") return a.kind === b.kind;
  return a.index === b.index;
}

function CropMarks() {
  const base = "absolute block size-3.5 border-ink-300";
  return (
    <>
      <span aria-hidden="true" className={`${base} top-0 left-0 border-t border-l`} />
      <span aria-hidden="true" className={`${base} top-0 right-0 border-t border-r`} />
      <span aria-hidden="true" className={`${base} bottom-0 left-0 border-b border-l`} />
      <span aria-hidden="true" className={`${base} right-0 bottom-0 border-r border-b`} />
    </>
  );
}

function EndMark() {
  return <span aria-hidden="true" className="ml-1.5 inline-block size-2 bg-ember align-[1px]" />;
}

function editLabel(doc: ProofDoc, target: ProofTarget, ledeIndex: number | null): string {
  if (target.kind === "title") return "編輯標題";
  if (target.index === ledeIndex) return "編輯副標";
  if (doc.blocks[target.index]?.type === "heading") return "編輯小標";
  return `編輯第 ${paragraphNumber(doc, target.index)} 段`;
}

interface EditorProps {
  text: string;
  label: string;
  modified: boolean;
  textClassName: string;
  onChange: (text: string) => void;
  onRevert: () => void;
  onDone: () => void;
}

/** 正在編輯的段落：ember-50 底 + 左側燒橙線，下方「編輯第 n 段・已修改・還原・完成」 */
function InlineEditor({ text, label, modified, textClassName, onChange, onRevert, onDone }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") onDone();
  };

  return (
    <div className="-mx-2.5 mb-[1.2em] rounded-[4px] bg-ember-tint px-2.5 pt-2.5 pb-2 shadow-[inset_2px_0_0_var(--color-ember)]">
      <textarea
        ref={ref}
        value={text}
        aria-label={label}
        rows={1}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className={`proof-editable block w-full resize-none overflow-hidden border-0 bg-transparent p-0 caret-ember outline-none ${textClassName}`}
      />
      <div className="mt-2.5 flex items-center justify-between text-caption">
        <span className="text-ember-deep">
          {label}
          {modified ? "・已修改" : ""}
        </span>
        <span className="flex gap-1">
          {modified ? (
            <button type="button" onClick={onRevert} className="min-h-11 px-3 text-note text-ink-700">
              還原
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDone}
            className="min-h-11 rounded-[4px] bg-ink-950 px-4 text-note font-bold text-paper"
          >
            完成
          </button>
        </span>
      </div>
    </div>
  );
}

interface TappableProps {
  as: "h1" | "h2" | "p";
  className: string;
  label: string;
  modified: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}

/** 可點擊就地編輯的文字；已修改的段落右下角留一個小標記 */
function Tappable({ as: Tag, className, label, modified, onEdit, children }: TappableProps) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEdit();
    }
  };
  return (
    <Tag
      role="button"
      tabIndex={0}
      aria-label={`${label}（點一下修改）`}
      onClick={onEdit}
      onKeyDown={onKeyDown}
      className={`cursor-text rounded-[2px] outline-none focus-visible:shadow-[0_0_0_2px_var(--color-ember-tint-2)] ${className}`}
    >
      {children}
      {modified ? (
        <span className="ml-1.5 align-[2px] text-eyebrow font-normal tracking-normal text-ember-deep">已修改</span>
      ) : null}
    </Tag>
  );
}

function ProofQuote({ quote }: { quote: string }) {
  return (
    <aside className="my-7">
      <span aria-hidden="true" className="block h-[30px] font-serif-tc text-[56px] leading-[0.6] text-ember">
        「
      </span>
      <p className="m-0 font-serif-tc text-quote leading-[1.65] font-semibold text-ink-950">{quote}</p>
      <span className="mt-2 block text-eyebrow text-ink-600">引言・可在下方更換</span>
    </aside>
  );
}

const BODY_TEXT = "font-sans-tc text-prose leading-[1.9] tracking-[0.035em] text-ink-900";
const TITLE_TEXT = "font-serif-tc text-headline leading-[1.38] font-bold text-ink-950";
const LEDE_TEXT = "font-sans-tc text-lede leading-[1.8] text-ink-700";
const HEADING_TEXT = "font-serif-tc text-section leading-[1.5] font-bold text-ink-950";

/** 校樣本體：文章頁版式（裁切線、隨筆眉標、標題/副標/署名、正文 + 引言） */
export function ProofArticle(props: ProofArticleProps) {
  const { doc, original, editing, quote } = props;
  const { ledeIndex, bodyStart } = splitLede(doc);
  const quoteAfter = proofQuoteAfter(doc);
  const bodyBlocks = doc.blocks.slice(bodyStart);
  const lastParagraph = doc.blocks.reduce(
    (last, block, index) => (block.type === "paragraph" ? index : last),
    -1,
  );

  const renderEditable = (target: ProofTarget, text: string, textClassName: string, tag: "h1" | "h2" | "p", extra = "") => {
    const label = editLabel(doc, target, ledeIndex);
    const modified = isModified(original, doc, target);
    if (sameTarget(editing, target)) {
      return (
        <InlineEditor
          text={text}
          label={label}
          modified={modified}
          textClassName={textClassName}
          onChange={(value) => props.onChange(target, value)}
          onRevert={() => props.onRevert(target)}
          onDone={props.onDone}
        />
      );
    }
    return (
      <Tappable as={tag} className={`${textClassName} ${extra}`} label={label} modified={modified} onEdit={() => props.onEdit(target)}>
        {text}
        {target.kind === "block" && target.index === lastParagraph ? <EndMark /> : null}
      </Tappable>
    );
  };

  const renderBlock = (block: ArticleBlock, index: number) => {
    const target: ProofTarget = { kind: "block", index };
    if (block.type === "list") {
      return (
        <ul className="mt-0 mb-[1.2em] list-none pl-0">
          {block.items.map((item, itemIndex) => (
            <li
              key={`${itemIndex}-${item}`}
              className="relative pl-5 before:absolute before:top-[0.9em] before:left-0 before:h-px before:w-3 before:bg-ember"
            >
              {item}
            </li>
          ))}
        </ul>
      );
    }
    if (block.type === "heading") {
      return renderEditable(target, block.text, HEADING_TEXT, "h2", "mt-8 mb-4");
    }
    return renderEditable(target, block.text, BODY_TEXT, "p", "mt-0 mb-[1.2em] text-justify");
  };

  return (
    <article className="relative mx-4 mt-[22px] px-3.5 pt-[26px] pb-[30px]">
      <CropMarks />
      <div className="flex items-baseline justify-between">
        <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">散場之後・隨筆</span>
        <span className="text-eyebrow text-ink-600">點文字即可修改</span>
      </div>

      <div className="mt-3.5">{renderEditable({ kind: "title" }, doc.title, TITLE_TEXT, "h1", "m-0")}</div>

      {ledeIndex !== null && doc.blocks[ledeIndex]?.type === "paragraph" ? (
        <div className="mt-3">
          {renderEditable({ kind: "block", index: ledeIndex }, (doc.blocks[ledeIndex] as { text: string }).text, LEDE_TEXT, "p", "m-0")}
        </div>
      ) : null}

      <p className="mt-4 mb-0 border-y border-ink-200 py-2.5 text-caption text-ink-600">{props.byline}</p>

      <div className={`mt-[22px] ${BODY_TEXT}`}>
        {bodyBlocks.map((block, offset) => {
          const index = bodyStart + offset;
          return (
            <div key={index}>
              {renderBlock(block, index)}
              {quote && offset + 1 === quoteAfter ? <ProofQuote quote={quote} /> : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}
