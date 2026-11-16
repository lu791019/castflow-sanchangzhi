/**
 * Spotify 自動直連（Q-64 A②）的比對規則（純函式）：作品 ↔ Spotify 搜尋結果，只收「有把握是同一個」的。
 * 沒把握一律回 null（保留原本的搜尋連結），寧可漏、不可錯：
 * - 專輯：名稱相同＋主要藝人相同；版本標記（豪華版、Live、Taylor's Version、Remaster…）兩邊要一致；
 *   同名同藝人有多張（專輯／單曲）時用曲目數分辨，分不出來就不寫。譯名（泰勒絲 ↔ Taylor Swift）不猜。
 * - Podcast 節目：名稱完全相同（正規化後）且搜尋結果裡只有一個；Spotify 開發模式的節目物件沒有 publisher
 *   （10/16 實測），有給才比；名稱太短（< 4 字）要描述裡提到發行者才算。
 * 本機 worker 也可能用到：只用相對路徑 import（不能用 @/ 別名）。
 */

export interface SpotifyAlbumCandidate {
  id: string;
  name: string;
  album_type: string;
  total_tracks: number | null;
  artists: readonly string[];
}

export interface SpotifyShowCandidate {
  id: string;
  name: string;
  /** 開發模式的搜尋結果沒有這欄（10/16 實測），保留給有給的情況 */
  publisher: string | null;
  description: string | null;
}

export interface AlbumWork {
  title: string;
  /** 歌手／樂團（iTunes artistName） */
  credit: string | null;
  /** 建立當下由 iTunes lookup 帶來；補跑既有作品時沒有 */
  trackCount?: number | null;
}

export interface ShowWork {
  /** works.podcast_show（RSS 節目名稱） */
  show: string;
  /** works.credit（RSS author） */
  credit: string | null;
}

/** 版本標記：兩邊要一致才算同一張（中英關鍵字，比對正規化後的字串） */
const VERSION_MARKERS: ReadonlyArray<readonly [string, RegExp]> = [
  ["deluxe", /deluxe|豪華|珍藏/],
  ["expanded", /expanded|complete edition|擴充/],
  ["special", /special edition|特別版|限定/],
  ["anniversary", /anniversary|週年|周年/],
  ["remaster", /remaster|重製|復刻/],
  ["live", /\blive\b|現場|演唱會/],
  ["remix", /remix|混音/],
  ["acoustic", /acoustic|不插電/],
  ["instrumental", /instrumental|伴奏|karaoke|純音樂/],
  ["version", /\bversion\b|\bver\b|版本/],
  ["sped", /sped up|slowed/],
];

/** 括號備註：半形化後的 ()、[]、{}，以及中文常見的【】〔〕《》〈〉 */
const BRACKET_NOTE = /\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\}|【[^【】]*】|〔[^〔〕]*〕/g;
/** iTunes 標題字尾、Spotify 不會有的「- Single」「- EP」 */
const RELEASE_SUFFIX = /\s+-\s+(single|ep)$/;
/** 「 - 2011 Remaster」這種破折號後的版本說明（只在後段有版本標記時才當備註拿掉） */
const DASH_NOTE = /\s+-\s+([^-]+)$/;
/** 比對時忽略的符號（標點、引號、各種破折號與空白） */
const IGNORED_CHARS = /[\s\p{P}\p{S}]/gu;
/** 合作藝人分隔：&、,、、、/、x、×、feat.（整串相同另外先比，「Simon & Garfunkel」這種團名不會被拆壞） */
const ARTIST_SPLIT = /\s*(?:&|,|、|\/|\s+x\s+|×|\bfeat\.?\s|\bft\.?\s)\s*/i;
const VARIOUS_ARTISTS = /^(?:various artists?|群星|v\.?a\.?|合輯)$/;
const SHORT_SHOW_NAME = 4;

/** 全形半形（NFKC）、大小寫、空白統一；保留括號內容 */
export function foldText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

/** 比對用的鍵：fold 後拿掉所有標點符號與空白（「帶你飛（豪華版）」＝「帶你飛 (豪華版)」） */
export function matchKey(value: string): string {
  return foldText(value).replace(IGNORED_CHARS, "");
}

export function versionMarkers(title: string): string[] {
  const folded = foldText(title);
  return VERSION_MARKERS.filter(([, pattern]) => pattern.test(folded)).map(([marker]) => marker);
}

