/** 使用者補連結（Q-30）的邊界驗證與寫入決策（純函式） */

import type { WorkKind } from "@/lib/works/format";
import { parseHttpUrl, sourceFromUrl } from "./sources";
import { checkListenLink, isSpotifyHost, SPOTIFY_AUTO_ADDED_BY } from "./spotify";
import { isLinkKind, type LinkKind, type StoredLinkOrigin } from "./types";

export const MAX_LINK_URL_LENGTH = 2000;
export const MAX_LINK_LABEL_LENGTH = 20;

export interface LinkInput {
  kind: LinkKind;
  url: string;
  label: string | null;
}

export type LinkInputResult = { ok: true; value: LinkInput } | { ok: false; error: string };

export function parseLinkInput(body: unknown): LinkInputResult {
  if (!body || typeof body !== "object") return { ok: false, error: "請提供 kind 與 url" };
  const raw = body as Record<string, unknown>;
  if (!isLinkKind(raw.kind)) return { ok: false, error: "kind 必須是 watch、ticket 或 official" };
  if (typeof raw.url !== "string") return { ok: false, error: "url 必須是文字" };
  const url = raw.url.trim();
  if (url.length > MAX_LINK_URL_LENGTH) return { ok: false, error: `網址不可超過 ${MAX_LINK_URL_LENGTH} 字` };
  const parsed = parseHttpUrl(url);
  if (!parsed) return { ok: false, error: "網址要是 http 或 https 開頭" };
  if (raw.label !== undefined && raw.label !== null && typeof raw.label !== "string") {
    return { ok: false, error: "label 必須是文字" };
  }
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (Array.from(label).length > MAX_LINK_LABEL_LENGTH) {
    return { ok: false, error: `名稱不可超過 ${MAX_LINK_LABEL_LENGTH} 字` };
  }
  return { ok: true, value: { kind: raw.kind, url: parsed.href, label: label || null } };
}

export type WorkLinkCheck = { ok: true; value: LinkInput } | { ok: false; error: string };

/**
 * 依作品類別再驗一次（要先讀到作品才知道）：音樂、Podcast 的「在哪聽」只收 Spotify、類型要對得上，網址正規化；
 * 其他作品不收 Spotify 連結（不是在哪看／買票）。
 */
export function checkLinkForWork(workKind: WorkKind, input: LinkInput): WorkLinkCheck {
  if (workKind === "music" || workKind === "podcast_episode") {
    if (input.kind !== "watch") return { ok: false, error: "在哪聽只能補收聽連結" };
    const checked = checkListenLink(workKind, input.url);
    return checked.ok ? { ok: true, value: { ...input, url: checked.url, label: null } } : checked;
  }
  if (isSpotifyHost(input.url)) return { ok: false, error: "Spotify 連結只能補在音樂或 Podcast。" };
  return { ok: true, value: input };
}

export interface UserLinkPlan {
  source: string;
  label: string;
  status: "active" | "pending";
}

/** 來源鍵與公開狀態：白名單網域直接公開，其他待審；官網每作品一筆且一律直接公開（Dex 10/13：展覽官網五花八門，待審沒有後台） */
export function planUserLink(input: LinkInput): UserLinkPlan {
  const info = sourceFromUrl(input.url);
  const status = info?.trusted ? "active" : "pending";
  if (input.kind === "official") return { source: "official", label: input.label ?? "官網", status: "active" };
  return {
    source: info?.source ?? "web",
    label: input.label ?? info?.label ?? "連結",
    status,
  };
}

export type UserLinkWrite = "insert" | "update" | "conflict";

/**
 * 同作品同來源已有一筆時：自己補的（origin user、added_by 本人）可以覆蓋；
 * 系統自動配對的 Spotify 直連（A②，added_by SPOTIFY_AUTO_ADDED_BY）讀者也可以蓋掉——讀者貼的優先。
 */
export function decideUserLinkWrite(
  existing: { origin: StoredLinkOrigin; added_by: string | null } | null,
  userId: string,
): UserLinkWrite {
  if (!existing) return "insert";
  if (existing.added_by === SPOTIFY_AUTO_ADDED_BY && existing.origin !== "user") return "update";
  return existing.origin === "user" && existing.added_by === userId ? "update" : "conflict";
}
