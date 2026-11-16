/**
 * 依筆名查印文的批次器：同一輪渲染裡各處印章各自要字，這裡併成一次查詢。
 * 每個請求一個（見 components/seal/pen-seal.tsx 的 React cache）；查詢失敗回 null，印章退回規則字。
 */

export type GlyphLoader = (penNames: readonly string[]) => Promise<ReadonlyMap<string, string | null>>;

export interface GlyphBatcher {
  load(penName: string): Promise<string | null>;
}

export function createGlyphBatcher(loadMany: GlyphLoader): GlyphBatcher {
  const settled = new Map<string, Promise<string | null>>();
  let queued: string[] = [];
  let flush: Promise<ReadonlyMap<string, string | null>> | null = null;

  function schedule(): Promise<ReadonlyMap<string, string | null>> {
    flush ??= new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      const names = queued;
      queued = [];
      flush = null;
      return loadMany(names).catch((error: unknown) => {
        console.error("[seal] batch load glyphs failed", { count: names.length, error });
        return new Map<string, string | null>();
      });
    });
    return flush;
  }

  return {
    load(penName) {
      if (!penName) return Promise.resolve(null);
      const known = settled.get(penName);
      if (known) return known;
      queued = [...queued, penName];
      const result = schedule().then((glyphs) => glyphs.get(penName) ?? null);
      settled.set(penName, result);
      return result;
    },
  };
}
