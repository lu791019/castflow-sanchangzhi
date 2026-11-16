import { describe, expect, it } from "vitest";
import {
  computeCounts,
  publishProof,
  saveDraftSettings,
  type EpisodePatch,
  type ProofEpisodeRecord,
  type ProofRepo,
} from "./service";

interface FakeEpisode extends ProofEpisodeRecord {
  visibility: string;
}

const BODY = "# 燈亮的時候\n\n我哭了很久。";

function makeRepo(episodes: FakeEpisode[], bodies: Record<string, string | null> = {}) {
  const rows = new Map(episodes.map((episode) => [episode.id, { ...episode }]));
  const patches: Array<{ id: string; patch: EpisodePatch }> = [];
  const deletedSocial: string[] = [];
  const repo: ProofRepo = {
    async getEpisode(id) {
      return rows.get(id) ?? null;
    },
    async slugExists(slug) {
      return [...rows.values()].some((row) => row.share_slug === slug);
    },
    async updateEpisode(id, patch) {
      patches.push({ id, patch });
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, ...patch } as FakeEpisode);
    },
    async countListedWorkFeelings(workId, excludeId, upTo) {
      return [...rows.values()].filter(
        (row) =>
          row.work_id === workId &&
          row.visibility === "public" &&
          row.share_slug &&
          row.published_at &&
          (!upTo || row.published_at <= upTo) &&
          row.source !== "rss" &&
          row.id !== excludeId,
      ).length;
    },
    async countAuthorPublished(excludeId, upTo) {
      return [...rows.values()].filter(
        (row) =>
          row.published_at &&
          (!upTo || row.published_at <= upTo) &&
          row.source !== "rss" &&
          row.id !== excludeId,
      ).length;
    },
    async deleteSocialDrafts(episodeId) {
      deletedSocial.push(episodeId);
    },
    async getBlogBody(id) {
      return id in bodies ? bodies[id] : BODY;
    },
  };
  return { repo, rows, patches, deletedSocial };
}

const WORK = "work-1";
const published = (id: string, overrides: Partial<FakeEpisode> = {}): FakeEpisode => ({
  id,
  source: "text",
  work_id: WORK,
  share_slug: `slug-${id}`,
  published_at: "2026-10-01T00:00:00Z",
  visibility: "public",
  ...overrides,
});

const DRAFT: FakeEpisode = {
  id: "draft",
  source: "text",
  work_id: WORK,
  share_slug: null,
  published_at: null,
  visibility: "public",
};

const SETTINGS = {
  visibility: "public",
  byline: "pen_name",
  generateSocial: true,
  quote: "「有些人一直都在。」",
};

const fixedRandom = (seed: number) => (size: number) =>
  Uint8Array.from({ length: size }, (_, i) => (i + seed) * 7);

/** 每次呼叫換一組 bytes（同一個 deps 連續發佈兩篇時不撞 slug） */
const sequenceRandom = (seed: number) => {
  let call = 0;
  return (size: number) => fixedRandom(seed + call++)(size);
};

const NOW = () => new Date("2026-10-09T14:41:00Z");

