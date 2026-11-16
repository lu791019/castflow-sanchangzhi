"use client";

/**
 * 記一筆 sheet 的全站掛載點：底部中央圓鈕、日誌空狀態「記第一筆」、`/journal/new` 都透過這裡打開。
 * 記下後：toast「記下了《X》。明天中午會問你。」；第一次記且還沒問過通知權限 → 帶去權限引導。
 * 掛上就預載 sheet 資料（最近作品、提醒設定、是不是訪客），打開與記下後再更新一次（sheet-boot.ts）。
 */

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LogSheet, type LoggedEntry, type LogSheetPrefill } from "./log-sheet";
import { LogToast } from "./log-toast";
import { shouldAskPushPermission } from "./push-permission";
import { FALLBACK_BOOT, fetchSheetBoot, type SheetBoot } from "./sheet-boot";

export interface OpenLogSheetOptions {
  /** sheet 關閉後（含記下後）要做的事，例如 /journal/new 回到日誌 */
  afterClose?: () => void;
  /** 散場之前「排進行程」：預選作品（或場外名稱＋場地＋日期）並切到「選日期時間」 */
  prefill?: LogSheetPrefill;
}

interface LogSheetContextValue {
  openLogSheet: (options?: OpenLogSheetOptions) => void;
  isOpen: boolean;
  /** sheet 壓在頁面上（滑出到開始收起之間）：背景頁縮 2%（P4 〇一a） */
  pressingPage: boolean;
  /** 是不是訪客；還沒問到是 null（圓鈕首次提示只給登入者，UX-28） */
  guest: boolean | null;
}

const LogSheetContext = createContext<LogSheetContextValue | null>(null);

const TOAST_MS = 4000;

/** 預載與更新：同時只跑一個請求；失敗推 log，已有資料就沿用，沒有就退回預設（sheet 照常可記） */
function useSheetBoot(): { boot: SheetBoot | null; reload: () => void } {
  const [boot, setBoot] = useState<SheetBoot | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const reload = useCallback(() => {
    inflight.current?.abort();
    const abort = new AbortController();
    inflight.current = abort;
    fetchSheetBoot(abort.signal)
      .then(setBoot)
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        console.error("[log-sheet] 預載記一筆資料失敗", error instanceof Error ? error.message : error);
        setBoot((current) => current ?? FALLBACK_BOOT);
      });
  }, []);
  useEffect(() => {
    reload();
    return () => inflight.current?.abort();
  }, [reload]);
  return { boot, reload };
}

export function LogSheetProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [toast, setToast] = useState<LoggedEntry | null>(null);
  const [leaving, setLeaving] = useState(false);
  const afterCloseRef = useRef<(() => void) | undefined>(undefined);
  const [prefill, setPrefill] = useState<LogSheetPrefill | undefined>(undefined);
  const { boot, reload } = useSheetBoot();

  const openLogSheet = useCallback((options?: OpenLogSheetOptions) => {
    reload();
    afterCloseRef.current = options?.afterClose;
    setPrefill(options?.prefill);
    setToast(null);
    setSheetKey((key) => key + 1);
    setLeaving(false);
    setOpen(true);
  }, [reload]);

  const finish = useCallback(() => {
    setOpen(false);
    const afterClose = afterCloseRef.current;
    afterCloseRef.current = undefined;
    afterClose?.();
  }, []);

  const handleLogged = useCallback(
    (entry: LoggedEntry) => {
      router.refresh();
      reload();
      if (shouldAskPushPermission()) {
        afterCloseRef.current = undefined;
        setOpen(false);
        router.push(`/notifications/enable?entry=${encodeURIComponent(entry.id)}`);
        return;
      }
      setToast(entry);
      finish();
    },
    [finish, reload, router],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const markLeaving = useCallback(() => setLeaving(true), []);

  /** sheet 內導頁（現在就想說 → /say、401 → 登入）：直接收起，不跑 afterClose（那是原頁的去處，會跟導頁打架） */
  const closeForNavigation = useCallback(() => {
    afterCloseRef.current = undefined;
    setOpen(false);
  }, []);

  const guest = boot ? boot.guest : null;
  const value = useMemo(
    () => ({ openLogSheet, isOpen: open, pressingPage: open && !leaving, guest }),
    [openLogSheet, open, leaving, guest],
  );

  return (
    <LogSheetContext.Provider value={value}>
      {children}
      {open ? <LogSheet key={sheetKey} boot={boot} prefill={prefill} onClose={finish} onLogged={handleLogged} onLeaving={markLeaving} onNavigate={closeForNavigation} /> : null}
      {toast && !open ? <LogToast entry={toast} onAgain={() => openLogSheet()} /> : null}
    </LogSheetContext.Provider>
  );
}

/** 不在 provider 裡（元件展示頁）回 null：是不是訪客不知道 */
export function useSheetGuest(): boolean | null {
  return useContext(LogSheetContext)?.guest ?? null;
}

export function useLogSheet(): LogSheetContextValue {
  const context = useContext(LogSheetContext);
  if (!context) throw new Error("useLogSheet 必須包在 LogSheetProvider 內使用");
  return context;
}
