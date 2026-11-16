import { describe, expect, it } from "vitest";
import {
  formatChapterLength,
  formatClock,
  formatDurationLabel,
  parseDuration,
} from "./duration";
import {
  coverCardNumber,
  episodeMetaLine,
  episodeNumberLabel,
  formatAiredDate,
  parsePositiveInt,
} from "./episode-meta";
import {
  activeIndexAt,
  buildQuoteHref,
  buildSayHref,
  nextPlaybackRate,
  normalizeQuote,
  QUOTE_MAX_LENGTH,
  skipTime,
} from "./playback";
import { estimateRemainingMinutes, isReadable, processingStages } from "./progress";

describe("parseDuration（秒數與 時:分:秒 兩種格式）", () => {
  it("純秒數（股癌/Lenny/百靈果）", () => {
    expect(parseDuration("3044")).toBe(3044);
    expect(parseDuration(" 120 ")).toBe(120);
    expect(parseDuration("3044.7")).toBe(3044);
    expect(parseDuration(95)).toBe(95);
  });

  it("時:分:秒 與 分:秒（通勤/The Daily）", () => {
    expect(parseDuration("00:52:29")).toBe(3149);
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("52:29")).toBe(3149);
    expect(parseDuration("02:00")).toBe(120);
  });

  it("無法解析或為 0 → null", () => {
    for (const bad of ["", "abc", "1:2:3:4", "12:75", "1:75:00", "0", "00:00:00", null, undefined, -5, NaN]) {
      expect(parseDuration(bad)).toBeNull();
    }
  });
});

describe("formatClock / formatDurationLabel / formatChapterLength", () => {
  it("播放器時間", () => {
    expect(formatClock(711)).toBe("11:51");
    expect(formatClock(3723)).toBe("1:02:03");
    expect(formatClock(-3)).toBe("00:00");
    expect(formatClock(Number.NaN)).toBe("00:00");
  });

  it("長度標籤", () => {
    expect(formatDurationLabel(2892)).toBe("48 分 12 秒");
    expect(formatDurationLabel(120)).toBe("2 分");
    expect(formatDurationLabel(45)).toBe("45 秒");
    expect(formatDurationLabel(3720)).toBe("1 小時 2 分");
    expect(formatDurationLabel(7200)).toBe("2 小時");
  });

  it("章節長度", () => {
    expect(formatChapterLength(185)).toBe("3 分");
    expect(formatChapterLength(20)).toBe("1 分內");
  });
});

describe("集數顯示規則", () => {
  it("有季數 → S6・EP7；只有集數 → EP703", () => {
    expect(episodeNumberLabel({ episodeNumber: 7, seasonNumber: 6 })).toBe("S6・EP7");
    expect(episodeNumberLabel({ episodeNumber: 703, seasonNumber: null })).toBe("EP703");
  });

  it("沒有集數就不顯示（只有季數也不顯示）", () => {
    expect(episodeNumberLabel({ episodeNumber: null, seasonNumber: null })).toBeNull();
    expect(episodeNumberLabel({ episodeNumber: null, seasonNumber: 6 })).toBeNull();
    expect(episodeNumberLabel({ episodeNumber: 0, seasonNumber: 1 })).toBeNull();
  });

  it("parsePositiveInt：RSS 欄位只收正整數", () => {
    expect(parsePositiveInt("7")).toBe(7);
    expect(parsePositiveInt(" 703 ")).toBe(703);
    expect(parsePositiveInt(12)).toBe(12);
    for (const bad of ["", "0", "-1", "1.5", "EP7", null, undefined]) {
      expect(parsePositiveInt(bad)).toBeNull();
    }
  });

  it("字卡大字只在有集數時出現", () => {
    expect(coverCardNumber({ episodeNumber: 58, seasonNumber: null })).toBe("58");
    expect(coverCardNumber({ episodeNumber: null, seasonNumber: null })).toBeNull();
  });
});

describe("episodeMetaLine", () => {
  it("集數・日期・長度・作者（不寫主持人）", () => {
    expect(
      episodeMetaLine({
        episodeNumber: 7,
        seasonNumber: 6,
        airedAt: "2026-10-02T22:00:00Z",
        durationSeconds: 2892,
        author: "heartwander",
      }),
    ).toBe("S6・EP7・2026.10.03・48 分 12 秒・作者 heartwander");
  });

  it("缺欄位直接略過", () => {
    expect(
      episodeMetaLine({
        episodeNumber: null,
        seasonNumber: null,
        airedAt: "2026-10-08T10:00:00Z",
        durationSeconds: 120,
        author: null,
      }),
    ).toBe("2026.10.08・2 分");
    expect(formatAiredDate("not a date")).toBeNull();
  });
});

