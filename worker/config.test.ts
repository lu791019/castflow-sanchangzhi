import { describe, expect, it } from "vitest";
import {
  DEFAULT_BATCH_LIMIT,
  DEFAULT_INTERVAL_MS,
  DEFAULT_WHISPER_MODEL,
  loadWorkerConfig,
} from "./config.ts";

const WORKER_DIR = "/repo/worker";

function baseEnv(): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    API_SECRET_KEY: "api-key",
  };
}

describe("loadWorkerConfig", () => {
  it("必填齊備時套用預設值", () => {
    const config = loadWorkerConfig(baseEnv(), WORKER_DIR);
    expect(config.appUrl).toBe("http://localhost:3000");
    expect(config.intervalMs).toBe(DEFAULT_INTERVAL_MS);
    expect(config.batchLimit).toBe(DEFAULT_BATCH_LIMIT);
    expect(config.whisperModel).toBe(DEFAULT_WHISPER_MODEL);
    expect(config.clipSeconds).toBeNull();
    expect(config.alertLogPath).toBe("/repo/worker/alerts.log");
    expect(config.alertWebhookUrl).toBeNull();
    expect(config.lineToken).toBeNull();
  });

  it("缺必填鍵時一次列出全部缺項", () => {
    expect(() =>
      loadWorkerConfig({ API_SECRET_KEY: "x" }, WORKER_DIR),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("覆蓋值生效且 APP_URL 去除尾斜線", () => {
    const config = loadWorkerConfig(
      {
        ...baseEnv(),
        APP_URL: "http://localhost:3100/",
        WORKER_INTERVAL_MS: "5000",
        WORKER_CLIP_SECONDS: "120",
        WHISPER_MODEL: "mlx-community/whisper-small-mlx",
        LINE_CHANNEL_ACCESS_TOKEN: "token",
        LINE_TO: "user-id",
      },
      WORKER_DIR,
    );
    expect(config.appUrl).toBe("http://localhost:3100");
    expect(config.intervalMs).toBe(5000);
    expect(config.clipSeconds).toBe(120);
    expect(config.whisperModel).toBe("mlx-community/whisper-small-mlx");
    expect(config.lineToken).toBe("token");
    expect(config.lineTo).toBe("user-id");
  });

  it("數值欄位收到非正數時擲錯", () => {
    expect(() =>
      loadWorkerConfig({ ...baseEnv(), WORKER_INTERVAL_MS: "abc" }, WORKER_DIR),
    ).toThrow(/WORKER_INTERVAL_MS/);
    expect(() =>
      loadWorkerConfig({ ...baseEnv(), WORKER_CLIP_SECONDS: "-5" }, WORKER_DIR),
    ).toThrow(/WORKER_CLIP_SECONDS/);
  });
});

describe("loadWorkerConfig.vapid", () => {
  it("未設定 → null（Web Push 停用）", () => {
    expect(loadWorkerConfig(baseEnv(), WORKER_DIR).vapid).toBeNull();
  });

  it("只設公鑰 → 仍為 null", () => {
    expect(loadWorkerConfig({ ...baseEnv(), VAPID_PUBLIC_KEY: "pub" }, WORKER_DIR).vapid).toBeNull();
  });

  it("公私鑰齊備 → 啟用，subject 有預設、可覆蓋", () => {
    const env = { ...baseEnv(), VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv" };
    expect(loadWorkerConfig(env, WORKER_DIR).vapid).toEqual({
      publicKey: "pub",
      privateKey: "priv",
      subject: "mailto:castflow@example.com",
    });
    expect(
      loadWorkerConfig({ ...env, VAPID_SUBJECT: "mailto:me@x.test" }, WORKER_DIR).vapid?.subject,
    ).toBe("mailto:me@x.test");
  });

  it("藝文活動收集：預設開、每 7 天、全部來源扣掉 KKTIX 與 Accupass（條款禁止自動存取）、狀態檔在 worker 目錄；WORKER_EVENTS=off 停用", () => {
    expect(loadWorkerConfig(baseEnv(), WORKER_DIR).events).toEqual({
      enabled: true,
      statePath: "/repo/worker/events-state.json",
      intervalDays: 7,
      sources: ["opentix", "tfam", "nmns", "nmmba", "songshan", "nstm", "tnam", "ntm", "nmh", "cksmh", "clab", "moca", "kdmofa"],
    });
    expect(loadWorkerConfig({ ...baseEnv(), WORKER_EVENTS: "off", EVENTS_STATE_PATH: "/tmp/s.json" }, WORKER_DIR).events).toMatchObject({
      enabled: false,
      statePath: "/tmp/s.json",
    });
  });

  it("藝文活動收集：EVENTS_INTERVAL_DAYS 改間隔、EVENTS_SOURCES 指定來源（逗號分隔）；寫錯就丟錯", () => {
    expect(loadWorkerConfig({ ...baseEnv(), EVENTS_INTERVAL_DAYS: "1", EVENTS_SOURCES: " opentix, tfam ,opentix" }, WORKER_DIR).events).toMatchObject({
      intervalDays: 1,
      sources: ["opentix", "tfam"],
    });
    expect(() => loadWorkerConfig({ ...baseEnv(), EVENTS_INTERVAL_DAYS: "1.5" }, WORKER_DIR)).toThrow(/EVENTS_INTERVAL_DAYS/);
    expect(() => loadWorkerConfig({ ...baseEnv(), EVENTS_INTERVAL_DAYS: "0" }, WORKER_DIR)).toThrow(/EVENTS_INTERVAL_DAYS/);
    expect(() => loadWorkerConfig({ ...baseEnv(), EVENTS_SOURCES: "opentix,ibon" }, WORKER_DIR)).toThrow(/EVENTS_SOURCES.*ibon/);
    expect(() => loadWorkerConfig({ ...baseEnv(), EVENTS_SOURCES: " , " }, WORKER_DIR)).toThrow(/EVENTS_SOURCES/);
  });
});
