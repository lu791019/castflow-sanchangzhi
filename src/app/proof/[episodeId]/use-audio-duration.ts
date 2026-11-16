"use client";

import { useEffect, useState } from "react";

/**
 * 讀錄音長度（秒）。MediaRecorder 錄的 webm 常回 Infinity：把 currentTime 推到極大值，
 * 等瀏覽器掃完檔案再讀 duration。讀不到回 null（畫面就不寫長度，不猜）。
 */
export function useAudioDuration(url: string | null): number | null {
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => {
    if (!url) return;
    const audio = new Audio();
    audio.preload = "metadata";
    const settle = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        audio.removeEventListener("timeupdate", settle);
      }
    };
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) return settle();
      audio.addEventListener("timeupdate", settle);
      audio.currentTime = Number.MAX_SAFE_INTEGER;
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.src = url;
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", settle);
      audio.src = "";
    };
  }, [url]);
  return duration;
}
