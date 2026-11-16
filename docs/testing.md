# 測試

## 單元與整合測試（Vitest）

```bash
npx vitest run       # 約 264 個測試檔、2,200 多項
npx tsc --noEmit
npm run lint
```

- 測試和程式放在一起（`*.test.ts`），涵蓋 `src`、`packages/engine`、`worker`、`e2e/fixtures`。
- 外部服務（LLM、Supabase、TMDB…）一律用注入的假實作，不打真的 API。
- **公開版排除的測試**：藝文活動解析器有 8 個測試檔（`worker/events/parsers.test.ts`、`sources.test.ts`、`venues/` 底下 6 個）讀的是各場館網頁的快照。快照屬第三方內容，公開版不附，所以在 `vitest.config.ts` 排除；`worker/fixtures/events/*/sample.*` 是自己寫的合成樣本。

## 端到端測試（Playwright）

```bash
npm run e2e                              # 打包＋啟動＋跑全部 spec
E2E_SKIP_BUILD=1 npm run e2e             # 沿用上次打包
npx playwright test e2e/<name>.spec.ts   # 只跑一支
```

- 先 `next build`（standalone），再用和正式環境相同的 `node server.js` 起在 port 3020，測試期間不即時編譯（`e2e/server.ts`）。
- 44 支 spec，涵蓋登入、記一筆、說一段、校樣、看完了、作品特輯、社群、散場之前、寬螢幕版型、觸控行為等。
- 外部服務網址會指到 globalSetup 起的假路由（`e2e/fixtures/mock-router.ts`），測試不讀也不掛靠任何既有資料，作品、文章、RSS 單集都自己種。
- 每個測試用唯一的 `e2e+…@example.com` 帳號，結束後刪掉該使用者的資料；只能動 `e2e-` 前綴的資料。
- **防呆**：對雲端 Supabase 跑要設 `E2E_REMOTE_REF=<project ref>` 明確同意，對不上就拒跑（`e2e/fixtures/env.ts`）。遠端模式會擋寄信，登入改用 admin `generateLink`。
- 報告輸出在 `test-results/report/`。

## 審查
`REVIEW.md` 列出這個專案「壞掉」長什麼樣與高風險路徑（登入、資料表、錄音、對外發送、部署設定），給人或 AI 審查者用。
