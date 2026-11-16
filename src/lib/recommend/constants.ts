/** 作品推薦（Q-40 C）可調常數：權重、上限、快取、時限集中在這裡 */

/** 一區最多幾張卡 */
export const RECOMMEND_LIMIT = 6;
/** 總分低於這個不推（避免只靠一點點類型重疊就硬推） */
export const MIN_SCORE = 1;

/** 種子：寫過最強，記過次之，排了最弱 */
export const SEED_WEIGHTS = { wrote: 1, logged: 0.6, planned: 0.4 } as const;
/** 最多拿幾部作品當種子（寫過的優先） */
export const MAX_SEEDS = 8;

/** TMDB 命中：種子的 recommendations／similar 名單裡有這部 */
export const HIT_WEIGHTS = { recommendations: 3, similar: 2 } as const;
/** 同導演（影集＝主創）每位 */
export const DIRECTOR_WEIGHT = 2;
/** 同演員每位，最多算幾位 */
export const CAST_WEIGHT = 1;
export const CAST_CAP = 2;
/** 類型重疊每個，最多算幾個 */
export const GENRE_WEIGHT = 0.5;
export const GENRE_CAP = 3;
/** 演員只看每部前幾位 */
export const TOP_CAST = 8;

/** 品味資料：媒介分佈（0–1）× 權重；場域（在家／出門，0–1）× 權重 */
export const MEDIA_WEIGHT = 2;
export const SETTING_WEIGHT = 1;

/** 候選池：即將上映只收幾天內 */
export const UPCOMING_WINDOW_DAYS = 30;
/** 候選裡最多查幾部的 TMDB 詳情（類型、導演、演員） */
export const MAX_DETAIL_CANDIDATES = 40;
/** 同時打 TMDB 的請求數 */
export const TMDB_CONCURRENCY = 6;

/** TMDB 詳情快取 24 小時；最多留幾筆 */
export const DETAIL_TTL_MS = 24 * 60 * 60_000;
export const DETAIL_CACHE_MAX = 600;

/** 整區算不完就先不顯示（串流在首屏之後，不擋首屏） */
export const RECOMMEND_DEADLINE_MS = 6_000;
