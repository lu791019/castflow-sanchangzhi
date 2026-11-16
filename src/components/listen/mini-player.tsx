"use client";

import { useState } from "react";
import { formatClock } from "@/lib/listen/duration";
import { formatRate, PLAYBACK_RATES, SKIP_SECONDS } from "@/lib/listen/playback";
import type { AudioPlayer } from "./use-audio-player";

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5v14l12-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  );
}

function ProgressLine({ player }: { player: AudioPlayer }) {
  const { duration, currentTime } = player;
  const ratio = duration && duration > 0 ? Math.min(1, currentTime / duration) : 0;
  return (
    <div className="relative h-0.5 bg-ink-200">
      <div className="h-0.5 bg-ember" style={{ width: `${(ratio * 100).toFixed(2)}%` }} />
      {/* 平常是一條髮絲；觸控區放大到 20px，可拖曳跳轉 */}
      <input
        type="range"
        aria-label="播放進度"
        min={0}
        max={duration ?? 0}
        step={1}
        value={Math.floor(currentTime)}
        disabled={!duration}
        onChange={(event) => player.seek(Number(event.target.value))}
        className="absolute inset-x-0 -top-[9px] m-0 h-5 w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

function RateMenu({ player, onClose }: { player: AudioPlayer; onClose: () => void }) {
  return (
    <div
      role="menu"
      aria-label="播放速度"
      className="absolute right-2 bottom-[62px] z-10 grid grid-cols-4 overflow-hidden rounded-[4px] border border-ink-200 bg-paper"
    >
      {PLAYBACK_RATES.map((rate) => {
        const selected = rate === player.rate;
        return (
          <button
            key={rate}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            onClick={() => {
              player.setRate(rate);
              onClose();
            }}
            className={`relative flex h-11 min-w-14 items-center justify-center border-0 font-sans-tc text-caption font-bold text-ink-950 tabular-nums ${
              selected ? "bg-ember-tint" : "bg-transparent"
            }`}
          >
            {selected ? (
              <span aria-hidden="true" className="absolute top-1.5 left-1.5 block size-1.5 bg-ember" />
            ) : null}
            {formatRate(rate)}
          </button>
        );
      })}
    </div>
  );
}

/** 迷你播放器：高 60（2px 進度線＋58 控制列），固定在底部導航上方；沒有封面與標題 */
export function MiniPlayer({ player }: { player: AudioPlayer }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const total = player.duration ? formatClock(player.duration) : "--:--";

  return (
    <div className="fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-40">
      <div className="relative mx-auto w-full max-w-[480px] border-t border-ink-200 bg-paper">
        <ProgressLine player={player} />
        {menuOpen ? <RateMenu player={player} onClose={() => setMenuOpen(false)} /> : null}
        <div className="flex h-[58px] items-center gap-0.5 pr-2 pl-1">
          <button
            type="button"
            aria-label={player.playing ? "暫停" : "播放"}
            onClick={player.toggle}
            className="flex size-11 items-center justify-center border-0 bg-transparent text-ink-950"
          >
            {player.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            aria-label={`倒退 ${SKIP_SECONDS} 秒`}
            onClick={() => player.skip(-SKIP_SECONDS)}
            className="flex size-11 items-center justify-center border-0 bg-transparent font-sans-tc text-eyebrow text-ink-700"
          >
            −{SKIP_SECONDS}
          </button>
          <button
            type="button"
            aria-label={`快轉 ${SKIP_SECONDS} 秒`}
            onClick={() => player.skip(SKIP_SECONDS)}
            className="flex size-11 items-center justify-center border-0 bg-transparent font-sans-tc text-eyebrow text-ink-700"
          >
            +{SKIP_SECONDS}
          </button>
          {/* 時間靠右：中央「說一段」圓鈕上浮 32px，會蓋住控制列中段 */}
          <span className="min-w-0 flex-1 truncate pr-2.5 text-right text-caption text-ink-700 tabular-nums">
            {player.error ?? `${formatClock(player.currentTime)} / ${total}`}
          </span>
          <button
            type="button"
            aria-label="播放速度"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="h-8 min-w-11 rounded-[4px] border border-ink-400 bg-transparent px-2 font-sans-tc text-caption font-bold text-ink-950 tabular-nums"
          >
            {formatRate(player.rate)}
          </button>
        </div>
      </div>
    </div>
  );
}
