# REVIEW.md — 散場誌 CastFlow 審查重點

給審查者（人或 AI 代理）看的：這個專案「壞掉」長什麼樣、哪些路徑一改就算高風險。

## 這裡的「壞掉」長什麼樣
- **資料庫結構與寫入**：migration 或寫入邏輯錯了，壞的就是使用者資料。
- **E2E 只能動 `e2e-`／`e2e+` 前綴的資料**：測試或 override 碰到沒有前綴的資料＝改到真實使用者的資料。
- **對外發佈**（Threads／FB／推播／信件）送出就收不回：重複發、發錯帳號、排程時間錯，都算事故。
- **權限**：看到或改到別人的日誌、信件、作品（ownership／owned-reads 沒擋住）。
- **資料來源**：不新增條款禁止自動存取的來源（KKTIX、Accupass 預設不收）；IG／Threads 只走 Meta 官方 API。
- 印出 `.env*` 的值，包括 log、錯誤訊息、測試快照。

## 高風險路徑
命中任一條＝風險等級高。

```risk-paths
# 資料庫結構與 RLS 檢查
supabase/migrations/**
supabase/checks/**
# 權限與身分（server actions 內含 ownership 檢查）
src/app/**/actions.ts
src/lib/auth/**
src/app/auth/**
src/lib/api-guard.ts
src/proxy.ts
# 對外發佈與通知
src/lib/meta/**
src/app/api/publish/**
src/app/api/publish-scheduled/**
src/app/api/push/**
worker/push.ts
worker/notify.ts
# E2E 安全模式（防止測試碰真實資料的那道閘）
src/lib/e2e-overrides.ts
# 部署
cloudbuild.yaml
Dockerfile
worker/com.castflow.worker.plist
```

## 跳過不審
- `test-assets/**`、`package-lock.json`

## 小意見上限
- 每輪最多 3 則。
