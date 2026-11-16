import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.ts";
import { GROQ_MAX_BYTES } from "./audio.ts";
import { loadWorkerConfig } from "./config.ts";

const MB = 1024 * 1024;

function sizeInBytes(limit: string | number | undefined): number {
  if (typeof limit === "number") return limit;
  const match = /^(\d+(?:\.\d+)?)\s*mb$/i.exec(limit ?? "");
  if (!match) throw new Error(`看不懂的大小設定：${String(limit)}`);
  return Number(match[1]) * MB;
}

describe("長集數轉錄的上限（11/9 EP13 78 分鐘實測）", () => {
  it("mlx 預設上限夠轉完 78 分鐘的集數：8GB 機器 29 分鐘只轉到 35%，整集約需 85 分鐘", () => {
    const config = loadWorkerConfig(
      { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "k", API_SECRET_KEY: "k" },
      "/repo/worker",
    );
    expect(config.mlxTimeoutMs).toBeGreaterThanOrEqual(2 * 60 * 60_000);
  });

  it("Groq 備援上傳不被 proxy 截斷：壓縮後最大 25MB＋multipart 開銷都要收得下（預設 10MB 會讓 18.6MB 的請求回 Invalid request body）", () => {
    const limit = sizeInBytes(nextConfig.experimental?.proxyClientMaxBodySize);
    expect(limit).toBeGreaterThan(GROQ_MAX_BYTES);
  });
});
