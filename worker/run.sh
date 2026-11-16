#!/bin/zsh
# launchd 進入點：先載 ~/.config/castflow/worker.env（雲端 Supabase／APP_URL，600 權限），
# 再啟動 worker。index.ts 的 loadEnvFile 不覆蓋既有環境變數，所以這裡的值優先於 repo 的 .env.*。
set -e
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin"
set -a; source "$HOME/.config/castflow/worker.env"; set +a
cd "$(dirname "$0")/.."
NODE="$(ls -d $HOME/.nvm/versions/node/v24*/bin/node 2>/dev/null | tail -1)"
[ -x "$NODE" ] || NODE="$(command -v node)"
exec "$NODE" worker/index.ts
