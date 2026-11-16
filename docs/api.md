# API 路由

全部在 `src/app/api/**/route.ts`。驗證方式有兩種：

- **使用者**：Supabase session cookie（magic link 登入後由 `@supabase/ssr` 管理）。
- **worker**：`x-api-key` 標頭要等於 `API_SECRET_KEY`（`src/lib/api-guard.ts`）。標「worker」的路由只接受這種。

頁面上多數寫入（說一段上傳、校樣發佈、看完了、共鳴、回信等）走 Server Actions（`src/app/**/actions.ts`），不在這張表裡。

## worker 用

| 路由 | 用途 |
|---|---|
| `POST /api/transcribe` | Groq Whisper 轉錄（mlx 失敗時的備援；multipart 上傳，上限受 `proxyClientMaxBodySize` 30MB 控制） |
| `POST /api/generate` | 由逐字稿產 6 個平台文案 |
| `GET/POST /api/episodes/[id]/reading` | Podcast 雙語閱讀頁產生 |
| `POST /api/episodes/embeddings/refresh` | 補算公開文章詞向量 |
| `GET /api/journal/due` | 取到期提醒 |
| `GET /api/ingest/rss/poll` | 拉訂閱節目的新集數 |
| `POST /api/publish-scheduled` | 發佈排程中的內容 |
| `POST /api/events/ingest` | 寫入收集到的藝文活動 |
| `POST /api/works/covers/refresh` | 補作品封面 |
| `POST /api/works/watch/refresh` | 更新在哪看 |

## 使用者用

| 群組 | 路由 |
|---|---|
| 作品 | `GET /api/works/search`、`GET /api/works/trending`、`GET /api/works/episodes`、`/api/works`、`/api/works/[id]/cover`、`/api/works/[id]/links`、`/api/covers` |
| 日誌 | `/api/journal`、`/api/journal/[id]/skip`、`/api/journal/settings`、`/api/journal/sheet` |
| 散場之前 | `/api/before/city`（選縣市，回傳新的首屏資料） |
| 通知與推播 | `/api/notifications`、`/api/notifications/read`、`/api/notifications/unread`、`GET /api/push/public-key`、`/api/push/subscriptions` |
| 社群（`FEATURE_COMMUNITY`） | `/api/resonance`、`/api/letters`、`/api/letters/[id]` |
| 個人 | `/api/profile/pen-name/check`、`/api/me/drafts/[id]` |
| 匯入 | `/api/import/preview`、`/api/import`（部落格 RSS 或貼文字搬進來）、`/api/ingest/rss`、`/api/ingest/text` |
| 發佈 | `/api/publish` |
| Spotify（`FEATURE_SPOTIFY_LISTEN`） | `/api/spotify/connect`、`/api/spotify/callback`、`/api/spotify/connection` |

各路由支援的 HTTP 方法與參數以 route.ts 的匯出為準。
