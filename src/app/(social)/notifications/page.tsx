import type { Metadata } from "next";
import Link from "next/link";
import { ChevronIcon, HATCH_BG } from "@/components/journal/icons";
import { requirePageUserId } from "@/lib/auth/page";
import { buildInbox, type InboxItem, type InboxSection } from "@/lib/notifications/inbox";
import { toInboxSource } from "@/lib/notifications/inbox-row";
import { listInboxRows } from "@/lib/notifications/repository";
import { InboxActions } from "./inbox-actions";
import { ListenActions } from "./listen-actions";
import { FallbackImg } from "@/components/ui/fallback-img";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "收件匣｜散場誌",
};

const RESULT_LABELS: Record<InboxItem["result"], string> = {
  pending: "還沒說",
  said: "說成了一篇",
  skipped: "只記不說",
  planned: "計畫中",
};

const RESULT_TONES: Record<InboxItem["result"], string> = {
  pending: "text-ink-700",
  said: "font-bold text-ember-dark",
  skipped: "text-entry-skipped-status",
  planned: "text-ember-dark",
};

function Cover({ item }: { item: InboxItem }) {
  const hatch = <span aria-hidden="true" className="block h-[60px] w-10" style={{ background: HATCH_BG }} />;
  // 海報載入失敗退回斜線底（同沒海報的樣子）
  if (item.posterUrl) return <FallbackImg src={item.posterUrl} className="block h-[60px] w-10 object-cover" fallback={hatch} />;
  if (item.cover === "poster") return hatch;
  return <span aria-hidden="true" className="block size-10 border-t-2 border-b border-ink-950 bg-paper-2" />;
}

function ActionableRow({ item }: { item: InboxItem }) {
  return (
    <div className="grid grid-cols-[10px_40px_minmax(0,1fr)] gap-x-2.5 border-b border-ink-200 py-4">
      <span aria-label={item.unread ? "未讀" : undefined} className={`mt-2 block size-1.5 rounded-full bg-unread-dot ${item.unread ? "" : "opacity-0"}`} />
      <Cover item={item} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-serif-tc text-lede leading-[1.6] font-bold text-ink-950">{item.line}</span>
        <span className="text-eyebrow text-ink-600">{item.meta}</span>
        {item.journalId && item.sayHref ? (
          <InboxActions notificationId={item.id} journalId={item.journalId} sayHref={item.sayHref} />
        ) : null}
        {!item.journalId && item.logHref ? <ListenActions notificationId={item.id} logHref={item.logHref} /> : null}
      </div>
    </div>
  );
}

function SettledRow({ item }: { item: InboxItem }) {
  return (
    <div className="grid grid-cols-[10px_40px_minmax(0,1fr)_auto] items-center gap-x-2.5 border-b border-ink-200 py-3.5">
      <span />
      <Cover item={item} />
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="font-serif-tc text-lede leading-[1.55] text-ink-700">{item.line}</span>
        <span className="text-eyebrow text-ink-600">{item.meta}</span>
      </span>
      {item.journalId ? <span className={`text-caption ${RESULT_TONES[item.result]}`}>{RESULT_LABELS[item.result]}</span> : null}
    </div>
  );
}

function Section({ section, unreadCount, first }: { section: InboxSection; unreadCount: number; first: boolean }) {
  return (
    <section className={first ? "mt-[18px]" : "mt-6"}>
      <div className="flex items-baseline justify-between border-b border-ink-950 pb-1.5">
        <h2 className="m-0 font-serif-tc text-prose font-bold text-ink-950">{section.label}</h2>
        {first && unreadCount ? <span className="text-eyebrow text-ink-600">{unreadCount} 則未讀</span> : null}
      </div>
      <div className="p4-stagger">
        {section.items.map((item) =>
          item.actionable ? <ActionableRow key={item.id} item={item} /> : <SettledRow key={item.id} item={item} />,
        )}
      </div>
    </section>
  );
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center px-8 pt-[120px] text-center">
      <div aria-hidden="true" className="relative flex h-[72px] w-[120px] items-center justify-center rounded-control border border-ink-300">
        <span className="absolute top-[29px] -left-[7px] block size-3.5 rounded-full border-r border-ink-300 bg-paper" />
        <span className="absolute top-[29px] -right-[7px] block size-3.5 rounded-full border-l border-ink-300 bg-paper" />
        <span className="pl-[0.3em] text-eyebrow tracking-[0.3em] text-ink-300">今日無事</span>
      </div>
      <h2 className="mt-7 mb-0 font-serif-tc text-section leading-[1.6] font-bold text-ink-950">沒有需要回覆的提醒。</h2>
      <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">記一筆之後，隔天中午會在這裡輕輕問你一次。</p>
      <Link href="/journal" className="mt-5 flex min-h-11 items-center text-note font-bold text-ember-dark no-underline">
        翻翻這個月的日誌 →
      </Link>
    </div>
  );
}

/** 收件匣（設計稿「收件匣 A/B」）：看完隔天問一次；處理過的收進「這週稍早」 */
export default async function NotificationsPage() {
  const userId = await requirePageUserId("/notifications");
  const inbox = buildInbox((await listInboxRows(userId)).map(toInboxSource), new Date());
  return (
    <div className="min-h-dvh pb-10">
      <header className="mx-4 grid h-[52px] grid-cols-[1fr_auto_1fr] items-center border-b border-ink-950">
        <Link href="/journal" aria-label="返回日誌" className="-ml-3 flex size-11 items-center justify-center justify-self-start text-ink-950">
          <ChevronIcon dir="left" size={20} />
        </Link>
        <h1 className="m-0 font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">收件匣</h1>
        <Link href="/me/settings" className="flex min-h-11 items-center justify-self-end text-caption text-ink-700 no-underline">
          提醒設定
        </Link>
      </header>
      {inbox.sections.length === 0 ? (
        <EmptyInbox />
      ) : (
        <div className="px-4">
          <p className="mt-3.5 mb-0 text-caption leading-[1.7] text-ink-600">看完之後隔天，我們會在這裡問你一次。處理過的會自己收起來。</p>
          {inbox.sections.map((section, index) => (
            <Section key={section.key} section={section} unreadCount={inbox.unreadCount} first={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
