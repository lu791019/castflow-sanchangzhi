import { describe, expect, it } from "vitest";
import { buildCandidates, mergeAuthorIds, type CandidateArticle } from "./candidates";
import { pickMatches, showWeekKey } from "./score";

const AUTHOR = "author";
const publishedAt = "2026-10-12T12:00:00Z";

function article(overrides: Partial<CandidateArticle>): CandidateArticle {
  return {
    id: "ep",
    user_id: AUTHOR,
    work_id: "public-work",
    published_at: publishedAt,
    visibility: "public",
    byline: "pen_name",
    ...overrides,
  };
}

describe("buildCandidates：候選人一側只用公開筆名文章", () => {
  const articles = [
    article({ id: "ep1", work_id: "public-work" }),
    article({ id: "ep2", work_id: "private-work", visibility: "private" }),
    article({ id: "ep3", work_id: "anon-work", byline: "anonymous" }),
    article({ id: "ep4", work_id: "draft-work", published_at: null }),
  ];

  it("作品與同週同場只取公開筆名文章", () => {
    const [candidate] = buildCandidates([AUTHOR], new Map([[AUTHOR, "同好"]]), articles, []);
    expect(candidate.works).toEqual(["public-work"]);
    expect(candidate.showWeeks).toEqual([showWeekKey("public-work", new Date(publishedAt))]);
  });

  it("候選人私下記過但沒公開的作品不會被配到也不會露出", () => {
    const candidates = buildCandidates([AUTHOR], new Map([[AUTHOR, "同好"]]), articles, []);
    const self = { works: ["private-work", "anon-work", "draft-work"], passages: [], showWeeks: [] };
    expect(pickMatches(self, candidates)).toEqual([]);

    const withPublic = pickMatches({ ...self, works: [...self.works, "public-work"] }, candidates);
    expect(withPublic).toHaveLength(1);
    expect(withPublic[0].commonWorks).toEqual(["public-work"]);
  });

  it("畫記句只算畫在公開筆名文章上的", () => {
    const marks = [
      { user_id: AUTHOR, episode_id: "ep1", passage_hash: "aaaa" },
      { user_id: AUTHOR, episode_id: "ep2", passage_hash: "bbbb" },
    ];
    const [candidate] = buildCandidates([AUTHOR], new Map([[AUTHOR, "同好"]]), articles, marks, new Set(["ep1"]));
    expect(candidate.passages).toEqual(["ep1:aaaa"]);
  });

  it("沒有筆名的人不列", () => {
    expect(buildCandidates([AUTHOR], new Map(), articles, [])).toEqual([]);
  });
});

describe("buildCandidates：併入向量相似", () => {
  it("有相似資料的人帶上 similarity 與對方那篇標題；沒有的不帶", () => {
    const articles = [article({ id: "ep1" }), article({ id: "ep9", user_id: "other", work_id: "w9" })];
    const similar = new Map([[AUTHOR, { similarity: 0.82, title: "那晚的雨" }]]);
    const candidates = buildCandidates(
      [AUTHOR, "other"],
      new Map([[AUTHOR, "同好"], ["other", "路人"]]),
      articles,
      [],
      new Set(),
      similar,
    );
    expect(candidates.find((c) => c.userId === AUTHOR)).toMatchObject({ similarity: 0.82, similarTitle: "那晚的雨" });
    expect(candidates.find((c) => c.userId === "other")?.similarity).toBeUndefined();
  });
});

describe("mergeAuthorIds：共同作品掃描名單＋相似作者，去重", () => {
  it("相似作者不在名單裡也會加進來，排除自己", () => {
    expect(mergeAuthorIds(["a", "b"], ["b", "c", "me"], "me")).toEqual(["a", "b", "c"]);
  });
});
