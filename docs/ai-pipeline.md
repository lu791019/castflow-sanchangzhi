# AI 管線

內容引擎在 `packages/engine`（套件名 `@castflow/engine`），是不依賴 Next.js 與 Supabase 的純函式，app 與 worker 都呼叫它。

## 一覽

| 階段 | 模型／工具 | 程式 |
|---|---|---|
| 轉錄（主要） | `mlx-whisper`，預設 `mlx-community/whisper-medium-mlx-q4`，本機 Apple Silicon | `worker/mlx.ts` |
| 轉錄（備援） | Groq `whisper-large-v3-turbo`，音檔先壓到 25MB 以下 | `packages/engine/src/transcribe`、`/api/transcribe` |
| 成文 | Anthropic Claude（預設 `claude-sonnet-4-6`，`ANTHROPIC_MODEL` 可換） | `packages/engine/src/generate` |
| 語氣 | 同上 | `packages/engine/src/style` |
| 閱讀頁 | 同上 | `packages/engine/src/understand` |
| 詞向量 | Voyage `voyage-3.5`，1024 維，存 pgvector | `src/lib/embeddings`、`src/lib/match` |

## 轉錄
1. worker 先跑 `mlx_whisper`（上限 `MLX_TIMEOUT_MS`，預設 3 小時；8GB 機器上 78 分鐘的集數約需 85 分鐘）。
2. 失敗或逾時就用 ffmpeg 壓縮，呼叫 app 的 `/api/transcribe` 走 Groq。
3. **降級一定發警報**：一律寫 `alerts.log`，有設 `ALERT_WEBHOOK_URL` 或 LINE（`LINE_CHANNEL_ACCESS_TOKEN`＋`LINE_TO`）就外推（`worker/notify.ts`），不靜默。
4. 語言偵測決定後續是否產雙語閱讀頁（`transcribe/language.ts`）；中文節目不做雙語對照。

## 成文（說一段 → 文章、Threads 貼文）
- 同一段原話可整理成 Threads 貼文或部落格長文（`generate/watched.ts`、`generate-content.ts`）。Podcast 一集一次產 6 個平台：threads、facebook、instagram、linkedin、blog、newsletter。
- **語氣靠範文，不靠形容詞**：prompt 帶使用者自己的 2～3 篇貼文全文當樣本，規則只當輔助。沒有樣本時走通用語氣，畫面提示可以補樣本。
- **長度跟著原話走**：校樣的短文上限 600 個漢字，超過就帶實際字數重試（`article-length.ts`）；看完了的部落格長版要原話至少 800 字才開放（`watched-prompt.ts` 的 `LONGFORM_MIN_SOURCE_CHARS`），避免一分鐘的話被灌成長文。太短的輸入直接不生成。
- **防 prompt injection**：使用者輸入一律包在資料區塊裡，並聲明它只是資料。
- **拒答處理**（`refusal.ts`）：模型拒絕或素材不足時回固定標記；只有主產物被拒才算失敗，校樣不給發佈並說明原因。

## 語氣萃取與修改學習（`style/`）
- 從樣本萃取語氣維度（`extract-style`）。
- 比對使用者對 AI 稿的修改，產生語氣調整建議（`analyze-edit`）。

## 閱讀頁（`understand/`）
- Podcast 逐字稿 → 雙語分段、摘要、章節（`bilingual`），分批翻譯，批次大小與並行數可調（`READING_BATCH_SIZE`、`READING_CONCURRENCY`）。
- 文章 → 三句引言候選（`quote-candidates`），給分享卡與作品特輯用。
- 輸出都經 schema 驗證，不合格整次重試。

## 品味配對
- 公開、筆名署名、已發佈的文章在發佈時排程算詞向量，worker 每輪補算漏掉的。
- 配對規則：共同作品至少 1 部，或文章 cosine 相似度 ≥0.75，取前 3 人（`src/lib/match/score.ts`）。門檻尚未用真實資料校準。
- 沒有 `VOYAGE_API_KEY` 時不報錯，配對只用共同作品。

## LLM 供應商
`packages/engine/src/llm/client.ts` 支援 `anthropic`、`openai`（預設 `gpt-4.1`）、`gemini`（預設 `gemini-2.5-flash`）、`cli`（本機 `claude --print`，只適合本機開發）。雲端部署請用 API 金鑰。

## 開發過程中的 AI
這個 repo 本身也是和 AI 代理（Claude Code）一起開發的：
- 主線拆工作與獨立複驗，子代理實作；高風險改動的測試由另一個代理寫，再做對抗式審查。
- 修 bug 先寫能重現的測試再修，測試永久留下。
- `REVIEW.md` 是給審查代理看的：這個專案「壞掉」長什麼樣、哪些路徑一改就算高風險。
