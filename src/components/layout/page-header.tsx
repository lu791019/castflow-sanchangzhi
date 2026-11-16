import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/** 頁首：eyebrow 小標 + 明體標題 + 髮絲線收尾，右側可放主要動作 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-ink-200 pb-5">
      <div className="min-w-0">
        <p className="m-0 text-eyebrow font-bold tracking-[0.2em] text-ember-dark">
          {eyebrow}
        </p>
        <h1 className="mt-2 mb-0 font-serif-tc text-[26px] leading-[1.3] font-bold tracking-[0.01em] text-ink-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 mb-0 text-note text-ink-600">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-none items-center gap-2 pb-1">{actions}</div>
      ) : null}
    </div>
  );
}

interface SectionHeadingProps {
  title: string;
  aside?: ReactNode;
}

/** 區塊標題列：明體標題 + 底部墨色實線（雜誌欄目開頭），右側可放動作或註記 */
export function SectionHeading({ title, aside }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-950 pb-2">
      <h2 className="m-0 font-serif-tc text-[18px] font-bold text-ink-950">
        {title}
      </h2>
      {aside ? <div className="flex items-center gap-2">{aside}</div> : null}
    </div>
  );
}
