import type { Metadata } from "next";
import { signOutAction } from "@/app/auth/actions";
import { FormMeasure } from "@/components/app-shell/form-measure";
import { Seal } from "@/components/seal/seal";
import { isSiteOwner } from "@/lib/auth/admin";
import { loadBeforeCity } from "@/lib/before/city-repository";
import { requirePageUserId } from "@/lib/auth/page";
import { getReminderTiming } from "@/lib/journal/repository";
import { DEFAULT_REMINDER_TIMING } from "@/lib/journal/types";
import { countExportableArticles } from "@/lib/me/export-repository";
import { exportCountLabel } from "@/lib/me/export";
import { loadColumnName } from "@/lib/me/column-name-repository";
import { loadPenName } from "@/lib/me/pen-name";
import { DEFAULT_PUBLISH_DEFAULTS, getPublishDefaults } from "@/lib/me/preferences";
import { showsCountLabel } from "@/lib/me/settings";
import { countMyShows } from "@/lib/me/shows-repository";
import { countPastedSamples } from "@/lib/voice/repository";
import { loadSealGlyph } from "@/lib/seal/glyph-repository";
import { spotifyListenEnabled } from "@/lib/features";
import { isConnectResult } from "@/lib/spotify/connect-copy";
import { loadSpotifyConnection, type SpotifyConnectionStatus } from "@/lib/spotify/connection-repository";
import { createClient } from "@/lib/supabase/server";
import { loadQuestionnaire, loadTasteLiveKinds } from "@/lib/taste/repository";
import packageJson from "../../../../../package.json";
import { AppearanceSection } from "./appearance-section";
import { ColumnNameRow } from "./column-name-row";
import { ReminderSection } from "./reminder-section";
import { ScopeRow } from "./scope-row";
import { SealGlyphRow } from "./seal-glyph-row";
import { PageHeader, SectionHead, SettingsRow } from "./settings-parts";
import { SocialRow } from "./social-row";
import { SpotifyRow } from "./spotify-row";
import { TasteSection } from "./taste-section";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "設定｜散場誌",
  robots: { index: false },
};

