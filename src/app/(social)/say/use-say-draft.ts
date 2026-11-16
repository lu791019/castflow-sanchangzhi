"use client";

/** 先說後登入：未登入送出時暫存草稿並導去登入；登入回來（resume）讀出草稿交給 onRestore */

import { useCallback, useEffect, useRef } from "react";
import { isDraftUsable, resumeLoginPath, type SayDraft } from "@/lib/say/draft";
import { clearSayDraft, loadSayDraft, saveSayDraft } from "@/lib/say/draft-store";

export interface SayDraftControls {
  /** 暫存並導去登入；失敗回錯誤訊息（不導頁） */
  stashAndLogin: (draft: SayDraft) => Promise<string | null>;
  /** 送出成功或使用者放棄後清掉 */
  discard: () => void;
}

export function useSayDraft(resume: boolean, onRestore: (draft: SayDraft) => void): SayDraftControls {
  const onRestoreRef = useRef(onRestore);
  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    if (!resume) return;
    let active = true;
    loadSayDraft().then((draft) => {
      if (!active) return;
      if (isDraftUsable(draft, new Date())) {
        onRestoreRef.current(draft);
      } else if (draft) {
        void clearSayDraft();
      }
    });
    return () => {
      active = false;
    };
  }, [resume]);

  const stashAndLogin = useCallback(async (draft: SayDraft) => {
    try {
      await saveSayDraft(draft);
    } catch (error) {
      console.error("[say] 暫存草稿失敗", error instanceof Error ? error.message : error);
      return "這台瀏覽器存不了草稿（可能是私密瀏覽）。請先登入再說一段。";
    }
    window.location.assign(resumeLoginPath());
    return null;
  }, []);

  const discard = useCallback(() => {
    void clearSayDraft();
  }, []);

  return { stashAndLogin, discard };
}
