import { describe, expect, it } from "vitest";
import { parseCatalogTab, parseShelfKind } from "./tabs";

describe("parseCatalogTab", () => {
  it("預設作品；只認三個分頁", () => {
    expect(parseCatalogTab(undefined)).toBe("works");
    expect(parseCatalogTab("authors")).toBe("authors");
    expect(parseCatalogTab("columns")).toBe("columns");
    expect(parseCatalogTab("hack")).toBe("works");
    expect(parseCatalogTab(["columns"])).toBe("columns");
  });
});

describe("parseShelfKind", () => {
  it("只認五種書架", () => {
    expect(parseShelfKind("performance")).toBe("performance");
    expect(parseShelfKind("live")).toBeNull();
    expect(parseShelfKind(undefined)).toBeNull();
  });
});
