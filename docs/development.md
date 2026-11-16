# 本機開發

## 需求
- Node.js 24（`worker` 與 scripts 直接用 Node 跑 TypeScript）
- 一個 Supabase 專案（雲端），或本機 Supabase CLI（`supabase start`，需要 Docker）
- 只跑 worker 轉錄時才需要：Apple Silicon Mac、`mlx_whisper`（`uv tool install mlx-whisper`）、`ffmpeg`

## 啟動

```bash
npm install
cp .env.example .env.local        # 填入需要的值，見下表
# 套用 supabase/migrations/*.sql（見 data-model.md）
npm run dev                       # http://localhost:3000
npm run worker                    # 另一個終端機；WORKER_ONCE=1 只跑一輪
```

Supabase Auth 要把 Site URL 與 redirect URL 設成你的網址（本機是 `http://localhost:3000`），登入連結才會回到 `/auth/callback`。

## 環境變數（web）

| 變數 | 必要 | 說明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | 打包時會內嵌進前端，部署時要當 build arg 傳入 |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | server 端寫入、簽錄音網址；不可外流到前端 |
| `API_SECRET_KEY` | 是 | worker 呼叫 app 的金鑰，web 與 worker 必須相同 |
| `APP_URL` | 建議 | 站台網址，用於分享連結、推播網址 |
| `ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL` | 成文需要 | 預設模型 `claude-sonnet-4-6` |
| `OPENAI_API_KEY`／`GEMINI_API_KEY`（＋`_MODEL`） | 選填 | 換 LLM 供應商時 |
| `CLAUDE_CLI`、`CLAUDE_CLI_SAFE_MODE` | 選填 | 本機用 `claude --print` 代替 API，只適合開發 |
| `GROQ_API_KEY` | 建議 | 轉錄備援 |
| `VOYAGE_API_KEY` | 選填 | 詞向量配對；沒設時只用共同作品配對 |
| `TMDB_READ_ACCESS_TOKEN` 或 `TMDB_API_KEY` | 建議 | 電影、影集搜尋與海報 |
| `VAPID_PUBLIC_KEY` | 選填 | Web Push 公鑰（私鑰只給 worker） |
| `SPOTIFY_CLIENT_ID`、`SPOTIFY_CLIENT_SECRET`、`SPOTIFY_REDIRECT_URI`、`SPOTIFY_TOKEN_KEY` | 選填 | Spotify 連結，另需 `FEATURE_SPOTIFY_LISTEN=on` |
| `FEATURE_COMMUNITY` | 選填 | `on` 開社群功能（見 architecture.md） |
| `READING_BATCH_SIZE`、`READING_CONCURRENCY` | 選填 | 雙語閱讀頁的分批大小與並行數 |

worker 的環境變數見 `worker/README.md`。

## 常用指令

| 指令 | 做什麼 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run build` / `npm start` | 打包（standalone）／啟動 |
| `npm run worker` | 本機 worker 常駐 |
| `npm run worker:enrich` | 只跑一次作品補資料 |
| `npm run worker:events` | 只跑一次藝文活動收集 |
| `npm run covers:review` | 檢視使用者補的封面 |
| `npm run spotify:backfill` | Spotify 收聽紀錄回補 |
| `npx vitest run`、`npm run lint`、`npx tsc --noEmit` | 測試與檢查，見 testing.md |

## 程式慣例
- 依功能分模組：商業邏輯寫成純函式，資料存取透過注入的 repository，方便單測。
- 送出後要換畫面的元件，直接用 API 或 Server Action 回傳的資料換畫面，不只靠 `router.refresh()`（打包版的 refresh 串流偶爾會被中斷）。
- 全站數字用阿拉伯數字；身分是筆名＋印章，不放頭像。
- 修 bug 先寫能重現的測試。
