/**
 * OG 卡讀資料（server only，走 service role）。
 * 隱私規則與分享頁一致：私人／收回／找不到 → null，呼叫端只畫不含內容的中性卡。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { loadEpisodeJournal } from "@/lib/journal/episode-link";
import { loadPenName } from "@/lib/me/pen-name";
import { isShareable, parseVisibility } from "@/lib/proof/publish";
import { WORK_COLUMNS, type Work } from "@/lib/works/format";
import { toOgCardModel, type OgCardModel } from "./og-model";

const SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const IMAGE_TIMEOUT_MS = 4000;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Satori 只吃 png / jpeg / gif */
const SUPPORTED_IMAGE = /^image\/(png|jpe?g|gif)$/;

export async function loadOgCard(slug: string): Promise<OgCardModel | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const supabase = createAdminClient();
  const { data: episode, error } = await supabase
    .from("episodes")
    .select("id, title, source, created_at, work_id, visibility, byline, pull_quote, user_id")
    .eq("share_slug", slug)
    .maybeSingle();
  if (error) throw new Error(`讀取分享集數失敗：${error.message}`);
  if (!episode) return null;
  if (!isShareable(parseVisibility(episode.visibility) ?? "public")) return null;

  const { data: content, error: contentError } = await supabase
    .from("contents")
    .select("body")
    .eq("episode_id", episode.id)
    .eq("platform", "blog")
    .limit(1)
    .maybeSingle();
  if (contentError) throw new Error(`讀取分享文章失敗：${contentError.message}`);
  if (!content?.body) return null;

  const [work, penName, journal] = await Promise.all([
    episode.work_id ? loadWork(episode.work_id as string) : Promise.resolve(null),
    // 署名是文章作者的筆名，不是正在看的人
    loadPenName(episode.user_id as string),
    loadEpisodeJournal(episode.id as string),
  ]);
  return toOgCardModel({ episode, body: content.body as string, work, penName, journal });
}

async function loadWork(id: string): Promise<Work | null> {
  const { data, error } = await createAdminClient().from("works").select(WORK_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`讀取作品失敗：${error.message}`);
  return (data as Work | null) ?? null;
}

/**
 * 先把海報／封面抓成 data URI：Satori 抓圖失敗會讓整張卡壞掉，
 * 自己抓才能逾時、限大小、擋格式，失敗時讓呼叫端改畫直排字卡。
 */
export async function fetchImageDataUri(url: string): Promise<string> {
  if (!/^https:\/\//.test(url)) throw new Error("圖片網址不是 https");
  const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`圖片 ${response.status}`);
  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!SUPPORTED_IMAGE.test(type)) throw new Error(`圖片格式不支援：${type || "未知"}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > IMAGE_MAX_BYTES) throw new Error(`圖片太大：${bytes.byteLength} bytes`);
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}