describe("publishProof", () => {
  it("首次發佈：產生 slug、寫入公開狀態/引言/發佈時間，回傳第 n 篇與特輯第 n 段", async () => {
    const { repo, rows } = makeRepo([
      published("a"),
      published("b"),
      published("rss", { source: "rss" }),
      published("unlisted", { visibility: "unlisted" }),
      published("other-work", { work_id: "work-2" }),
      DRAFT,
    ]);
    const result = await publishProof({ repo, random: fixedRandom(1), now: NOW }, "draft", SETTINGS);

    expect(result.shareSlug).toMatch(/^[a-z0-9]{10}$/);
    expect(result.publishedAt).toBe("2026-10-09T14:41:00.000Z");
    // 作者已發佈：a、b、unlisted、other-work（rss 不算）→ 第 5 篇
    expect(result.authorOrdinal).toBe(5);
    // 特輯：只算公開、同作品、非 RSS → a、b → 第 3 段
    expect(result.workOrdinal).toBe(3);

    const row = rows.get("draft")!;
    expect(row.share_slug).toBe(result.shareSlug);
    expect(row.published_at).toBe(result.publishedAt);
    expect(row.visibility).toBe("public");
    expect((row as unknown as { pull_quote: string }).pull_quote).toBe("有些人一直都在。");
  });

  it("已有 slug 與發佈時間時沿用（重複發佈不換連結）", async () => {
    const existing = published("again", { visibility: "private" });
    const { repo } = makeRepo([existing]);
    const result = await publishProof({ repo, random: fixedRandom(2), now: NOW }, "again", SETTINGS);
    expect(result.shareSlug).toBe("slug-again");
    expect(result.publishedAt).toBe("2026-10-01T00:00:00Z");
  });

  it("slug 撞到既有連結會重抽", async () => {
    const random = fixedRandom(3);
    const { generateShareSlug } = await import("./publish");
    const taken = generateShareSlug(random);
    const { repo } = makeRepo([published("x", { share_slug: taken }), DRAFT]);
    let calls = 0;
    const result = await publishProof(
      { repo, random: (size) => (calls++ === 0 ? random(size) : fixedRandom(9)(size)), now: NOW },
      "draft",
      SETTINGS,
    );
    expect(result.shareSlug).not.toBe(taken);
  });

  it("私人/連結：不進特輯（workOrdinal = null）；未綁作品也是 null", async () => {
    const { repo } = makeRepo([published("a"), DRAFT, { ...DRAFT, id: "free", work_id: null }]);
    const deps = { repo, random: sequenceRandom(4), now: NOW };
    const privateResult = await publishProof(deps, "draft", { ...SETTINGS, visibility: "private" });
    expect(privateResult.workOrdinal).toBeNull();
    const unbound = await publishProof(deps, "free", SETTINGS);
    expect(unbound.workOrdinal).toBeNull();
  });

  it("關閉社群貼文 → 清掉社群草稿；開啟則保留", async () => {
    const { repo, deletedSocial } = makeRepo([DRAFT, { ...DRAFT, id: "keep" }]);
    const deps = { repo, random: sequenceRandom(5), now: NOW };
    await publishProof(deps, "draft", { ...SETTINGS, generateSocial: false });
    await publishProof(deps, "keep", SETTINGS);
    expect(deletedSocial).toEqual(["draft"]);
  });

  it("驗證：不合法設定、找不到集數、RSS 集數都拒絕且不寫入", async () => {
    const { repo, patches } = makeRepo([published("rss", { source: "rss" })]);
    const deps = { repo, random: fixedRandom(6), now: NOW };
    await expect(publishProof(deps, "x", { ...SETTINGS, visibility: "world" })).rejects.toThrow(/公開範圍/);
    await expect(publishProof(deps, "x", { ...SETTINGS, byline: "real" })).rejects.toThrow(/署名/);
    await expect(publishProof(deps, "x", { ...SETTINGS, generateSocial: "yes" })).rejects.toThrow(/社群/);
    await expect(publishProof(deps, "x", { ...SETTINGS, quote: 42 })).rejects.toThrow(/引言/);
    await expect(publishProof(deps, "missing", SETTINGS)).rejects.toThrow(/找不到/);
    await expect(publishProof(deps, "rss", SETTINGS)).rejects.toThrow(/RSS/);
    expect(patches).toHaveLength(0);
  });
});

describe("publishProof 擋下沒整理成功的正文（UX-02）", () => {
  it("正文帶【無法生成】→ 拒絕發佈且不寫入", async () => {
    const { repo, patches } = makeRepo([DRAFT], { draft: "【無法生成】收到的逐字稿只有一個「.」" });
    await expect(publishProof({ repo, random: fixedRandom(7), now: NOW }, "draft", SETTINGS)).rejects.toThrow(
      /沒有整理成功/,
    );
    expect(patches).toHaveLength(0);
  });

  it("沒有正文 → 拒絕發佈", async () => {
    const { repo, patches } = makeRepo([DRAFT], { draft: null });
    await expect(publishProof({ repo, random: fixedRandom(8), now: NOW }, "draft", SETTINGS)).rejects.toThrow(
      /還沒有整理好的正文/,
    );
    expect(patches).toHaveLength(0);
  });
});

describe("saveDraftSettings", () => {
  it("只寫設定與引言，不產生 slug、不設發佈時間", async () => {
    const { repo, patches } = makeRepo([DRAFT]);
    await saveDraftSettings(repo, "draft", { ...SETTINGS, visibility: "unlisted", quote: "" });
    expect(patches).toEqual([
      {
        id: "draft",
        patch: { visibility: "unlisted", byline: "pen_name", generate_social: true, pull_quote: null },
      },
    ]);
  });
});

describe("computeCounts（校樣預覽用）", () => {
  it("發佈前預覽：特輯第 n 段 = 既有公開段數 + 1", async () => {
    const { repo } = makeRepo([published("a"), published("b"), published("c"), DRAFT]);
    expect(await computeCounts(repo, DRAFT, "public")).toEqual({ authorOrdinal: 4, workOrdinal: 4 });
    expect(await computeCounts(repo, DRAFT, "unlisted")).toEqual({ authorOrdinal: 4, workOrdinal: null });
  });

  it("已發佈文章回看：只算在它之前發佈的，之後發佈的不讓序數漂移", async () => {
    const early = published("early", { published_at: "2026-10-01T00:00:00Z" });
    const mine = published("mine", { published_at: "2026-10-05T00:00:00Z" });
    const later = published("later", { published_at: "2026-10-09T00:00:00Z" });
    const { repo } = makeRepo([early, mine, later]);
    expect(await computeCounts(repo, mine, "public")).toEqual({ authorOrdinal: 2, workOrdinal: 2 });
  });
});
