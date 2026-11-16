/**
 * 在哪看／去哪買票／官網（散場之前 C）：純展示，server／client 皆可用；缺連結時附「你知道？告訴我們」。
 * - compact：記一筆選定作品後的一行（文字鈕最多三顆）
 * - 預設：資訊欄裡的一區（演出／展覽的買票與官網；影劇缺連結時的搜尋與補資料）
 */

import type { WorkLink, WorkLinksView } from "@/lib/links/types";
import { isRealLink, tellUsKinds } from "@/lib/links/merge";
import type { WorkKind } from "@/lib/works/format";
import { LinkChip, LinkRow } from "./link-parts";
import { TellUs } from "./tell-us";

interface WorkLinksProps {
  workId: string;
  workKind: WorkKind;
  links: WorkLinksView;
  compact?: boolean;
  onAdded?: (link: WorkLink) => void;
}

const COMPACT_LIMIT = 3;
const SEARCH_ROW_LIMIT = 2;

function isOnSiteKind(kind: WorkKind): boolean {
  return kind === "live" || kind === "exhibition";
}

function headingFor(kind: WorkKind): string {
  return isOnSiteKind(kind) ? "去哪買票" : "在哪看";
}

function missingLine(kind: WorkKind): string {
  return isOnSiteKind(kind) ? "還不知道去哪買票" : "還不知道在哪看";
}

function allLinks(kind: WorkKind, links: WorkLinksView): WorkLink[] {
  const ordered = isOnSiteKind(kind)
    ? [...links.ticket, ...links.official]
    : [...links.watch, ...links.ticket, ...links.official];
  return [...ordered.filter(isRealLink), ...ordered.filter((link) => !isRealLink(link))];
}

export function WorkLinks({ workId, workKind, links, compact = false, onAdded }: WorkLinksProps) {
  const kinds = tellUsKinds(workKind);
  if (kinds.length === 0) return null;
  const ordered = allLinks(workKind, links);
  if (compact) {
    return (
      <div aria-label={headingFor(workKind)} className="mx-4 mt-2 flex flex-col">
        <div className="flex flex-wrap items-center gap-x-4">
          <span className="text-eyebrow font-bold tracking-[0.16em] text-ink-600">{headingFor(workKind)}</span>
          {ordered.slice(0, COMPACT_LIMIT).map((link) => (
            <LinkChip key={`${link.kind}:${link.source}`} link={link} />
          ))}
        </div>
        {links.missing ? (
          <div className="flex flex-wrap items-center gap-x-3">
            <span className="text-caption text-ink-700">{missingLine(workKind)}</span>
            <TellUs workId={workId} kinds={kinds} onAdded={onAdded} />
          </div>
        ) : null}
      </div>
    );
  }

  const onSite = isOnSiteKind(workKind);
  // 影劇的真連結已在「在哪看」列表裡；這裡只補缺口
  if (!onSite && !links.missing) return null;
  const real = onSite ? ordered.filter(isRealLink) : [];
  const search = ordered.filter((link) => !isRealLink(link)).slice(0, SEARCH_ROW_LIMIT);
  return (
    <section aria-label={onSite ? "去哪買票" : "找找在哪看"}>
      {onSite ? (
        <div className="mt-[18px] flex items-baseline justify-between border-t border-ink-200 pt-3.5">
          <h3 className="m-0 text-lede font-bold tracking-[0.06em] text-ink-950">去哪買票</h3>
          <span className="text-eyebrow text-ink-600">售票・官網</span>
        </div>
      ) : null}
      {/* 影劇缺連結時「在哪看」已寫「查不到線上平台」，這裡不重複 */}
      {links.missing && onSite ? (
        <div className="mt-1.5 flex min-h-12 flex-col justify-center border-b border-ink-200 py-2">
          <span className="font-serif-tc text-lede text-ink-800">{missingLine(workKind)}，先搜搜看：</span>
        </div>
      ) : null}
      <nav aria-label={onSite ? "售票與官網" : "搜尋平台"} className="flex flex-col">
        {[...real, ...search].map((link) => (
          <LinkRow key={`${link.kind}:${link.source}`} link={link} />
        ))}
      </nav>
      {links.missing ? <TellUs workId={workId} kinds={kinds} onAdded={onAdded} /> : null}
      {onSite ? <p className="mt-2.5 mb-0 text-eyebrow leading-[1.7] text-ink-600">票況與場次以各售票站為準。</p> : null}
    </section>
  );
}
