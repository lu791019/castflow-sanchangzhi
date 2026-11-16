# 架構

## 三個執行單位

```
           瀏覽器（PWA，375 手機優先，寬螢幕另排版）
                         │
                         ▼
  ┌──────────────────────────────────────────────┐
  │ Next.js 16 App Router（Cloud Run 容器）      │
  │  頁面、Server Actions、API Routes             │
  │  └─ @castflow/engine（純函式內容引擎）        │
  └───────┬──────────────────────┬───────────────┘
          │                      │
          ▼                      ▼
  Supabase（Postgres＋RLS、    外部服務：Anthropic／OpenAI／Gemini、
  pgvector、Auth、Storage）    Groq Whisper、Voyage、TMDB、iTunes、
          ▲                    Spotify、Meta Threads
          │ service role＋x-api-key
  ┌───────┴──────────────────────────────────────┐
  │ 本機 worker（Apple Silicon 常駐，launchd）   │
  │  mlx-whisper 轉錄 → 失敗降級到 Groq          │
  │  到期提醒與 Web Push、TMDB 補資料、          │
  │  在哪看更新、藝文活動收集、詞向量補算        │
  └──────────────────────────────────────────────┘
```

| 單位 | 位置 | 為什麼放這裡 |
|---|---|---|
| Web | Google Cloud Run（`min-instances 0`） | 說一段的錄音上傳上限 25MB、Podcast 雙語閱讀單次請求可能跑很久；Cloud Run 單一請求最長 60 分鐘、本體 32MB，閒置不計費 |
| 資料 | Supabase | Postgres＋RLS、magic link 登入、私有 Storage、pgvector 都在同一處 |
| Worker | 本機 Mac | 轉錄用 mlx-whisper，需要 Apple Silicon；雲端只負責 web |

## 程式結構

| 目錄 | 內容 |
|---|---|
| `src/app/(social)` | 主產品頁：散場之前、日誌、說一段、看完了、作品特輯、目錄、作者專欄、我的（含來信）、通知 |
| `src/app/(account)` | 登入、筆名與新手設定 |
| `src/app/(app)` | Podcast 文案後台：dashboard、集數、語氣、排程、設定 |
| `src/app/proof` | 校樣（發佈前確認） |
| `src/app/s/[slug]` | 公開分享頁與 OG 圖 |
| `src/app/api` | API 路由，見 [api.md](api.md) |
| `src/lib/<feature>` | 依功能分模組（journal、say、proof、resonance、letters、match、events…）。多數是純函式＋注入的 repository，方便單測 |
| `src/components` | 依功能分的 React 元件 |
| `packages/engine` | 內容引擎：轉錄、成文、語氣、雙語閱讀、引言候選、多家 LLM 切換。不依賴 Next 與 Supabase，見 [ai-pipeline.md](ai-pipeline.md) |
| `worker` | 本機常駐 worker，見 `worker/README.md` |
| `supabase/migrations` | 38 支 migration，見 [data-model.md](data-model.md) |
| `e2e` | Playwright 端到端測試，見 [testing.md](testing.md) |

## 主要流程

### 說一段 → 文章
1. 使用者在 `/say` 錄音（MediaRecorder，webm／m4a）或打字。錄音經 Server Action 上傳到私有 bucket `audio`，建立一筆 `episodes`（`status=uploaded`）。
2. worker 每輪撈 `uploaded` 的集數：用 service role 簽 10 分鐘的下載網址 → `mlx_whisper` 轉錄（上限 3 小時）→ 失敗時壓縮音檔改呼叫 `/api/transcribe`（Groq）→ 寫入 `transcripts`，狀態改 `transcribed`，並推播「整理好了」。
3. 使用者進校樣頁，app 呼叫引擎把逐字稿整理成文章；使用者可以逐段改，確認後 `publish` 寫入 `contents`，依公開範圍產生 `share_slug`。
4. 公開且署名的文章排程計算詞向量（Voyage），進作品特輯與品味配對。

### 看完了 → Threads
`/watched` 選作品 → 說一段或打字 → 引擎產出 Threads 貼文。有語氣樣本（使用者貼的自己的貼文）就照樣本寫，沒有就用通用語氣並提示可補樣本。發文是開啟 Threads 網頁發文頁並帶入文字（Threads API 程式在 `packages/engine/src/publish/threads.ts`，需另外申請 Meta 權限）。

### 記一筆 → 提醒
記一筆時依使用者設定算 `remind_at`（預設隔天中午，半夜看完算當天中午）。worker 呼叫 `/api/journal/due` 取到期項目，建 App 內通知並送 Web Push；推播網址直接帶到 `/say?journal=<id>`。

### Podcast 訂閱 → 6 平台文案
`/api/ingest/rss` 訂閱節目，worker 定期呼叫 `/api/ingest/rss/poll` 拉新集數 → 轉錄 → `/api/generate` 一次產 6 個平台的文案。同一個 feed 多人訂閱時共用逐字稿，不重複轉錄。

## 登入與權限
- 使用者登入：Supabase Auth email magic link（`/auth/callback?token_hash=…`），session 存 cookie。
- 資料表全開 RLS；寫入多數走 server（service role），在 TypeScript 層檢查擁有者、長度、內容規則。
- worker 專用路由用 `x-api-key` 標頭比對 `API_SECRET_KEY`（`src/lib/api-guard.ts`）。
- 錄音 bucket 是私有的：播放與下載一律換 service role 簽名網址（`src/lib/audio/signed-url.ts`）。

## 功能開關
執行期讀取，改環境變數後重新部署 revision 即生效（`src/lib/features.ts`）。

| 變數 | 控制 | 關閉時 |
|---|---|---|
| `FEATURE_COMMUNITY=on` | 共鳴、回信與讀者來函、同場的人、索引／搜尋、作者專欄頁、品味配對 | 相關頁面與 API 回 404，入口不顯示 |
| `FEATURE_SPOTIFY_LISTEN=on` | 連結 Spotify、聽完專輯提醒記一筆 | 設定頁不顯示，`/api/spotify/*` 不開放 |
