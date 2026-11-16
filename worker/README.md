# CastFlow 本機 Worker（Phase 1d，Q-02 混合 runtime）

常駐迴圈：`poll RSS → 撈 uploaded episodes → 下載音訊 → mlx-whisper 本機轉錄 →
寫回 transcript → 觸發 /api/generate 六平台文案`。

介面契約：**只透過 HTTP API（x-api-key）與 Supabase DB（service key）互動，
不 import app 碼**——對外部署時這整層可替換為雲端函式。

## 執行

```bash
npm run worker            # 常駐（預設 60s 一輪）
WORKER_ONCE=1 npm run worker   # 只跑一輪（驗證用）
```

前置：dev server 在跑（`npm run dev`）、`mlx_whisper` CLI 在 PATH
（`uv tool install mlx-whisper`，裝在 `~/.local/bin`）、`ffmpeg` 可用。
env 讀 repo 根目錄 `.env.development.local`（優先）與 `.env.local`；**正式環境**由 `worker/run.sh` 先載 `~/.config/castflow/worker.env`（雲端 Supabase、`APP_URL`），其值優先。launchd 常駐見 `com.castflow.worker.plist`。

## 環境變數

| 變數 | 預設 | 說明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `API_SECRET_KEY` | （必填） | DB 與 app API 憑證 |
| `APP_URL` | `http://localhost:3000` | app API 位址 |
| `WORKER_INTERVAL_MS` | `60000` | 迴圈間隔 |
| `WORKER_BATCH_LIMIT` | `2` | 每輪最多處理集數 |
| `WHISPER_MODEL` | `mlx-community/whisper-medium-mlx-q4` | mlx 模型（首跑自動下載約 500MB） |
| `MLX_WHISPER_BIN` | `mlx_whisper` | CLI 路徑 |
| `MLX_TIMEOUT_MS` | `10800000`（3 小時） | 單集轉錄逾時（8GB 機器 78 分鐘的集數約需 85 分鐘） |
| `WORKER_CLIP_SECONDS` | （空） | 設定後只轉前 N 秒（驗證用） |
| `WORKER_ONCE` | （空） | `1` = 跑一輪就停 |
| `ALERT_LOG_PATH` | `worker/alerts.log` | 警報落檔位置 |
| `ALERT_WEBHOOK_URL` | （空） | 警報外推 webhook（POST JSON） |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_TO` | （空） | 兩者齊備即啟用 LINE push 警報 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | （空） | 兩者齊備即啟用「想說說嗎？」Web Push；缺則只寫 App 內通知 |
| `VAPID_SUBJECT` | `mailto:castflow@example.com` | VAPID 聯絡資訊（正式環境改成真的信箱） |
| `WORKER_EVENTS` | （空） | `off` = 停用藝文活動收集 |
| `EVENTS_INTERVAL_DAYS` | `7` | 藝文活動收集幾天跑一輪（台北日期，正整數） |
| `EVENTS_SOURCES` | （空 = 全部扣掉 kktix、accupass） | 只收這些來源，逗號分隔：`opentix,tfam,nmns,nmmba,songshan,nstm,tnam,ntm,nmh,cksmh,clab,moca,kdmofa`（`kktix`、`accupass` 條款禁止自動存取，預設不收，要明寫才跑） |
| `EVENTS_STATE_PATH` | `worker/events-state.json` | 藝文活動收集狀態檔（上次跑的日期、抓過的活動頁；不入庫） |
| `WORKER_SPOTIFY_LISTEN` | （空 = 關） | `on` = 開 Spotify 收聽紀錄提醒（要先套 migration 041） |
| `SPOTIFY_LISTEN_INTERVAL_MINUTES` | `20` | 幾分鐘拉一次最近播放（5–120 整數） |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | （空） | Spotify 應用金鑰（換使用者權杖用）；開了但缺 → 啟動時 warn 並停用 |
| `SPOTIFY_TOKEN_KEY` | （空） | refresh token 加密金鑰，32 bytes base64（`openssl rand -base64 32`），**要跟 Cloud Run 同一把** |

## 視聽日誌提醒（每輪、排在轉錄之前）

`GET /api/journal/due` → 每筆到期紀錄：建 `notifications`（unique 防重）→ 這輪新建的才推 Web Push
→ 寫 `reminded_at`。推播 404/410 自動清掉失效訂閱；其他失敗 warn、建通知或寫 `reminded_at` 失敗 error，
全走 `notify()`。有訂閱但沒設 VAPID 也會 warn（降級不靜默）。

## Spotify 收聽紀錄提醒（Q-64 C1，`WORKER_SPOTIFY_LISTEN=on` 才跑，預設每 20 分）

設定頁連結了 Spotify 的人（`spotify_connections` active）：解密 refresh token → 換存取權杖（換了新 refresh token 就加密存回）
→ 讀最近 50 首（`/me/player/recently-played`，只有歌曲沒有 Podcast）→ 4 小時內同一張專輯聽了過半（至少 3 首、最多要求 8 首；單曲與 < 4 首的不算）
→ 建 `listen_prompt` 通知「要不要記一筆《專輯》？」（同張同天一則，`unique(user_id, dedupe_key)`）→ 有訂閱就推播，點了開記一筆並預選那張。
收聽紀錄不落地。使用者撤銷授權或被移出允許名單 → 標 revoked、info 警報；429 → warn 並停這輪；其他失敗記 `last_error`＋warn。

## 手動作品補資料（每輪、排在轉錄之前）

`kind in (movie, series)` 且 `tmdb_id`、`enrich_status` 皆空的作品，每輪最多 5 筆用標題（+年份）搜 TMDB。
只在「結果唯一」或「第一筆標題完全相同」時回填（只補空欄），否則標 `ambiguous` / `not_found` 不再重打；
撞 `(kind, tmdb_id)` 唯一索引標 `duplicate` 並 warn（不自動合併）；TMDB 錯誤 warn、留空下一輪重試。
需 `TMDB_READ_ACCESS_TOKEN` 或 `TMDB_API_KEY`（缺則啟動時 warn、job 停用）。單次執行：`npm run worker:enrich`。

## 藝文活動收集（預設每 7 天一次、背景跑，Q-62）

距上次跑（台北日期）滿 `EVENTS_INTERVAL_DAYS` 天就背景跑一輪（約 3 分鐘，不擋轉錄）：KKTIX 官方 Atom feed（演出、展覽）、OPENTIX sitemap → 活動頁 JSON-LD、
Accupass 搜尋頁（音樂、藝文 × 本週、下週）→ 活動頁 JSON-LD、北美館展覽 JSON。各來源各自 `POST /api/events/ingest`（x-api-key）
寫進 `events` 表，Cloud Run 只讀不爬。禮貌規則：`CastflowBot/0.1` User-Agent、逾時 15 秒、同站間隔 1.1 秒、
活動頁 7 天才重抓（KKTIX 圖 30 天）、每天上限 KKTIX 圖 60／OPENTIX 150／Accupass 40 頁（幾天跑一輪就乘幾倍，每週一輪 OPENTIX 最多 1,050 頁、約 20 分鐘）；被擋（例如 Cloudflare 403）不重試不繞。
某來源失敗、0 筆、活動頁失敗過半都 warn。手動跑一輪（不看上次什麼時候跑）：`npm run worker:events`，加 `EVENTS_SOURCES=opentix,tfam` 只跑指定來源。
解析器與 fixture：`worker/events/`、`worker/fixtures/events/`。測試用的 fixture 是合成樣本（公開版不附第三方網頁快照）。

**預設來源**：全部扣掉 KKTIX（條款禁 Bot）與 Accupass（條款限只能透過其介面）。館方展覽來源（`worker/events/venues/`，只存標題、起訖、場地、海報網址、官網頁，不存介紹全文；
沒有結束日、起訖超過 400 天＝常設，不收）：

| 來源 | 網址 | 每輪請求 | 備註 |
|---|---|---|---|
| `nmns` 國立自然科學博物館 | 開放資料 `nmns.edu.tw/backend/opendata/Exhibition/list`（data.gov.tw 7499） | 1 | 政府資料開放授權 |
| `nmmba` 國立海洋生物博物館 | 開放資料 `nmmba.gov.tw/OpenData.aspx?SN=BF6D6EB9CB6876BB`（data.gov.tw 90320） | 1 | 日期混民國／西元、常空白 |
| `songshan` 松山文創園區 | `/exhibition`（?page=2，最多 3 頁） | 2 | 只收標題有「展」的（市集、博覽會、快閃不收） |
| `nstm` 國立科學工藝博物館 | `ExhibitionList.aspx`（第 1 頁＋從最後一頁往前，最多 3 頁） | 3 | robots 只開列表頁；CC BY-SA 4.0 署名另標授權 |
| `tnam` 臺南市美術館 | `/exhibition/current`、`/exhibition/upcoming` | 2 | 日文版頁面跳過 |
| `ntm` 國立臺灣博物館 | 四館區 `News_actives.aspx?n=…&_CSN=4479`（特展）＋ event.culture.tw 明細頁補日期 | 4＋明細（每輪上限 12、30 天內不重抓） | 列表沒日期 |
| `nmh` 國立歷史博物館 | `News_Actives_photo.aspx?n=6983` | 1 | 館外展用館外場地 |
| `cksmh` 中正紀念堂 | `News_Actives_photo.aspx?n=6067` | 1 | |
| `clab` 臺灣當代文化實驗場 | `/zh/events/`（RSC 酬載 initialEvents） | 1 | 只收展覽、演出；講座、工作坊不收 |
| `moca` 臺北當代藝術館 | `/tw/ExhibitionAndEvent/Exhibitions`（＋/Upcoming） | 2 | |
| `kdmofa` 關渡美術館 | `/mod/exhibition/index.php` | 1 | |

故宮、國美館、拓元、ibon、桃園市立美術館、北師美術館不碰；華山 robots 禁帶 `?` 的網址，不在這批。

## 降級鏈與警報（Q-19：降級不可靜默）

1. mlx 失敗 → **warn 警報** → fallback 呼叫既有 Groq 路徑 `/api/transcribe`
   （已下載的本機檔若 >25MB，先用 ffmpeg 壓成 16kHz 單聲道 32kbps 再 multipart 上傳；
   壓完仍超過則丟錯，不靜默截斷）
2. Groq 也失敗 → episode 標 `error` → **error 警報**
3. 文案生成失敗 → **error 警報**（逐字稿保留，episode 維持 transcribed）

警報單一入口 `notify()`（`worker/notify.ts`）：console + `alerts.log` 永遠寫；
warn/error 另外推 webhook / LINE（env 設了才送，同標題 10 分鐘節流）。
目前 LINE token 未配置 → 外推層待接，先以 console + alerts.log 落地。

## launchd 常駐

範本在 `com.castflow.worker.plist`（檔頭有安裝/停用指令），**預設不安裝**。
