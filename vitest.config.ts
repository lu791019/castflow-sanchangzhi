import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "src/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
      "worker/**/*.test.ts",
      "e2e/fixtures/**/*.test.ts",
    ],
    // 這些解析器測試讀的是各場館網頁快照；快照屬第三方內容，公開版不附
    exclude: [
      "**/node_modules/**",
      "worker/events/parsers.test.ts",
      "worker/events/sources.test.ts",
      "worker/events/venues/{cms,collectors,images,listpages,opendata,sites}.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@castflow/engine": path.resolve(__dirname, "./packages/engine/src"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
