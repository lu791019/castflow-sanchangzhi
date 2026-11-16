/**
 * 回信的規則判斷（純函式，API 與測試共用）：
 * 哪些文章開放回信、寄信能不能送達、作者對一封信的動作要改哪些欄位。
 */

import { isUuid } from "@/lib/auth/owned-reads";
import { parseByline, parseVisibility } from "@/lib/proof/publish";
import type { LetterStatus } from "./format";
import { validateLetterText } from "./rules";

export interface LetterEpisode {
  id: string;
  user_id: string;
  visibility: string;
  byline: string;
  published_at: string | null;
}

/**
 * 只有「以筆名署名＋公開發佈」的文章開放回信與讀者來函。
 * 匿名署名不開放：信要寄給一個人，匿名作者沒有可署名的收信人，刊登也會讓匿名文章出現筆名往來。
 */
export function isLetterOpen(episode: LetterEpisode): boolean {
  return (
    parseVisibility(episode.visibility) === "public" &&
    parseByline(episode.byline) === "pen_name" &&
    Boolean(episode.published_at) &&
    isUuid(episode.user_id)
  );
}

export type SendOutcome =
  | { kind: "deliver" }
  | { kind: "suppress" }
  | { kind: "reject"; status: 403 | 404 | 409; error: string };

export interface SendInput {
  episode: LetterEpisode | null;
  senderId: string;
  senderPenName: string | null;
  alreadySent: boolean;
  blocked: boolean;
}

export function decideSend({ episode, senderId, senderPenName, alreadySent, blocked }: SendInput): SendOutcome {
  if (!episode || !isLetterOpen(episode)) {
    return { kind: "reject", status: 404, error: "這篇文章沒有開放寫信" };
  }
  if (senderId === episode.user_id) return { kind: "reject", status: 403, error: "不能寫信給自己" };
  if (!senderPenName) return { kind: "reject", status: 403, error: "先取一個筆名，再寄信" };
  if (alreadySent) return { kind: "reject", status: 409, error: "這篇已經寄過一封信了" };
  // 被封鎖：照樣回「寄出了」，信不送到作者那裡（不讓寄信人知道被封鎖）
  if (blocked) return { kind: "suppress" };
  return { kind: "deliver" };
}

export type AuthorAction =
  | { type: "publish" }
  | { type: "keep" }
  | { type: "unpublish" }
  | { type: "reply"; text: string }
  | { type: "report" }
  | { type: "block" }
  | { type: "unblock" };

const SIMPLE_ACTIONS = ["publish", "keep", "unpublish", "report", "block", "unblock"] as const;

export type ParsedAction = { ok: true; action: AuthorAction } | { ok: false; error: string };

export function parseAuthorAction(raw: unknown): ParsedAction {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "不認得的動作" };
  const { action, reply } = raw as Record<string, unknown>;
  if (action === "reply") {
    const checked = validateLetterText(reply);
    return checked.ok ? { ok: true, action: { type: "reply", text: checked.value } } : checked;
  }
  const simple = SIMPLE_ACTIONS.find((name) => name === action);
  return simple ? { ok: true, action: { type: simple } } : { ok: false, error: "不認得的動作" };
}

export interface LetterState {
  status: LetterStatus;
  reply: string | null;
  reported_at: string | null;
}

export interface LetterRowPatch {
  status?: LetterStatus;
  published_at?: string | null;
  reply?: string;
  replied_at?: string;
  reported_at?: string;
}

export type PatchResult = { ok: true; patch: LetterRowPatch } | { ok: false; status: 409; error: string };

/** 單封信的欄位變更；封鎖／解除封鎖不在這裡（作用在寄信人，見 repository） */
export function letterPatch(
  letter: LetterState,
  action: Exclude<AuthorAction, { type: "block" } | { type: "unblock" }>,
  now: Date,
): PatchResult {
  const at = now.toISOString();
  switch (action.type) {
    case "publish":
      if (letter.reported_at) return { ok: false, status: 409, error: "檢舉過的信不能刊登" };
      return { ok: true, patch: letter.status === "published" ? {} : { status: "published", published_at: at } };
    case "keep":
      return { ok: true, patch: { status: "kept", published_at: null } };
    case "unpublish":
      return { ok: true, patch: { status: "none", published_at: null } };
    case "reply":
      if (letter.reply) return { ok: false, status: 409, error: "這封信已經回覆過了" };
      return { ok: true, patch: { reply: action.text, replied_at: at } };
    case "report":
      if (letter.reported_at) return { ok: true, patch: {} };
      return {
        ok: true,
        patch:
          letter.status === "published"
            ? { reported_at: at, status: "kept", published_at: null }
            : { reported_at: at },
      };
  }
}
