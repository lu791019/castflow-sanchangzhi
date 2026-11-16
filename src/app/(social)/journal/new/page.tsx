import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth/page";
import { spotifyListenEnabled } from "@/lib/features";
import type { RecentLogWork } from "@/lib/journal/recent-works";
import { isSpotifyAlbumId } from "@/lib/spotify/listen-work";
import { loadListenWork } from "@/lib/spotify/listen-work-repository";
import { AutoOpenLogSheet } from "../journal-actions";
import { JournalScreen } from "../journal-screen";
import { loadJournalScreen } from "../load-journal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "記一筆｜散場誌",
};

type Param = string | string[] | undefined;

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 收聽提醒（Spotify 聽完一張專輯，Q-64 C1）點進來：找或建那張專輯的作品給 sheet 預選；找不到就照常打開 */
async function listenWork(albumId: string | undefined): Promise<RecentLogWork | null> {
  if (!spotifyListenEnabled() || !isSpotifyAlbumId(albumId)) return null;
  const work = await loadListenWork(albumId);
  return work
    ? { id: work.id, kind: work.kind, title: work.title, podcast_show: work.podcast_show, episode_number: work.episode_number, poster_url: work.poster_url }
    : null;
}

/** 可直接連結的「記一筆」：背後是這個月的日誌，進頁即滑出 sheet，關掉回 /journal */
export default async function NewJournalEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: Param; spotifyAlbum?: Param }>;
}) {
  const userId = await requirePageUserId("/journal/new");
  const { resume, spotifyAlbum } = await searchParams;
  const [screen, work] = await Promise.all([loadJournalScreen(userId, {}), listenWork(first(spotifyAlbum))]);
  return (
    <>
      <JournalScreen {...screen} />
      <AutoOpenLogSheet resume={first(resume) === "1"} work={work} />
    </>
  );
}
