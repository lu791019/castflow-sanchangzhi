/**
 * 已知平台與售票站（白名單）：網址主機名 → 來源鍵與按鈕名。
 * 使用者補的網址在白名單內直接公開；白名單外標記待審（Q-30），由 service 決定 status。
 */

interface KnownSite {
  source: string;
  label: string;
  domains: readonly string[];
}

export const KNOWN_SITES: readonly KnownSite[] = [
  // 串流
  { source: "netflix", label: "Netflix", domains: ["netflix.com"] },
  { source: "disneyplus", label: "Disney+", domains: ["disneyplus.com"] },
  { source: "primevideo", label: "Prime Video", domains: ["primevideo.com"] },
  { source: "max", label: "Max", domains: ["max.com", "hbomax.com"] },
  { source: "appletv", label: "Apple TV+", domains: ["tv.apple.com"] },
  { source: "catchplay", label: "CATCHPLAY+", domains: ["catchplay.com"] },
  { source: "myvideo", label: "MyVideo", domains: ["myvideo.net.tw"] },
  { source: "friday", label: "friDay影音", domains: ["video.friday.tw"] },
  { source: "kktv", label: "KKTV", domains: ["kktv.me"] },
  { source: "linetv", label: "LINE TV", domains: ["linetv.tw"] },
  { source: "hamivideo", label: "Hami Video", domains: ["hamivideo.hinet.net"] },
  { source: "iqiyi", label: "愛奇藝", domains: ["iq.com", "iqiyi.com"] },
  { source: "youtube", label: "YouTube", domains: ["youtube.com", "youtu.be"] },
  { source: "gagaoolala", label: "GagaOOLala", domains: ["gagaoolala.com"] },
  { source: "mubi", label: "MUBI", domains: ["mubi.com"] },
  // 在哪聽（Q-64）：只收 open.spotify.com，類型與作品類別的對應在 spotify.ts
  { source: "spotify", label: "Spotify", domains: ["open.spotify.com"] },
  // 影城
  { source: "vieshow", label: "威秀影城", domains: ["vscinemas.com.tw"] },
  { source: "ambassador", label: "國賓影城", domains: ["ambassador.com.tw"] },
  { source: "showtimes", label: "秀泰影城", domains: ["showtimes.com.tw"] },
  { source: "ezding", label: "ezding", domains: ["ezding.com.tw"] },
  // 售票
  { source: "kktix", label: "KKTIX", domains: ["kktix.com", "kktix.cc"] },
  { source: "tixcraft", label: "拓元", domains: ["tixcraft.com"] },
  { source: "opentix", label: "OPENTIX", domains: ["opentix.life"] },
  { source: "accupass", label: "Accupass", domains: ["accupass.com"] },
  { source: "klook", label: "Klook", domains: ["klook.com"] },
  { source: "kkday", label: "KKday", domains: ["kkday.com"] },
  { source: "ibon", label: "ibon 售票", domains: ["ticket.ibon.com.tw"] },
  { source: "era", label: "年代售票", domains: ["ticket.com.tw"] },
  { source: "kham", label: "寬宏售票", domains: ["kham.com.tw"] },
  { source: "famiticket", label: "全家售票", domains: ["famiticket.com.tw"] },
  { source: "udnfunlife", label: "udn 售票", domains: ["udnfunlife.com"] },
];

export interface SourceInfo {
  source: string;
  label: string;
  /** 白名單網域 → 直接公開；否則待審 */
  trusted: boolean;
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** 網址 → 來源；白名單外以 `web:<主機名>` 當來源（去 www.） */
export function sourceFromUrl(value: string): SourceInfo | null {
  const url = parseHttpUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  const known = KNOWN_SITES.find((site) => site.domains.some((domain) => matchesDomain(host, domain)));
  if (known) return { source: known.source, label: known.label, trusted: true };
  const bare = host.replace(/^www\./, "");
  return { source: `web:${bare}`, label: bare.slice(0, 40), trusted: false };
}