/** 去掉括號備註、「- Single」、帶版本說明的破折號後段，只留主標題 */
export function baseTitle(title: string): string {
  const folded = foldText(title).replace(RELEASE_SUFFIX, "");
  const unbracketed = folded.replace(BRACKET_NOTE, " ").replace(/\s+/g, " ").trim();
  const dash = DASH_NOTE.exec(unbracketed);
  const stripped = dash && versionMarkers(dash[1]).length > 0 ? unbracketed.slice(0, dash.index) : unbracketed;
  return matchKey(stripped);
}

function sameMarkers(a: string, b: string): boolean {
  const left = versionMarkers(a);
  const right = versionMarkers(b);
  return left.length === right.length && left.every((marker) => right.includes(marker));
}

/** 名稱相同：完全相同（正規化後），或主標題相同且版本標記一致（只差 OST、feat. 之類的備註） */
export function sameTitle(workTitle: string, candidate: string): boolean {
  const exact = matchKey(workTitle.replace(RELEASE_SUFFIX, ""));
  if (exact && exact === matchKey(candidate)) return true;
  const base = baseTitle(workTitle);
  return base.length > 0 && base === baseTitle(candidate) && sameMarkers(workTitle, candidate);
}

export function splitArtists(credit: string): string[] {
  return foldText(credit)
    .split(ARTIST_SPLIT)
    .map((part) => matchKey(part))
    .filter(Boolean);
}

/** 主要藝人相同：作品的第一位＝Spotify 第一位（合作專輯的其他人不要求，順序不同就不算） */
export function sameArtist(credit: string | null, artists: readonly string[]): boolean {
  if (!credit || artists.length === 0) return false;
  const workArtists = splitArtists(credit);
  const primary = matchKey(artists[0]);
  if (workArtists.length === 0 || !primary || VARIOUS_ARTISTS.test(foldText(credit))) return false;
  const whole = matchKey(credit);
  if (whole === primary || whole === matchKey(artists.join(" & "))) return true;
  return workArtists[0] === primary;
}

/** 同名同藝人有多張時，用曲目數挑：iTunes 與 Spotify 一樣的那張；沒有曲目數就要全部同型同曲目數才算 */
function pickByTracks(
  matches: readonly SpotifyAlbumCandidate[],
  trackCount: number | null | undefined,
): SpotifyAlbumCandidate | null {
  if (matches.length === 0) return null;
  if (typeof trackCount === "number" && trackCount > 0) {
    const sameCount = matches.filter((album) => album.total_tracks === trackCount);
    if (sameCount.length > 0) return sameCount[0];
    // 曲目數對不上（Spotify 多了 bonus track 之類）：只剩一張、而且不是單曲對專輯，才收
    const single = trackCount <= 3;
    const sameShape = matches.filter((album) => (album.album_type === "single") === single);
    return matches.length === 1 && sameShape.length === 1 ? sameShape[0] : null;
  }
  const [first] = matches;
  const uniform = matches.every((album) => album.album_type === first.album_type && album.total_tracks === first.total_tracks);
  return uniform ? first : null;
}

/** 專輯：回有把握的那一張，沒有就 null */
export function matchAlbum(work: AlbumWork, candidates: readonly SpotifyAlbumCandidate[]): SpotifyAlbumCandidate | null {
  if (!work.title.trim() || !work.credit?.trim()) return null;
  const matches = candidates.filter(
    (album) => album.album_type !== "compilation" && sameTitle(work.title, album.name) && sameArtist(work.credit, album.artists),
  );
  return pickByTracks(matches, work.trackCount);
}

function mentionsCredit(credit: string | null, text: string | null): boolean {
  if (!credit || !text) return false;
  const key = matchKey(credit);
  return key.length >= 2 && matchKey(text).includes(key);
}

/** Podcast 節目：名稱完全相同且唯一；有 publisher 就要對得上；名稱太短要描述提到發行者 */
export function matchShow(work: ShowWork, candidates: readonly SpotifyShowCandidate[]): SpotifyShowCandidate | null {
  const key = matchKey(work.show);
  if (!key) return null;
  const sameName = candidates.filter((show) => matchKey(show.name) === key);
  if (sameName.length !== 1) return null;
  const [show] = sameName;
  if (show.publisher) {
    if (!work.credit || matchKey(show.publisher) !== matchKey(work.credit)) return null;
    return show;
  }
  if (Array.from(key).length < SHORT_SHOW_NAME && !mentionsCredit(work.credit, show.description)) return null;
  return show;
}
