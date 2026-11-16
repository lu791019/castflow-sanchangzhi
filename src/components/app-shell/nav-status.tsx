"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getEpisodeProgressAction } from "@/app/(social)/say/actions";

export type ShellStatus = "idle" | "recording" | "processing";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ROUNDS = 100;

export interface NavStatusValue {
  status: ShellStatus;
  recordSeconds: number;
  /** 整理完成、尚未查看的集數（「我的」亮燒橙小點） */
  readyEpisodeId: string | null;
  processingError: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  /** 進入整理中；voice 流程帶 episodeId 由 provider 輪詢到 transcribed */
  beginProcessing: (episodeId?: string) => void;
  finishProcessing: (episodeId: string) => void;
  failProcessing: (message: string) => void;
  consumeReady: () => void;
}

const NavStatusContext = createContext<NavStatusValue | null>(null);

export function NavStatusProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [status, setStatus] = useState<ShellStatus>("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [readyEpisodeId, setReadyEpisodeId] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = setInterval(
      () => setRecordSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => clearPoll, [clearPoll]);

  const startRecording = useCallback(() => {
    setRecordSeconds(0);
    setProcessingError(null);
    setStatus("recording");
  }, []);

  const stopRecording = useCallback(() => {
    setStatus((current) => (current === "recording" ? "idle" : current));
  }, []);

  const finishProcessing = useCallback(
    (episodeId: string) => {
      clearPoll();
      setReadyEpisodeId(episodeId);
      setStatus("idle");
    },
    [clearPoll],
  );

  const failProcessing = useCallback(
    (message: string) => {
      clearPoll();
      setProcessingError(message);
      setStatus("idle");
    },
    [clearPoll],
  );

  const beginProcessing = useCallback(
    (episodeId?: string) => {
      clearPoll();
      setProcessingError(null);
      setStatus("processing");
      if (!episodeId) return;

      let rounds = 0;
      pollRef.current = setInterval(async () => {
        rounds += 1;
        if (rounds > POLL_MAX_ROUNDS) {
          failProcessing("整理逾時，請到「我的」查看進度");
          return;
        }
        try {
          const { progress, error } = await getEpisodeProgressAction(episodeId);
          if (error || !progress) return;
          if (progress.status === "error") {
            failProcessing("整理失敗，請到集數頁重試");
            return;
          }
          if (progress.status === "transcribed") {
            finishProcessing(episodeId);
          }
        } catch {
          // 單次輪詢失敗容忍，下一輪再試
        }
      }, POLL_INTERVAL_MS);
    },
    [clearPoll, failProcessing, finishProcessing],
  );

  const consumeReady = useCallback(() => setReadyEpisodeId(null), []);

  const value = useMemo<NavStatusValue>(
    () => ({
      status,
      recordSeconds,
      readyEpisodeId,
      processingError,
      startRecording,
      stopRecording,
      beginProcessing,
      finishProcessing,
      failProcessing,
      consumeReady,
    }),
    [
      status,
      recordSeconds,
      readyEpisodeId,
      processingError,
      startRecording,
      stopRecording,
      beginProcessing,
      finishProcessing,
      failProcessing,
      consumeReady,
    ],
  );

  return (
    <NavStatusContext.Provider value={value}>
      {children}
    </NavStatusContext.Provider>
  );
}

export function useNavStatus(): NavStatusValue {
  const context = useContext(NavStatusContext);
  if (!context) {
    throw new Error("useNavStatus 必須包在 NavStatusProvider 內使用");
  }
  return context;
}
