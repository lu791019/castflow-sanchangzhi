/**
 * 假文化部藝文活動＋假 Apple 台灣 Podcast 榜＋假節目 RSS（beforesrc E2E 用）：在 Playwright 這端起一個本機 HTTP server。
 * dev server 要帶這些 env 才會打到這裡（正式環境不吃）：
 *   CULTURE_API_BASE=http://127.0.0.1:<port>/culture  CULTURE_CACHE_TTL_MS=0
 *   APPLE_TOP_URL=http://127.0.0.1:<port>/apple/top.json  ITUNES_LOOKUP_URL=http://127.0.0.1:<port>/apple/lookup
 * 活動日期以「今天（台北）」往後推，標題帶這次執行的代號，不會撞到上次留下的場刊。
 * Podcast 榜在 dev server 快取一小時：節目、RSS 網址、集數固定不帶代號（重跑也對得上）。
 * setCultureDown(true) 模擬文化部掛掉（每個類別回 500）。
 * startCultureMock(run, { addressed: true })：戲劇類（2）多一場帶完整地址（高雄市）的場次、獨立音樂（5）多一場非音樂祭的，
 * 給縣市篩選與細分類（livefilter）用；預設不加，不影響其他 spec。
 * startCultureMock(run, { located: { concert: "澎湖縣馬公市…" } })：指定場次帶完整地址（文化部從地址推縣市）。
 * 對雲端跑時真活動很多，測試先選一個真資料很少的縣市（fixtures/before-city.ts），自己的卡才不會被擠出上限。
 */

import { createServer, type Server } from "node:http";

export const CULTURE_MOCK_PORT = Number(process.env.E2E_CULTURE_MOCK_PORT ?? 3166);
const BASE = `http://127.0.0.1:${CULTURE_MOCK_PORT}`;
const DAY = 24 * 60 * 60 * 1000;

