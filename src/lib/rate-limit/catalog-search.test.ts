import { describe, expect, it } from "vitest";
import { allowCatalogSearch, CATALOG_SEARCH_LIMIT_PER_MINUTE } from "./catalog-search";

describe("allowCatalogSearch：索引搜尋每 IP 每分鐘上限", () => {
  it("上限內放行，超過就擋；不同 IP 各自計數", () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < CATALOG_SEARCH_LIMIT_PER_MINUTE; i += 1) expect(allowCatalogSearch(ip)).toBe(true);
    expect(allowCatalogSearch(ip)).toBe(false);
    expect(allowCatalogSearch("203.0.113.8")).toBe(true);
  });
});
