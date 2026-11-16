import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isAllowlistedCoverHost } from "../../../src/lib/covers/allowlist.ts";
import type { CollectedEvent } from "../../../src/lib/events/collected.ts";
import { EVENT_SOURCE_CREDITS } from "../../../src/lib/events/credits.ts";
import { parseClabEvents } from "./clab.ts";
import { CMS_SITES, cmsToEvent, parseCmsList } from "./cms.ts";
import { parseKdmofaPage } from "./kdmofa.ts";
import { parseMocaPage } from "./moca.ts";
import { nstmToEvent, parseNstmPage } from "./nstm.ts";
import { parseNmmbaExhibitions, parseNmnsExhibitions } from "./opendata.ts";
import { parseSongshanPage } from "./songshan.ts";
import { parseTnamPage } from "./tnam.ts";

const FIXTURES = path.join(__dirname, "..", "..", "fixtures", "events");
const fixture = (...parts: string[]) => readFileSync(path.join(FIXTURES, ...parts), "utf8");

function cms(source: "ntm" | "nmh" | "cksmh", file: string): CollectedEvent[] {
  const site = CMS_SITES[source];
  // 臺博館列表沒日期：這裡只看圖片網域，先補假日期
  return parseCmsList(fixture(source, file), source).flatMap(
    (item) => cmsToEvent(site, site.lists[0], { ...item, startsOn: item.startsOn ?? "2026-10-01", endsOn: item.endsOn ?? "2026-12-01" }) ?? [],
  );
}

describe("館方來源的海報網域都在封面白名單、都有署名", () => {
  const events: CollectedEvent[] = [
    ...parseNmnsExhibitions(fixture("nmns", "list.json")),
    ...parseNmmbaExhibitions(fixture("nmmba", "list.json")),
    ...parseSongshanPage(fixture("songshan", "list-1.html")).events,
    ...parseNstmPage(fixture("nstm", "list-4.html")).rows.flatMap((row) => nstmToEvent(row) ?? []),
    ...parseTnamPage(fixture("tnam", "current.html")),
    ...cms("ntm", "special-5472.html"),
    ...cms("nmh", "list.html"),
    ...cms("cksmh", "list.html"),
    ...parseClabEvents(fixture("clab", "events.html")),
    ...parseMocaPage(fixture("moca", "current.html")),
    ...parseKdmofaPage(fixture("kdmofa", "current.html")),
  ];

  it("11 個來源都解析得到；除了科博館（圖檔不給別站嵌）每筆都有 https 海報", () => {
    expect(new Set(events.map((event) => event.source)).size).toBe(11);
    expect(events.filter((event) => event.source !== "nmns").every((event) => event.imageUrl?.startsWith("https://"))).toBe(true);
    expect(events.filter((event) => event.source === "nmns").every((event) => event.imageUrl === null)).toBe(true);
  });

  it("海報網域在白名單", () => {
    const hosts = [...new Set(events.flatMap((event) => (event.imageUrl ? [new URL(event.imageUrl).hostname] : [])))];
    expect(hosts.filter((host) => !isAllowlistedCoverHost(host))).toEqual([]);
  });

  it("每個來源都有署名名稱與官網；科工館另標 CC BY-SA 4.0", () => {
    for (const source of new Set(events.map((event) => event.source))) {
      expect(EVENT_SOURCE_CREDITS[source].label).not.toBe("");
      expect(EVENT_SOURCE_CREDITS[source].url).toMatch(/^https:\/\//);
    }
    expect(EVENT_SOURCE_CREDITS.nstm.license?.label).toBe("CC BY-SA 4.0");
  });
});
