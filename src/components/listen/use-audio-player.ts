"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { skipTime, type PlaybackRate } from "@/lib/listen/playback";

export interface AudioPlayer {
  playing: boolean;
  currentTime: number;
  /** 音檔 metadata 長度優先，未載入前用 RSS 長度 */
  duration: number | null;
  rate: PlaybackRate;
  error: string | null;
  toggle: () => void;
  seek: (seconds: number, autoplay?: boolean) => void;
  skip: (delta: number) => void;
  setRate: (rate: PlaybackRate) => void;
}

function playSafely(audio: HTMLAudioElement, onError: (message: string) => void): void {
  audio.play().catch((error: unknown) => {
    // 使用者未互動前自動播放會被瀏覽器擋（NotAllowedError），不算錯誤
    if (error instanceof DOMException && error.name === "NotAllowedError") return;
    if (error instanceof DOMException && error.name === "AbortError") return;
    onError("音檔暫時無法播放");
  });
}

/** 迷你播放器狀態：包一個 <audio>，對外提供播放/暫停、跳轉、±15 秒、倍速 */
export function useAudioPlayer(fallbackDuration: number | null): {
  audioRef: RefObject<HTMLAudioElement | null>;
  player: AudioPlayer;
} {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [metaDuration, setMetaDuration] = useState<number | null>(null);
  const [rate, setRateState] = useState<PlaybackRate>(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setMetaDuration(audio.duration);
    };
    const onError = () => setError("音檔暫時無法載入");
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("seeked", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onPause);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("seeked", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onPause);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const duration = metaDuration ?? fallbackDuration;

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) playSafely(audio, setError);
    else audio.pause();
  }, []);

  const seek = useCallback((seconds: number, autoplay = false) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, seconds);
    setCurrentTime(audio.currentTime);
    if (autoplay && audio.paused) playSafely(audio, setError);
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seek(skipTime(audio.currentTime, delta, duration));
    },
    [duration, seek],
  );

  const setRate = useCallback((next: PlaybackRate) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = next;
    setRateState(next);
  }, []);

  return {
    audioRef,
    player: { playing, currentTime, duration, rate, error, toggle, seek, skip, setRate },
  };
}
