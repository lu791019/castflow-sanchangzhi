import { describe, expect, it } from "vitest";
import { addUrls, nextQueued, splitPastedUrls, updateItem, type QueueItem } from "./queue";

describe("splitPastedUrls", () => {
  it("換行、空白、逗號都能分隔；去空與重複", () => {
    expect(splitPastedUrls(" https://a.com/1\nhttps://a.com/2  https://a.com/1 , https://b.com/3\n\n")).toEqual([
      "https://a.com/1",
      "https://a.com/2",
      "https://b.com/3",
    ]);
  });
});

describe("addUrls", () => {
  it("新網址排到最後、狀態 queued；佇列裡已有的不重複加；不改動原佇列", () => {
    let seq = 0;
    const makeId = () => `id-${++seq}`;
    const first = addUrls([], "https://a.com/1\nhttps://a.com/2", makeId);
    expect(first.map((item) => [item.id, item.rawUrl, item.state.kind])).toEqual([
      ["id-1", "https://a.com/1", "queued"],
      ["id-2", "https://a.com/2", "queued"],
    ]);
    const second = addUrls(first, "https://a.com/2 https://a.com/3", makeId);
    expect(second.map((item) => item.rawUrl)).toEqual(["https://a.com/1", "https://a.com/2", "https://a.com/3"]);
    expect(first).toHaveLength(2);
  });
});

describe("nextQueued／updateItem", () => {
  const queue: QueueItem[] = [
    { id: "a", rawUrl: "https://a.com/1", state: { kind: "ready", preview: {} as never } },
    { id: "b", rawUrl: "https://a.com/2", state: { kind: "queued" } },
    { id: "c", rawUrl: "https://a.com/3", state: { kind: "queued" } },
  ];

  it("一次只抓一篇：有 loading 就不給下一篇", () => {
    expect(nextQueued(queue)?.id).toBe("b");
    const loading = updateItem(queue, "b", { kind: "loading" });
    expect(nextQueued(loading)).toBeNull();
    expect(queue[1].state.kind).toBe("queued");
  });

  it("全部處理完回 null", () => {
    const done = queue.map((item) => ({ ...item, state: { kind: "error" as const, error: "x" } }));
    expect(nextQueued(done)).toBeNull();
  });
});