describe("播放同步", () => {
  const starts = [0, 6.5, 12, 30];

  it("activeIndexAt：最後一個 start ≤ t", () => {
    expect(activeIndexAt(starts, 0)).toBe(0);
    expect(activeIndexAt(starts, 6.4)).toBe(0);
    expect(activeIndexAt(starts, 6.5)).toBe(1);
    expect(activeIndexAt(starts, 99)).toBe(3);
    expect(activeIndexAt([2, 4], 1)).toBe(-1);
    expect(activeIndexAt([], 5)).toBe(-1);
  });

  it("±15 秒夾在範圍內", () => {
    expect(skipTime(10, -15, 120)).toBe(0);
    expect(skipTime(110, 15, 120)).toBe(120);
    expect(skipTime(110, 15, null)).toBe(125);
  });

  it("倍速循環 1 → 1.25 → 1.5 → 2 → 1", () => {
    expect(nextPlaybackRate(1)).toBe(1.25);
    expect(nextPlaybackRate(2)).toBe(1);
    expect(nextPlaybackRate(3)).toBe(1);
  });
});

describe("引用到我的感受", () => {
  it("normalizeQuote 壓空白、去引號、過長截斷", () => {
    expect(normalizeQuote("  「門口的燈\n亮著。」 ")).toBe("門口的燈 亮著。");
    expect(normalizeQuote("   ")).toBeNull();
    const long = normalizeQuote("字".repeat(500));
    expect(long).toHaveLength(QUOTE_MAX_LENGTH);
    expect(long?.endsWith("…")).toBe(true);
  });

  it("網址帶 work + quote（編碼）；沒綁作品只帶 quote", () => {
    expect(buildQuoteHref("the-daily-failed-execution", "她 & 我")).toBe(
      "/say?work=the-daily-failed-execution&quote=%E5%A5%B9+%26+%E6%88%91",
    );
    expect(buildQuoteHref(null, "a")).toBe("/say?quote=a");
    expect(buildSayHref("x-y")).toBe("/say?work=x-y");
    expect(buildSayHref(null)).toBe("/say");
  });
});

describe("轉錄中估算", () => {
  it("尚未轉錄：轉錄排隊、翻譯等待；大約分鐘數依長度估算", () => {
    const stages = processingStages({
      hasTranscript: false,
      episodeStatus: "uploaded",
      readingStatus: "no_transcript",
    });
    expect(stages.map((s) => s.state)).toEqual(["queued", "waiting", "waiting"]);
    // 48 分鐘 × (0.16 + 0.13) ≈ 13.9 分 → 14（2026-10-10 France 那集實測速率）
    expect(estimateRemainingMinutes(2880, stages)).toBe(14);
  });

  it("轉錄完成、翻譯進行中：只剩翻譯", () => {
    const stages = processingStages({
      hasTranscript: true,
      episodeStatus: "transcribed",
      readingStatus: "pending",
    });
    expect(stages.map((s) => s.state)).toEqual(["done", "active", "waiting"]);
    expect(estimateRemainingMinutes(3600, stages)).toBe(8);
    expect(estimateRemainingMinutes(60, stages)).toBe(1);
  });

  it("長度未知不給數字；完成不給數字", () => {
    const pending = processingStages({ hasTranscript: false, episodeStatus: "transcribing", readingStatus: "no_transcript" });
    expect(pending[0].state).toBe("active");
    expect(estimateRemainingMinutes(null, pending)).toBeNull();
    const done = processingStages({ hasTranscript: true, episodeStatus: "transcribed", readingStatus: "ready" });
    expect(estimateRemainingMinutes(600, done)).toBeNull();
  });

  it("isReadable：ready，或中文節目 skipped 且有逐字稿", () => {
    expect(isReadable({ hasTranscript: true, readingStatus: "ready" })).toBe(true);
    expect(isReadable({ hasTranscript: true, readingStatus: "skipped" })).toBe(true);
    expect(isReadable({ hasTranscript: false, readingStatus: "skipped" })).toBe(false);
    expect(isReadable({ hasTranscript: true, readingStatus: "pending" })).toBe(false);
  });
});
