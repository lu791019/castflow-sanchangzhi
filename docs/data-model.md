# 資料模型

資料庫是 Supabase Postgres，結構全部在 `supabase/migrations/`（38 支，依編號套用；編號 018、034–036 從未使用，跳號是正常的）。所有資料表都開 RLS（`015_rls_and_per_user_feeds.sql`），`supabase/checks/` 是 RLS 驗證腳本。

## 主要資料表

| 群組 | 表 | 用途 | 建立於 |
|---|---|---|---|
| 身分 | `profiles` | 筆名、印文、專欄名、預設公開範圍；筆名只經 server 寫入 | 013、017、019、022、025 |
| 作品 | `works` | 電影、影集、Podcast 單集、音樂專輯、演出、展覽；存外部來源鍵（TMDB、iTunes…）供去重 | 007、012、014、037 |
| | `work_links` | 在哪看／去哪買票的連結 | 027 |
| | `work_cover_submissions` | 使用者補的封面 | 030 |
| | `events` | worker 收集的藝文活動（散場之前） | 038、039 |
| 日誌 | `journal_entries` | 記一筆：作品、時間、場地、同行、看過或計畫中、`remind_at` | 010、026、032 |
| | `notifications` | App 內通知收件匣 | 010、041 |
| | `push_subscriptions` | Web Push 訂閱 | 010 |
| 說一段與文章 | `episodes` | 一段錄音、一段打字或一集 Podcast；狀態從 `uploaded`（待轉錄）到 `transcribed`（已轉錄）；`share_slug` 有值即公開 | 001、004、005、009、011、021、033 |
| | `transcripts` | 逐字稿 | 001 |
| | `contents` | 各平台產出（文章、Threads 貼文、Podcast 6 平台文案） | 001、003 |
| | `episode_readings` | Podcast 雙語閱讀頁：分段、摘要、章節 | 008 |
| | `feeds` | Podcast RSS 訂閱；同一 feed 多人共用逐字稿 | 006、015 |
| 社群 | `passage_resonances` | 「這句我也是」：讀者在某一段留下的記號 | 024 |
| | `letters`、`letter_blocks` | 讀者寫給作者的信、作者回覆與刊登、封鎖寄信人 | 023 |
| 品味與配對 | `taste_profiles` | 新人三題問卷 | 028、040 |
| | `episode_embeddings` | 公開文章的詞向量（pgvector，1024 維） | 031 |
| 語氣 | `voice_samples` | 使用者貼的自己的貼文，當 Threads 語氣樣本 | 042 |
| | `style_dnas`、`style_examples`、`writing_rules` | Podcast 文案後台的語氣設定與範文 | 001 |
| Podcast 後台 | `platform_templates`、`publish_logs`、`settings` | 平台模板、發佈紀錄、key-value 設定 | 001、002 |
| 外部帳號 | `spotify_connections` | Spotify 連結（權杖以 `SPOTIFY_TOKEN_KEY` 加密，`src/lib/spotify/token-crypto.ts`） | 041 |

## 幾個設計決定

- **私人與公開分開**：`episodes.share_slug` 為空就只有本人看得到。詞向量只收「公開＋筆名署名＋已發佈＋有分享網址＋非 RSS」的文章（`031_episode_embeddings.sql`），私人日誌不進配對。
- **錄音私有**：`audio` bucket 先建成 public（016），上線前改 private（020）；所有讀取走簽名網址。
- **同 feed 共用逐字稿**：多人訂閱同一個 Podcast 只轉錄一次（015）。
- **寫入走 server**：RLS 擋直接寫入，筆名唯一性、長度、控制字元等規則在 TypeScript 檢查（017）。

## 套用 migration

```bash
# 方式一：Supabase CLI（能連 5432 時）
supabase link --project-ref <your-ref>
supabase db push

# 方式二：網路擋資料庫埠時，用 Management API 逐檔執行
# POST https://api.supabase.com/v1/projects/<ref>/database/query
# 每檔包在 begin/commit，並寫一筆 supabase_migrations.schema_migrations，CLI 之後才認得
```

登入信版型在 `supabase/templates/magic-link.html`，用 Management API `PATCH /v1/projects/<ref>/config/auth` 套用。
