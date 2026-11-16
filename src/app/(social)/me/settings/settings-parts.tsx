import Link from "next/link";

export function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

/** 頁首：返回 + 明體置中標題 */
export function PageHeader({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <header className="mx-4 grid h-[52px] grid-cols-[1fr_auto_1fr] items-center border-b border-ink-950">
      <Link href={backHref} aria-label={backLabel} className="-ml-3 flex size-11 items-center justify-center justify-self-start text-ink-950">
        <BackIcon />
      </Link>
      <h1 className="m-0 font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">{title}</h1>
      <span />
    </header>
  );
}

/** settings.section.head：上 2px ink-950 線＋國字序號 15 燒橙＋明體 17；右側 11 欄目說明 */
export function SectionHead({ id, no, title, note }: { id: string; no: string; title: string; note: string }) {
  return (
    <div className="flex items-baseline gap-2.5 border-t-2 border-ink-950 pt-3">
      <span aria-hidden="true" className="font-serif-tc text-lede font-bold text-ember-dark">
        {no}
      </span>
      <h2 id={id} className="m-0 font-serif-tc text-prose font-bold text-ink-950">
        {title}
      </h2>
      <span className="ml-auto text-eyebrow text-ink-600 tabular-nums">{note}</span>
    </div>
  );
}

const ROW = "flex min-h-[52px] items-center justify-between gap-3 border-b border-ink-200 text-lede text-ink-950 no-underline";

/** settings.row：左標籤 15、右目前值 13 ink-600；有 href 才是可點的列（帶箭頭） */
export function SettingsRow({
  label,
  sub,
  value,
  href,
}: {
  label: string;
  sub?: string;
  value?: React.ReactNode;
  href?: string;
}) {
  const left = sub ? (
    <span className="flex flex-col gap-0.5 py-2.5">
      <span>{label}</span>
      <span className="text-caption leading-[1.6] text-ink-600">{sub}</span>
    </span>
  ) : (
    <span>{label}</span>
  );
  const right = (
    <span className="flex flex-none items-center gap-2 text-note text-ink-600">
      {value}
      {href ? <ChevronIcon /> : null}
    </span>
  );
  if (!href) {
    return (
      <div className={ROW}>
        {left}
        {right}
      </div>
    );
  }
  return (
    <Link href={href} className={`${ROW} ${sub ? "min-h-16" : ""}`}>
      {left}
      {right}
    </Link>
  );
}
