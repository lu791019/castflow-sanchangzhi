"use client";

/**
 * 文章頁共鳴狀態：每段的記號（hash → 人數／你有沒有標）、目前浮出浮層的段、標記／收回。
 * 樂觀更新，失敗退回並以讀螢幕播報；未登入按下 → 登入後回原頁。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loginRedirectPath } from "@/lib/auth/paths";
import { toggleMark, type PassageMark } from "@/lib/resonance/marks";

export type LineChange = "draw" | "fade";

interface ResonanceContextValue {
  marks: Record<string, PassageMark>;
  selected: string | null;
  changes: Record<string, LineChange>;
  select: (hash: string | null) => void;
  toggle: (hash: string) => void;
}

const ResonanceContext = createContext<ResonanceContextValue | null>(null);

const NO_MARK: PassageMark = { count: 0, mine: false };

interface ResonanceProviderProps {
  slug: string;
  signedIn: boolean;
  initialMarks: Record<string, PassageMark>;
  children: ReactNode;
}

async function sendToggle(slug: string, hash: string, mine: boolean): Promise<Response> {
  return fetch("/api/resonance", {
    method: mine ? "DELETE" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, hash }),
  });
}

export function ResonanceProvider({ slug, signedIn, initialMarks, children }: ResonanceProviderProps) {
  const [marks, setMarks] = useState(initialMarks);
  const [selected, setSelected] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, LineChange>>({});
  const [live, setLive] = useState("");

  const goLogin = useCallback(() => {
    window.location.assign(loginRedirectPath(`/s/${slug}`, ""));
  }, [slug]);

  const toggle = useCallback(
    (hash: string) => {
      setSelected(null);
      if (!signedIn) {
        goLogin();
        return;
      }
      const before = marks[hash] ?? NO_MARK;
      const after = toggleMark(before);
      setMarks((current) => ({ ...current, [hash]: after }));
      setChanges((current) => ({ ...current, [hash]: after.mine ? "draw" : "fade" }));
      setLive(after.mine ? "已在這段留下記號" : "已收回記號");
      sendToggle(slug, hash, before.mine)
        .then(async (response) => {
          if (response.status === 401) {
            goLogin();
            return;
          }
          const payload = (await response.json().catch(() => null)) as { data?: PassageMark } | null;
          if (!response.ok || !payload?.data) throw new Error(`HTTP ${response.status}`);
          const confirmed = payload.data;
          setMarks((current) => ({ ...current, [hash]: confirmed }));
        })
        .catch((error: unknown) => {
          console.error("[resonance] toggle failed", error instanceof Error ? error.message : error);
          setMarks((current) => ({ ...current, [hash]: before }));
          setChanges((current) => ({ ...current, [hash]: before.mine ? "draw" : "fade" }));
          setLive(before.mine ? "沒有收回，請再試一次" : "沒有留下，請再試一次");
        });
    },
    [goLogin, marks, signedIn, slug],
  );

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const value = useMemo(
    () => ({ marks, selected, changes, select: setSelected, toggle }),
    [marks, selected, changes, toggle],
  );

  return (
    <ResonanceContext.Provider value={value}>
      {selected ? (
        // 點浮層外任何地方收起
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-40 cursor-default border-0 bg-transparent p-0"
        />
      ) : null}
      {children}
      <span role="status" aria-live="polite" className="sr-only">
        {live}
      </span>
    </ResonanceContext.Provider>
  );
}

export function usePassageResonance(hash: string) {
  const context = useContext(ResonanceContext);
  if (!context) throw new Error("usePassageResonance 必須在 ResonanceProvider 內使用");
  return {
    mark: context.marks[hash] ?? NO_MARK,
    selected: context.selected === hash,
    change: context.changes[hash] ?? null,
    select: context.select,
    toggle: context.toggle,
  };
}
