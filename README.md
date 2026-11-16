# 散場誌 CastFlow

看完、聽完、逛完，說一段，變成一篇你的文章。

散場誌是電影、影集、Podcast、音樂、演出與展覽的視聽日誌。你不用坐下來寫心得：散場後記一筆，隔天它來問你一句「想說說嗎？」，你用說的（或打字）講一段，AI 把原話整理成一篇保有你語氣的文章，你在校樣上改到滿意再發佈。發佈後的文章會聚到同一部作品的「作品特輯」，跟其他看過的人放在一起。

正式站：<https://castflow.daydreamdex.com>

## 一篇文章怎麼來的

```
記一筆 ──► 隔天提醒 ──► 說一段 ──► AI 成文 ──► 校樣 ──► 發佈 ──► 作品特輯
```

| 步驟 | 做什麼 | 主要程式 |
|------|--------|----------|
| 記一筆 | 選作品（TMDB／Apple Podcasts／Apple Music／藝文活動）、時間、場地、同行的人；也能排未來的場次 | `src/app/(social)/journal`、`src/lib/journal`、`src/lib/work-picker` |
| 隔天提醒 | 依設定算 `remind_at`（預設隔天中午，半夜看完算當天中午；或半天後、避開深夜），worker 建 App 內通知並推 Web Push | `src/lib/journal/remind.ts`、`worker/notify.ts`、`worker/push.ts` |
| 說一段 | 錄音或打字；未登入也能先說，之後再登入認領 | `src/app/(social)/say`、`src/lib/say` |
| AI 成文 | 錄音轉文字 → 依原話整理成貼文或長文，語氣跟著使用者的樣本走 | `packages/engine` |
| 校樣 | 整理稿以「校樣」呈現，可直接改（桌機左稿右側欄）；模型拒答或素材不足時不給發佈 | `src/app/proof/[episodeId]`、`src/lib/proof` |
| 發佈 | 公開／只給有連結的人／私人；筆名或匿名署名；分享頁有 OG 圖 | `src/app/s/[slug]`、`src/lib/share` |
| 作品特輯 | 同一部作品的所有公開文章、「大家最有共鳴的一句」、這週散場的人 | `src/app/(social)/works/[slug]`、`src/lib/resonance` |

圍繞這條主線的還有：「看完了 → Threads」（同一段話整理成你語氣的 Threads 貼文）、Podcast 創作者用的 RSS 訂閱 → 自動轉錄 → 6 平台文案、讀者回信（稿紙格、140 字、作者決定刊不刊登）、句邊共鳴記號、「散場之前」（這週上映、開演、開展的作品與活動）、依品味與詞向量的推薦、Spotify 收聽紀錄提醒、搬進舊文章（RSS／貼文字）。

## 技術棧

| 層 | 用什麼 |
|---|---|
| 前端與伺服器 | Next.js 16（App Router、Server Actions）、React 19、Tailwind CSS 4、TypeScript |
| 資料 | Supabase：Postgres＋RLS、pgvector、Auth（email magic link）、Storage |
| 部署 | Google Cloud Run（standalone 容器、Cloud Build） |
| 背景工作 | 本機 Node worker（launchd 常駐） |
| AI | Anthropic Claude（成文、語氣、閱讀頁）、mlx-whisper＋Groq Whisper（轉錄）、Voyage（詞向量）；可切換 OpenAI、Gemini |
| 推播 | Web Push（VAPID） |
| 測試 | Vitest、Playwright |

## 架構一眼看

```
瀏覽器 ──► Next.js（Cloud Run）──► Supabase
              │  └─ @castflow/engine（內容引擎）
              └──► LLM／Groq／Voyage／TMDB／iTunes／Spotify
本機 worker ──► Supabase＋app API：轉錄、提醒推播、補資料、藝文活動收集
```

細節見 [docs/architecture.md](docs/architecture.md)。

## 快速開始

```bash
npm install
cp .env.example .env.local      # 填入 Supabase 與需要的 API 金鑰
# 套用 supabase/migrations/*.sql
npm run dev                     # http://localhost:3000
npm run worker                  # 另一個終端機（轉錄需要 Apple Silicon＋mlx_whisper＋ffmpeg）
```

## 技術文件

| 文件 | 內容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | 三個執行單位、目錄結構、主要流程、登入與權限、功能開關 |
| [docs/ai-pipeline.md](docs/ai-pipeline.md) | 轉錄、成文、語氣、閱讀頁、品味配對、LLM 供應商 |
| [docs/data-model.md](docs/data-model.md) | 資料表、設計決定、套用 migration |
| [docs/api.md](docs/api.md) | API 路由與驗證方式 |
| [docs/development.md](docs/development.md) | 本機開發、環境變數、常用指令、程式慣例 |
| [docs/testing.md](docs/testing.md) | Vitest、Playwright E2E、審查 |
| [docs/deployment.md](docs/deployment.md) | Supabase、Cloud Run、本機 worker |
| [worker/README.md](worker/README.md) | worker 環境變數、排程、藝文活動來源 |
| [REVIEW.md](REVIEW.md) | 給審查者：哪些路徑一改就算高風險 |

## 資料來源與禮貌

- 影劇資料與海報：TMDB。*This product uses the TMDB API but is not endorsed or certified by TMDB.*
- Podcast 與音樂：Apple Podcasts／iTunes Search API、Spotify Web API。
- 藝文活動：OPENTIX sitemap 與活動頁 JSON-LD、北美館、政府開放資料（科博館、海生館）與各館展覽列表（`worker/events`）。遵守 robots.txt、不繞 CAPTCHA、固定 User-Agent、同站間隔 1.1 秒、有每日上限；被擋不重試。KKTIX 與 Accupass 的條款限制自動存取，解析器保留但**預設不收**。館方來源只存標題、起訖、場地、海報網址與官網連結。
- IG／Threads 只走 Meta 官方 API。

## 目前狀態與限制

已上線並自用中，正在找第一批使用者。

- 文字配對已會計算、介面也有，但使用者還少，相似度門檻尚未用真實資料校準。
- 用聲音（語速、停頓、高低起伏）找相近的人還只是構想，沒有程式。
- 轉錄與提醒依賴本機 Mac worker，Mac 關機時暫停。
- Threads 直發需另外申請 Meta 權限；目前是開啟 Threads 網頁發文頁帶入文字。
- 「看完了」產出的貼文還不會同時出現在散場誌站上。
- 電子報只產文案，不寄送。
- 只有手機網頁（PWA），沒有原生 App。

## 公開版拿掉了什麼

這是從私人 repo 整理出的快照，不含 git 歷史。拿掉的有：

- 開發過程的交接、計畫與任務紀錄，設計原稿與截圖（`design/`），AI 代理的本機設定。
- 部署細節：雲端專案 ID、映像庫路徑、本機路徑改成佔位字（`cloudbuild.yaml`、`worker/com.castflow.worker.plist`）。
- 藝文活動解析器的網頁快照 fixture：換成自己寫的合成樣本，依賴原快照的 8 個測試檔在 `vitest.config.ts` 排除（見 docs/testing.md）。

## 授權

- 程式碼以 [GNU AGPL-3.0](LICENSE) 授權：可以使用、修改、散布；修改後拿去架設網路服務，也必須公開修改後的原始碼。
- `public/og/neutral-serif-tc-700.ttf` 是 Noto Serif TC Bold 的子集，SIL Open Font License 1.1。
