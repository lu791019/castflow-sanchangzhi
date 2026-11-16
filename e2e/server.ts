/**
 * E2E 伺服器：與正式站（Dockerfile）同一種跑法——next build（output: standalone）→ 補 static、public → node standalone/server.js。
 * 不用 `next start`：它不支援 standalone 設定（會警告），跟正式站跑的不是同一個進入點。
 * playwright.config.ts 的 webServer 跑這支；也可手動起，搭 E2E_REUSE_SERVER=1 反覆跑單支 spec：
 *   E2E_REMOTE_REF=<ref> npm run e2e:server                    打包（.next，standalone）＋啟動（port $E2E_PORT，預設 3020）
 *   E2E_SKIP_BUILD=1 E2E_REMOTE_REF=<ref> npm run e2e:server   沿用上次打包，只啟動
 * env 與 playwright 相同（e2e/fixtures/server-env.ts）。外部服務路由由 playwright 的 globalSetup 起。
 */

import { spawn } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { E2E_PORT } from "./fixtures/env";
import { E2E_DIST_DIR, e2eServerEnv } from "./fixtures/server-env";

const root = process.cwd();
nextEnv.loadEnvConfig(root, true);
const env = { ...process.env, ...e2eServerEnv(), PORT: String(E2E_PORT), HOSTNAME: "127.0.0.1" };
const dist = path.join(root, E2E_DIST_DIR);
const standalone = path.join(dist, "standalone");

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    // 這支被停掉時連子程序一起停（standalone 伺服器的程序名是 next-server，不收會一直佔著 port）
    const stop = () => child.kill("SIGTERM");
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    child.on("exit", (code) => {
      process.off("SIGTERM", stop);
      process.off("SIGINT", stop);
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} 結束碼 ${code}`));
    });
  });
}

/** standalone 只帶伺服器程式：static 與 public 要自己補（同 Dockerfile 的兩個 COPY） */
function copyAssets(): void {
  for (const [from, to] of [
    [path.join(dist, "static"), path.join(standalone, E2E_DIST_DIR, "static")],
    [path.join(root, "public"), path.join(standalone, "public")],
  ]) {
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
  }
}

if (process.env.E2E_SKIP_BUILD !== "1") {
  await run("npx", ["next", "build"]);
  copyAssets();
}
await run("node", [path.join(standalone, "server.js")]);
