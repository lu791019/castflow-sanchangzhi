# 部署

正式站的配置：Web 在 Google Cloud Run，資料在 Supabase，worker 在一台 Apple Silicon Mac 上用 launchd 常駐。

## 1. Supabase
1. 建專案，套用 `supabase/migrations/`（見 data-model.md）。
2. Auth：Site URL 與 redirect URL 設成你的網域；SMTP 建議接自己的寄信服務（例如 Resend），登入信版型用 `supabase/templates/magic-link.html`。
3. 確認 `audio` bucket 是 private（migration 020）。

## 2. Web（Cloud Run）
映像用 Cloud Build 建，不需要本機 Docker：

```bash
gcloud builds submit --region <REGION> --config cloudbuild.yaml \
  --substitutions=_SUPABASE_URL=<url>,_SUPABASE_ANON_KEY=<anon>,_IMAGE=<REGION>-docker.pkg.dev/<PROJECT>/<REPO>/web,SHORT_SHA=$(git rev-parse --short HEAD)

gcloud run deploy castflow --region <REGION> \
  --image <REGION>-docker.pkg.dev/<PROJECT>/<REPO>/web:<sha> \
  --min-instances 0 --memory 1Gi --timeout 3600
```

- `Dockerfile` 三階段建置，`output: "standalone"`，容器聽 `$PORT`。
- `NEXT_PUBLIC_*` 是 build arg；其他機密（service role、`API_SECRET_KEY`、各家 API 金鑰）建議放 Secret Manager 掛進環境變數。
- `min-instances 0` 閒置不計費；不要設成 1 以上，除非你要付常駐費用。
- `next.config.ts` 設了 `experimental.proxyClientMaxBodySize: "30mb"`：有 proxy 時 Next.js 預設只緩衝 10MB 請求本體，worker 的 Groq 備援上傳會被截斷。上限要低於 Cloud Run 單一請求的 32MB。
- 為什麼不用 Vercel：說一段錄音上限 25MB、雙語閱讀長請求，都超過 serverless 函式的請求本體與時間限制。

## 3. Worker（本機 Mac）
1. 安裝 `mlx_whisper`、`ffmpeg`、Node 24。
2. 把 worker 的環境變數（`APP_URL` 指向 Cloud Run 網址、Supabase service role、`API_SECRET_KEY`、`VAPID_*` 等）放在 repo 外的檔案，由 `worker/run.sh` 載入。
3. 複製 `worker/com.castflow.worker.plist`，把 `/PATH/TO/castflow` 換成實際路徑，放到 `~/Library/LaunchAgents/` 後：

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.castflow.worker.plist
launchctl kickstart -k gui/$(id -u)/com.castflow.worker   # 重啟
launchctl bootout gui/$(id -u)/com.castflow.worker        # 停用
```

log 在 `worker/logs/`。Mac 關機時轉錄與提醒會暫停。

## 上線後檢查
- 首頁、作品頁、分享頁、登入頁回 200。
- 用新帳號走一次：登入信 → 說一段 → 校樣 → 發佈。
- worker log 看到一輪完整處理結果，不是只有啟動訊息。