/** 台北日曆日（YYYY-MM-DD），offset 天後 */
export function taipeiDayFromNow(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const slash = (day: string) => day.replaceAll("-", "/");

export interface CultureFixture {
  run: string;
  concert: { title: string; day: string; time: string; venue: string };
  festival: { title: string; start: string; end: string; venue: string };
  exhibition: { title: string; start: string; end: string; venue: string };
  /** 帶地址的戲劇場次（addressed 才回） */
  addressed: { title: string; day: string; time: string; venue: string; address: string };
  /** 獨立音樂（類別 5、非音樂祭；addressed 才回） */
  indie: { title: string; day: string; time: string; venue: string };
  podcast: { id: number; name: string; feedPath: string; latestEpisode: string };
}

export function buildFixture(run: string): CultureFixture {
  return {
    run,
    concert: { title: `散場測試・弦樂之夜 ${run}`, day: taipeiDayFromNow(3), time: "19:45", venue: "國家音樂廳" },
    festival: { title: `散場測試・浮現音樂祭 ${run}`, start: taipeiDayFromNow(10), end: taipeiDayFromNow(11), venue: "台中清水鰲峰山" },
    exhibition: { title: `散場測試・古代人說故事 ${run}`, start: taipeiDayFromNow(-30), end: taipeiDayFromNow(60), venue: "科博館" },
    indie: { title: `散場測試・地下室樂隊專場 ${run}`, day: taipeiDayFromNow(8), time: "20:00", venue: "This Way Out" },
    addressed: { title: `散場測試・港邊夜戲 ${run}`, day: taipeiDayFromNow(6), time: "19:30", venue: "駁二正倉庫", address: "高雄市鹽埕區大勇路1號" },
    podcast: { id: 880001, name: "散場測試電台", feedPath: "/rss/880001.xml", latestEpisode: "第 2 集・新的一集" },
  };
}

function activity(uid: string, title: string, category: string, start: string, end: string, time: string, venue: string, extra: Record<string, unknown> = {}) {
  return {
    version: "1.4",
    UID: uid,
    title,
    category,
    showInfo: [
      { time: `${slash(start)} ${time}:00`, location: "", locationName: venue, onSales: "Y", price: "", latitude: null, longitude: null, endTime: `${slash(end)} 22:00:00` },
    ],
    startDate: slash(start),
    endDate: slash(end),
    imageUrl: "",
    webSales: "",
    sourceWebPromote: "",
    descriptionFilterHtml: "",
    masterUnit: [],
    ...extra,
  };
}

export type LocatedItem = "concert" | "festival" | "exhibition" | "indie" | "addressed";

export interface CultureMockOptions {
  addressed?: boolean;
  /** 指定場次的地址（覆寫 addressed 預設的高雄地址） */
  located?: Partial<Record<LocatedItem, string>>;
}

type Row = ReturnType<typeof activity>;

function at(row: Row, address: string | undefined): Row {
  return address ? { ...row, showInfo: row.showInfo.map((info) => ({ ...info, location: address })) } : row;
}

function cultureBody(category: string, fixture: CultureFixture, options: CultureMockOptions): unknown[] {
  const { concert, festival, exhibition, run } = fixture;
  const { addressed = false, located = {} } = options;
  switch (category) {
    case "2": {
      if (!addressed) return [];
      const show = fixture.addressed;
      return [at(activity(`c2-${run}`, show.title, "2", show.day, show.day, show.time, show.venue), located.addressed ?? show.address)];
    }
    case "1":
      return [
        at(
          activity(`c1-${run}`, concert.title, "1", concert.day, concert.day, concert.time, concert.venue, {
            webSales: "https://www.opentix.life/event/e2e",
          }),
          located.concert,
        ),
        // 已經結束的不該出現
        activity(`c1-past-${run}`, `散場測試・上個月的演出 ${run}`, "1", taipeiDayFromNow(-20), taipeiDayFromNow(-20), "19:30", "國家音樂廳"),
      ];
    case "5": {
      const fest = at(activity(`c5-${run}`, festival.title, "5", festival.start, festival.end, "12:00", festival.venue), located.festival);
      if (!addressed) return [fest];
      const { indie } = fixture;
      return [fest, at(activity(`c5-indie-${run}`, indie.title, "5", indie.day, indie.day, indie.time, indie.venue), located.indie)];
    }
    case "6":
      return [at(activity(`c6-${run}`, exhibition.title, "6", exhibition.start, exhibition.end, "09:00", exhibition.venue), located.exhibition)];
    default:
      return [];
  }
}

function rss(fixture: CultureFixture): string {
  const { podcast } = fixture;
  const item = (guid: string, title: string, date: string) =>
    `<item><title>${title}</title><guid>${guid}</guid><pubDate>${date}</pubDate><enclosure url="${BASE}/audio/${guid}.mp3" type="audio/mpeg" length="1"/></item>`;
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${podcast.name}</title><itunes:author>測試主持人</itunes:author>${item(
    "e2e-beforesrc-ep1",
    "第 1 集・舊的一集",
    "Wed, 01 Oct 2026 12:00:00 GMT",
  )}${item("e2e-beforesrc-ep2", podcast.latestEpisode, "Mon, 12 Oct 2026 12:00:00 GMT")}</channel></rss>`;
}

export interface CultureMock {
  fixture: CultureFixture;
  hits: string[];
  setCultureDown: (down: boolean) => void;
  close: () => Promise<void>;
}

export async function startCultureMock(run: string, options: CultureMockOptions = {}): Promise<CultureMock> {
  const fixture = buildFixture(run);
  const hits: string[] = [];
  let cultureDown = false;
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", BASE);
    hits.push(`${url.pathname}${url.search}`);
    const json = (status: number, body: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === "/culture") {
      if (cultureDown) return json(500, { error: "down" });
      return json(200, cultureBody(url.searchParams.get("category") ?? "", fixture, options));
    }
    if (url.pathname === "/apple/top.json") return json(200, { feed: { results: [{ id: String(fixture.podcast.id), name: fixture.podcast.name }] } });
    if (url.pathname === "/apple/lookup") {
      return json(200, {
        results: [{ collectionId: fixture.podcast.id, collectionName: fixture.podcast.name, artistName: "測試主持人", trackCount: 2, feedUrl: `${BASE}${fixture.podcast.feedPath}` }],
      });
    }
    if (url.pathname === fixture.podcast.feedPath) {
      response.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" });
      return response.end(rss(fixture));
    }
    return json(404, { error: "not found" });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(CULTURE_MOCK_PORT, "127.0.0.1", () => resolve());
  });
  return {
    fixture,
    hits,
    setCultureDown: (down) => {
      cultureDown = down;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
