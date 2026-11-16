import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run 容器：只打包執行所需檔案（見 Dockerfile）
  output: "standalone",
  // 專案根目錄明確指定（worktree 與主目錄各有 lockfile 時 Next 會猜錯 root）
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  // 設計稿、本機 worker、文件不屬於 web 執行期
  outputFileTracingExcludes: {
    "*": ["design/**", "worker/**", "test-assets/**", "e2e/**", "*.md"],
  },
  experimental: {
    serverActions: {
      // 說一段語音：錄音 blob 走 server action 上傳，放寬預設 1MB 限制
      bodySizeLimit: "25mb",
    },
    // 有 proxy 時 request body 預設只緩衝 10MB：worker 的 Groq 備援上傳最大 25MB（壓縮後），
    // 超過會被截斷成 Invalid request body。上限要低於 Cloud Run 單一請求 32MB
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
