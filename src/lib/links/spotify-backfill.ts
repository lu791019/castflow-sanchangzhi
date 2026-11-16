/**
 * 既有作品補跑 Spotify 自動直連（Q-64 A②）的純邏輯：參數解析、挑還沒有 Spotify 連結的作品、
 * Podcast 同節目（feed_url）只搜一次。腳本在 scripts/spotify-backfill.ts（node 直接跑：只用相對路徑 import）。
 */

import type { WorkKind } from "@/lib/works/format";
import type { AutoLinkPlan, AutoLinkWork } from "./spotify-auto.ts";

export const BACKFILL_DEFAULT_LIMIT = 20;
export const BACKFILL_MAX_LIMIT = 500;

export interface BackfillArgs {
  /** 預設 false＝乾跑（只印比對結果，不寫 DB） */
  write: boolean;
  limit: number;
  kind: "music" | "podcast_episode" | "all";
}

export type BackfillArgsResult = { ok: true; value: BackfillArgs } | { ok: false; error: string };

export function parseBackfillArgs(argv: readonly string[]): BackfillArgsResult {
  let args: BackfillArgs = { write: false, limit: BACKFILL_DEFAULT_LIMIT, kind: "all" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--write") {
      args = { ...args, write: true };
    } else if (flag === "--limit") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value <= 0 || value > BACKFILL_MAX_LIMIT) {
        return { ok: false, error: `--limit 要是 1–${BACKFILL_MAX_LIMIT} 的整數` };
      }
      args = { ...args, limit: value };
      index += 1;
    } else if (flag === "--kind") {
      const value = argv[index + 1];
      if (value !== "music" && value !== "podcast" && value !== "all") return { ok: false, error: "--kind 只能是 music、podcast 或 all" };
      args = { ...args, kind: value === "podcast" ? "podcast_episode" : value };
      index += 1;
    } else {
      return { ok: false, error: `不認得的參數：${flag}` };
    }
  }
  return { ok: true, value: args };
}

export interface BackfillWorkRow {
  id: string;
  kind: WorkKind;
  slug: string;
  title: string;
  credit: string | null;
  podcast_show: string | null;
  feed_url: string | null;
}

export interface BackfillTarget {
  /** 代表作品（拿來搜的那一筆） */
  work: AutoLinkWork & { slug: string };
  /** 同一個結果要寫進去的作品（Podcast 同 feed 的各集；音樂就是自己） */
  workIds: string[];
}

/** 還沒有 Spotify 連結的音樂／Podcast；Podcast 依 feed_url 併成一組（同節目只搜一次），最多 limit 組 */
export function selectBackfillTargets(
  works: readonly BackfillWorkRow[],
  linkedWorkIds: ReadonlySet<string>,
  args: Pick<BackfillArgs, "kind" | "limit">,
): BackfillTarget[] {
  const wanted = works.filter(
    (work) =>
      (work.kind === "music" || work.kind === "podcast_episode") &&
      (args.kind === "all" || work.kind === args.kind) &&
      !linkedWorkIds.has(work.id),
  );
  const targets: BackfillTarget[] = [];
  const byFeed = new Map<string, number>();
  for (const work of wanted) {
    const feedKey = work.kind === "podcast_episode" && work.feed_url ? work.feed_url : null;
    const existing = feedKey === null ? undefined : byFeed.get(feedKey);
    if (existing !== undefined) {
      targets[existing] = { ...targets[existing], workIds: [...targets[existing].workIds, work.id] };
      continue;
    }
    if (targets.length >= args.limit) continue;
    if (feedKey !== null) byFeed.set(feedKey, targets.length);
    targets.push({ work: { ...work }, workIds: [work.id] });
  }
  return targets;
}

export function describePlan(target: BackfillTarget, plan: AutoLinkPlan | { status: "failed"; error: string }): string {
  const label =
    target.work.kind === "podcast_episode"
      ? `［Podcast］${target.work.podcast_show ?? "（沒有節目名）"}（${target.workIds.length} 集）`
      : `［音樂］${target.work.title} — ${target.work.credit ?? "（沒有藝人）"}`;
  switch (plan.status) {
    case "match":
      return `✔ ${label} → ${plan.url}（Spotify：${plan.name}${plan.via === "same_feed" ? "，沿用同節目" : ""}）`;
    case "no_match":
      return `・ ${label} → 沒把握，不寫（候選 ${plan.candidates} 筆）`;
    case "skipped":
      return `・ ${label} → 略過（${plan.reason}）`;
    case "failed":
      return `✘ ${label} → 失敗：${plan.error}`;
  }
}
