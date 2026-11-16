/**
 * 文章匯入的 server 端接線：依環境組 deps。
 * E2E（非 production 且設了 IMPORT_E2E_FIXTURES）改讀本地 fixture 網頁與 LLM 回覆，不打外部網站。
 */

import { readFile } from "node:fs/promises";
import { getServerNotify } from "@/lib/alerts/notify";
import { runClaudePrint } from "@/lib/anthropic/client";
import { fetchArticlePage, fixtureBasePath, fixturePageFetcher } from "./fetch-page";
import type { GuessLlm } from "./guess";
import { createSupabaseImportRepo } from "./repository";
import type { ImportDeps } from "./service";
import { externalOverridesAllowed } from "@/lib/e2e-overrides";

function fixtureDir(): string | null {
  if (!externalOverridesAllowed()) return null;
  return process.env.IMPORT_E2E_FIXTURES?.trim() || null;
}

/** fixture 模式的 LLM：回傳與網頁同名的 .llm.txt（照樣走 schema 解析）；網址從 prompt 拿不到，由 preview 帶入 */
function fixtureLlm(dir: string, pageUrl: string): GuessLlm {
  return async () => {
    const base = fixtureBasePath(dir, new URL(pageUrl));
    if (!base) throw new Error("fixture 路徑不合法");
    return readFile(`${base}.llm.txt`, "utf8");
  };
}

/** pageUrl：fixture 模式下用來找對應的 LLM 回覆；正式環境不用 */
export function createServerImportDeps(pageUrl: string | null = null): ImportDeps {
  const dir = fixtureDir();
  const notify = getServerNotify();
  return {
    repo: createSupabaseImportRepo(),
    fetchPage: dir ? fixturePageFetcher(dir) : fetchArticlePage,
    guessLlm: dir && pageUrl ? fixtureLlm(dir, pageUrl) : runClaudePrint,
    warn: async (title, detail) => {
      await notify("warn", title, detail);
    },
    now: () => new Date(),
  };
}
