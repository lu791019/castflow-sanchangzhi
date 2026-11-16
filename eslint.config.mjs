import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 設計稿匯出（含 vendored React）與 agent worktree 不屬於本專案原始碼
    "design/**",
    ".claude/**",
    // E2E 打包產物與報告（playwright.config.ts）
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