/** 讀取失敗就用預設值顯示並留 log，不讓整頁壞掉 */
async function orDefault<T>(scope: string, task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch (error) {
    console.error(`[settings] ${scope} failed`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

async function currentEmail(): Promise<string | null> {
  const { data } = await (await createClient()).auth.getUser();
  return data.user?.email ?? null;
}

/** Spotify 收聽紀錄（Q-64 C1）：功能開關關著就不讀、不顯示；讀不到回 null（只顯示連結鈕） */
async function spotifyStatus(userId: string): Promise<SpotifyConnectionStatus | null | undefined> {
  if (!spotifyListenEnabled()) return undefined;
  return orDefault<SpotifyConnectionStatus | null>("spotify", loadSpotifyConnection(userId), null);
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ spotify?: string | string[] }> }) {
  const userId = await requirePageUserId("/me/settings");
  const { spotify: spotifyParam } = await searchParams;
  const spotifyResult = Array.isArray(spotifyParam) ? spotifyParam[0] : spotifyParam;
  const [penName, email, timing, defaults, shows, articles, owner, glyph, columnName, taste, city, liveKinds, spotify, voiceCount] = await Promise.all([
    loadPenName(userId),
    currentEmail(),
    orDefault("reminder", getReminderTiming(userId), DEFAULT_REMINDER_TIMING),
    orDefault("defaults", getPublishDefaults(userId), DEFAULT_PUBLISH_DEFAULTS),
    orDefault("shows", countMyShows(userId), 0),
    orDefault("articles", countExportableArticles(userId), 0),
    isSiteOwner(userId),
    loadSealGlyph(userId),
    loadColumnName(userId),
    orDefault("taste", loadQuestionnaire(userId), null),
    orDefault<string | null | undefined>("city", loadBeforeCity(userId), undefined),
    orDefault("live kinds", loadTasteLiveKinds(userId), []),
    spotifyStatus(userId),
    orDefault("voice", countPastedSamples(userId), 0),
  ]);

  return (
    <FormMeasure>
      <PageHeader title="設定" backHref="/me" backLabel="返回我的" />
      <div className="px-4 pb-[120px]">
        <section aria-labelledby="s1" className="mt-7">
          <SectionHead id="s1" no="一" title="署名" note="文章上怎麼稱呼你" />
          <div className="mt-2 border-t border-ink-200">
            <SettingsRow
              label="筆名"
              href="/onboarding/pen-name?next=%2Fme%2Fsettings"
              value={
                <>
                  <Seal penName={penName} size={24} glyph={glyph} />
                  <span className="font-serif-tc text-lede text-ink-800">{penName}</span>
                </>
              }
            />
            <SealGlyphRow penName={penName} initial={glyph} />
            <ColumnNameRow initial={columnName} />
            <ScopeRow initial={defaults.defaultVisibility} />
            {email ? <SettingsRow label="找回專欄的 email" value={<span className="max-w-[180px] truncate">{email}</span>} /> : null}
          </div>
        </section>

        <section aria-labelledby="s-look" className="mt-9">
          <SectionHead id="s-look" no="二" title="外觀" note="燈要開著，還是關著" />
          <p className="mt-2 mb-0 text-caption leading-[1.7] text-ink-700">夜裡讀，可以把整本刊物調暗，像走進放映廳。</p>
          <AppearanceSection />
        </section>

        <section aria-labelledby="s2" className="mt-9">
          <SectionHead id="s2" no="三" title="提醒" note="記一筆之後，只問一次" />
          <div className="mt-2 border-t border-ink-200">
            <ReminderSection initialTiming={timing} />
            {spotify !== undefined ? <SpotifyRow initial={spotify} result={isConnectResult(spotifyResult) ? spotifyResult : null} /> : null}
          </div>
        </section>

        <section aria-labelledby="s3" className="mt-9">
          <SectionHead id="s3" no="四" title="社群發文" note={defaults.generateSocial ? "會一起寫" : "目前不寫"} />
          <div className="mt-2 border-t border-ink-200">
            <SocialRow initial={defaults.generateSocial} />
            <SettingsRow
              label="我的語氣"
              sub="貼幾篇你寫過的貼文，Threads 寫出來會更像你；只有你看得到"
              value={voiceCount ? `${voiceCount} 篇` : "還沒貼"}
              href="/me/settings/voice"
            />
            <p className="mt-2.5 mb-0 text-caption leading-[1.8] text-ink-600">
              只是先寫好，不會自己發出去；要不要發到平台，在校樣頁一篇一篇決定。
            </p>
          </div>
        </section>

        <section aria-labelledby="s4" className="mt-9">
          <SectionHead id="s4" no="五" title="我的節目" note="給常聽 podcast 的你" />
          <div className="mt-2 border-t border-ink-200">
            <SettingsRow label="RSS 訂閱" sub="新的一集會自己進來，打開就能聽、讀逐字稿" value={showsCountLabel(shows)} href="/me/settings/shows" />
          </div>
        </section>

        <section aria-labelledby="s-taste" className="mt-9">
          <SectionHead id="s-taste" no="六" title="品味" note="散場之前怎麼排" />
          <div className="mt-2 border-t border-ink-200">
            <TasteSection initial={{ questionnaire: taste ?? { media: [], setting: null }, city, liveKinds }} />
          </div>
        </section>

        <section aria-labelledby="s5" className="mt-9">
          <SectionHead id="s5" no="七" title="關於" note="版權頁" />
          <div className="mt-2 border-t border-ink-200">
            <div className="border-b border-ink-200 pt-3.5 pb-3">
              <div className="flex items-baseline justify-between">
                <span className="text-lede text-ink-950">資料來源</span>
                <span className="text-note text-ink-600">TMDB・Apple Podcasts</span>
              </div>
              <p className="mt-1.5 mb-0 text-eyebrow leading-[1.7] text-ink-600">
                電影與影集資料、海報來自 TMDB；節目與單集資料來自 Apple Podcasts。This product uses the TMDB API but is not endorsed or
                certified by TMDB.
              </p>
            </div>
            <SettingsRow label="AI 怎麼參與這本刊物" sub="文章由你口述、AI 整理，發佈前一定經過你確認" />
            <SettingsRow label="版本" value={<span className="tabular-nums">{packageJson.version}・第一階</span>} />
            {owner ? <SettingsRow label="全站設定" sub="Meta 連線、AI 金鑰（只有站長看得到）" href="/settings" /> : null}
            <div className="flex flex-col border-b border-ink-200 pt-1.5 pb-3">
              {articles > 0 ? (
                <a href="/me/export" download className="flex min-h-11 items-center gap-1.5 self-start text-lede font-bold text-ember-dark no-underline">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                  </svg>
                  匯出我的全部文章
                </a>
              ) : (
                <span className="flex min-h-11 items-center text-lede font-bold text-ink-400">匯出我的全部文章</span>
              )}
              <span className="text-caption leading-[1.6] text-ink-600">{exportCountLabel(articles)}</span>
            </div>
          </div>
          <form action={signOutAction} className="mt-3 flex gap-6">
            <button type="submit" className="min-h-11 text-note text-ink-700">
              登出這支手機
            </button>
          </form>
        </section>

        <p className="mt-8 mb-0 text-center text-eyebrow tracking-[0.3em] text-ink-600">— 散場誌 —</p>
      </div>
    </FormMeasure>
  );
}
