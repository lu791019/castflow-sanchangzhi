/**
 * 說一段的「先說後登入」草稿：未登入按送出時，把剛打的字或錄音暫存在這台瀏覽器，
 * 登入回來（/say?resume=1）再還原，由使用者自己按送出。
 */

import type { RecentWork } from "@/app/(social)/say/say-stage";
import { loginRedirectPath } from "@/lib/auth/paths";

export const DRAFT_VERSION = 1;
/** 超過一天就不還原（換了心情，也避免撿到很久以前別人用這台裝置留下的） */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const RESUME_PARAM = "resume";

interface DraftBase {
  version: typeof DRAFT_VERSION;
  savedAt: string;
  work: RecentWork | null;
}

export interface TextDraft extends DraftBase {
  kind: "text";
  text: string;
}

export interface VoiceDraft extends DraftBase {
  kind: "voice";
  audio: Blob;
  mimeType: string;
  seconds: number;
}

export type SayDraft = TextDraft | VoiceDraft;

export function isDraftUsable(draft: SayDraft | null | undefined, now: Date): draft is SayDraft {
  if (!draft || draft.version !== DRAFT_VERSION) return false;
  const savedAt = new Date(draft.savedAt).getTime();
  if (Number.isNaN(savedAt) || now.getTime() - savedAt > DRAFT_TTL_MS) return false;
  if (draft.kind === "text") return draft.text.trim().length > 0;
  return draft.audio instanceof Blob && draft.audio.size > 0;
}

/** 匿名時的作品卡只可能是公開作品；日誌紀錄屬於登入者，不跨過登入保存 */
export function stripPrivateWorkFields(work: RecentWork | null): RecentWork | null {
  return work ? { ...work, journalId: null } : null;
}

export function resumeLoginPath(): string {
  return loginRedirectPath("/say", `?${RESUME_PARAM}=1`);
}
