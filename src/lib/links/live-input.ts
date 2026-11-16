/** 記一筆・場外變體多帶的「場館類型」「售票網址（選填）」邊界驗證（純函式） */

import type { LiveKind } from "@/lib/venue/match";
import { parseVenueType, type VenueType } from "@/lib/venue/venue-type";
import { MAX_LINK_URL_LENGTH } from "./input";
import { parseHttpUrl } from "./sources";

export interface LiveLinkExtras {
  venueType: VenueType | null;
  ticketUrl: string | null;
}

export type LiveLinkExtrasResult = { ok: true; value: LiveLinkExtras } | { ok: false; error: string };

function parseTicketUrl(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "售票網址必須是文字" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > MAX_LINK_URL_LENGTH) return { ok: false, error: `售票網址不可超過 ${MAX_LINK_URL_LENGTH} 字` };
  const url = parseHttpUrl(trimmed);
  return url ? { ok: true, value: url.href } : { ok: false, error: "售票網址要是 http 或 https 開頭" };
}

/** body：{ liveVenueType?, liveTicketUrl? }（與 liveName 等欄位同層） */
export function parseLiveLinkExtras(body: Record<string, unknown>, kind: LiveKind): LiveLinkExtrasResult {
  const venueType = parseVenueType(kind, body.liveVenueType);
  if (!venueType.ok) return venueType;
  const ticketUrl = parseTicketUrl(body.liveTicketUrl);
  if (!ticketUrl.ok) return ticketUrl;
  return { ok: true, value: { venueType: venueType.value, ticketUrl: ticketUrl.value } };
}
