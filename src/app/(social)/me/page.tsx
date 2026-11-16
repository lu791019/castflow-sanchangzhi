import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTHOR } from "@/lib/me/profile";
import { buildMeArticles, type MeArticle, type MeStats } from "@/lib/me/me-articles";
import { getServerNotify } from "@/lib/alerts/notify";
import type { WorkKind } from "@/lib/works/format";
import { redirect } from "next/navigation";
import { loginRedirectPath } from "@/lib/auth/paths";
import { getCurrentUserId } from "@/lib/auth/session";
import { loadPenName } from "@/lib/me/pen-name";
import { columnLabel } from "@/lib/me/column-name";
import { loadColumnName } from "@/lib/me/column-name-repository";
import { signOutAction } from "@/app/auth/actions";
import { Seal } from "@/components/seal/seal";
import { loadSealGlyph } from "@/lib/seal/glyph-repository";
import { communityEnabled } from "@/lib/features";
import { MeLettersLink } from "@/components/letters/me-letters-link";
import { TourReplayCard } from "@/components/tour/tour-replay-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的｜散場誌",
};

interface MePageData {
  stats: MeStats;
  published: MeArticle[];
  draftCount: number;
}

interface MeEpisodeQueryRow {
  id: string;
  title: string;
  source: string;
  created_at: string;
  share_slug: string | null;
  published_at: string | null;
  contents: Array<{ platform: string; body: string }> | null;
  works: { kind: WorkKind; title: string } | null;
}

async function loadMePage(userId: string): Promise<MePageData> {
  const { data, error } = await createAdminClient()
    .from("episodes")
    .select("id, title, source, created_at, share_slug, published_at, contents(platform, body), works(kind, title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    await getServerNotify()("warn", "我的：讀取文章失敗", `user=${userId} ${error.message}`).catch(() => undefined);
  }
  return buildMeArticles(
    ((data ?? []) as unknown as MeEpisodeQueryRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      created_at: row.created_at,
      share_slug: row.share_slug,
      published_at: row.published_at,
      blogBody: row.contents?.find((content) => content.platform === "blog")?.body ?? null,
      work: row.works,
    })),
  );
}

function formatRowDate(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

/** 我的 › 入口：編輯檯、日誌、收件匣、設定 */
const ENTRY_LINKS = [
  { href: "/me/desk", label: "編輯檯", note: "草稿與發佈" },
  { href: "/me/import", label: "搬進舊文章", note: "" },
  { href: "/journal", label: "日誌", note: "看過、聽過的" },
  { href: "/notifications", label: "收件匣", note: "" },
  { href: "/me/settings", label: "設定", note: "" },
] as const;

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default async function MePage() {
  // proxy 已擋未登入；這裡拿 uid 只看自己的文章
  const userId = await getCurrentUserId();
  if (!userId) redirect(loginRedirectPath("/me", ""));
  const [{ stats, published, draftCount }, penName, glyph, columnName] = await Promise.all([
    loadMePage(userId),
    loadPenName(userId),
    loadSealGlyph(userId),
    loadColumnName(userId),
  ]);
  const previewRows = published.slice(0, 6);

  return (
    <>
      <header className="mx-4 flex h-[52px] items-center justify-between border-b border-ink-950 lg:hidden">
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">
          散場誌
        </span>
        <span className="text-eyebrow tracking-[0.14em] text-ink-600">
          專欄作者
        </span>
      </header>

      <div className="px-4 pb-[120px]">
        <section className="grid grid-cols-[minmax(0,1fr)_72px] items-start gap-x-4 pt-7">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">
              {columnLabel(columnName) ?? "專欄"}
            </span>
            <h1 className="m-0 font-serif-tc text-headline leading-[1.3] font-bold text-ink-950">
              {penName}
            </h1>
          </div>
          <Seal penName={penName} size={64} glyph={glyph} label={`${penName}的印章`} className="justify-self-end" />
        </section>

        <p className="mt-4 mb-0 font-serif-tc text-lede leading-[1.9] text-ink-800">
          {AUTHOR.bio}
        </p>

        <dl className="my-0 mt-5 grid grid-cols-3 border-y border-ink-200 py-3 text-left">
          <div className="flex flex-col gap-0.5">
            <dt className="text-eyebrow tracking-[0.14em] text-ink-600">開欄</dt>
            <dd className="m-0 text-note text-ink-950 tabular-nums">
              {stats.sinceMonth ?? "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 border-l border-ink-200 pl-3.5">
            <dt className="text-eyebrow tracking-[0.14em] text-ink-600">
              已發表
            </dt>
            <dd className="m-0 text-note text-ink-950">
              {stats.publishedCount} 篇
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 border-l border-ink-200 pl-3.5">
            <dt className="text-eyebrow tracking-[0.14em] text-ink-600">
              最常寫
            </dt>
            <dd className="m-0 text-note text-ink-950">{stats.mostWritten}</dd>
          </div>
        </dl>

        <Link
          href="/me/settings"
          className="inline-flex min-h-11 items-center text-note text-ember-dark no-underline"
        >
          編輯專欄簡介
        </Link>

        <section className="mt-5">
          <div className="flex items-baseline justify-between border-b border-ink-950 pb-2.5">
            <h2 className="m-0 font-serif-tc text-section font-bold text-ink-950">
              發表過的感受
            </h2>
            <span className="text-eyebrow tracking-[0.14em] text-ink-600">
              由新到舊
            </span>
          </div>

          {previewRows.length === 0 ? (
            <p className="mt-5 mb-0 text-note leading-[1.8] text-ink-600">
              還沒有發表過。按下方「說一段」，留下第一篇感受。
            </p>
          ) : (
            previewRows.map((entry) => (
              <Link
                key={entry.id}
                href={entry.href}
                className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-2 border-b border-ink-200 py-4 text-inherit no-underline active:bg-paper-2"
              >
                <span className="pt-0.5 font-serif-tc text-note text-ink-600 tabular-nums">
                  {formatRowDate(entry.date)}
                </span>
                <span className="flex min-w-0 flex-col gap-[5px]">
                  <span className="font-serif-tc text-prose leading-[1.5] font-bold text-ink-950">
                    {entry.title}
                  </span>
                  {entry.categoryLabel || entry.workTitle ? (
                    <span className="text-caption text-ink-600">
                      {entry.categoryLabel ? (
                        <span className={entry.screen ? "text-ember-dark" : "text-ink-700"}>{entry.categoryLabel}</span>
                      ) : null}
                      {entry.categoryLabel && entry.workTitle ? " · " : null}
                      {entry.workTitle ? `《${entry.workTitle}》` : null}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))
          )}

          {published.length > previewRows.length ? (
            <Link
              href="/me/desk?tab=published"
              className="mt-1 inline-flex min-h-11 items-center text-note font-bold text-ember-dark no-underline"
            >
              看全部 {published.length} 篇 →
            </Link>
          ) : null}
        </section>

        <TourReplayCard />
        <section className="mt-11 border-t border-ink-200">
          {communityEnabled() ? <MeLettersLink userId={userId} /> : null}
          {ENTRY_LINKS.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="flex min-h-[52px] items-center justify-between border-b border-ink-200 text-note text-ink-700 no-underline"
            >
              <span>{entry.label}</span>
              <span className="flex items-center gap-1.5 text-caption text-ink-600">
                {entry.href === "/me/desk" && draftCount > 0 ? `${draftCount} 份草稿` : entry.note}
                <ChevronIcon />
              </span>
            </Link>
          ))}
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-[52px] w-full items-center border-b border-ink-200 text-left text-note text-ink-600"
            >
              登出
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
