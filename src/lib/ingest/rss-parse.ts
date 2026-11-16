import { XMLParser } from "fast-xml-parser";
import { parseDuration } from "@/lib/listen/duration";
import { parsePositiveInt } from "@/lib/listen/episode-meta";
import { RssIngestError } from "./rss-errors";

export interface FeedItem {
  guid: string;
  title: string;
  audioUrl: string;
  publishedAt: string | null;
  /** itunes:duration（秒數或 時:分:秒 皆可）→ 秒 */
  durationSeconds: number | null;
  /** itunes:episode；缺就 null（不從標題猜） */
  episodeNumber: number | null;
  /** itunes:season；有值時 episodeNumber 是季內集數 */
  seasonNumber: number | null;
  /** 單集層級 itunes:author */
  author: string | null;
}

export interface ParsedFeed {
  title: string | null;
  /** 節目封面：channel itunes:image（退回 RSS image/url） */
  imageUrl: string | null;
  /** 節目層級 itunes:author（照實存，可能是公司或帳號名） */
  author: string | null;
  items: FeedItem[];
}

/** 取節點文字：fast-xml-parser 帶屬性時節點是 { "#text": ... } */
function nodeText(node: unknown): string | null {
  if (typeof node === "string" && node.trim()) return node.trim();
  if (typeof node === "object" && node !== null && "#text" in node) {
    const text = (node as Record<string, unknown>)["#text"];
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return null;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

type XmlNode = Record<string, unknown>;

function parseItem(raw: XmlNode): FeedItem | null {
  const enclosure = toArray<XmlNode>(
    raw.enclosure as XmlNode | XmlNode[] | undefined,
  )[0];
  const audioUrl =
    typeof enclosure?.["@_url"] === "string" ? enclosure["@_url"].trim() : "";
  if (!audioUrl) return null;

  const title = nodeText(raw.title) ?? "(未命名集數)";
  const guid = nodeText(raw.guid) ?? audioUrl;
  const publishedAt = nodeText(raw.pubDate);

  return {
    guid,
    title,
    audioUrl,
    publishedAt,
    durationSeconds: parseDuration(nodeText(raw["itunes:duration"])),
    episodeNumber: parsePositiveInt(nodeText(raw["itunes:episode"])),
    seasonNumber: parsePositiveInt(nodeText(raw["itunes:season"])),
    author: nodeText(raw["itunes:author"]),
  };
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^https?:\/\//i.test(url) ? url : null;
}

/** 節目封面：itunes:image@href 優先，其次 RSS 2.0 <image><url> */
function channelImage(channel: XmlNode): string | null {
  const itunes = toArray<XmlNode>(channel["itunes:image"] as XmlNode | XmlNode[] | undefined)[0];
  const fromItunes = httpUrl(itunes?.["@_href"]);
  if (fromItunes) return fromItunes;
  const image = toArray<XmlNode>(channel.image as XmlNode | XmlNode[] | undefined)[0];
  return httpUrl(nodeText(image?.url));
}

/** 全部 item 都有合法 pubDate 才依日期排序（新→舊），否則保留文件順序（RSS 慣例新集在前） */
function sortNewestFirst(items: FeedItem[]): FeedItem[] {
  const timestamps = items.map((item) =>
    item.publishedAt ? Date.parse(item.publishedAt) : NaN,
  );
  if (timestamps.some((ts) => Number.isNaN(ts))) return items;

  return items
    .map((item, index) => ({ item, ts: timestamps[index] }))
    .sort((a, b) => b.ts - a.ts)
    .map(({ item }) => item);
}

/**
 * 解析 podcast RSS feed（RSS 2.0）。逐層驗證分開回報：
 * 非 XML → invalid_xml；XML 但非 RSS → not_rss；有 item 但全無音訊 enclosure → no_enclosure。
 */
export function parseFeed(xml: string): ParsedFeed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
  });

  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml, true);
  } catch {
    throw new RssIngestError("invalid_xml", "回應內容不是有效的 XML");
  }

  const rss = doc.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (!channel) {
    throw new RssIngestError("not_rss", "XML 內容不是 RSS feed（缺少 rss/channel）");
  }

  const rawItems = toArray<XmlNode>(
    channel.item as XmlNode | XmlNode[] | undefined,
  );
  const items = rawItems
    .map(parseItem)
    .filter((item): item is FeedItem => item !== null);

  if (items.length === 0) {
    throw new RssIngestError(
      "no_enclosure",
      "Feed 內沒有任何帶音訊 enclosure 的集數（可能不是 podcast feed）",
    );
  }

  return {
    title: nodeText(channel.title),
    imageUrl: channelImage(channel),
    author: nodeText(channel["itunes:author"]),
    items: sortNewestFirst(items),
  };
}

/**
 * 從 feed（新→舊）挑出該新建的集數：
 * - feed 內找得到已入庫 guid → 取比它更新的那些（中間漏掉的集都補上）
 * - 完全沒有已知 guid（如剛訂閱、或 DB 清空）→ 只取最新 1 集，避免灌入整個 back-catalog
 */
export function selectNewItems(
  items: FeedItem[],
  knownGuids: ReadonlySet<string>,
): FeedItem[] {
  const firstKnownIndex = items.findIndex((item) => knownGuids.has(item.guid));
  if (firstKnownIndex === -1) return items.slice(0, 1);
  return items.slice(0, firstKnownIndex);
}
