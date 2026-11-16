/** 品味問卷的選圖（線稿，currentColor；不放人臉） */

import type { MediaKey, TasteSetting } from "@/lib/taste/types";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const MEDIA_PATHS: Record<MediaKey, React.ReactNode> = {
  movie: (
    <>
      <rect x="4" y="8" width="24" height="18" rx="1.5" />
      <path d="M4 13h24M9 8l3 5M15 8l3 5M21 8l3 5" />
    </>
  ),
  series: (
    <>
      <rect x="4" y="7" width="24" height="16" rx="1.5" />
      <path d="M12 27h8M16 23v4" />
    </>
  ),
  podcast: (
    <>
      <rect x="12" y="4" width="8" height="14" rx="4" />
      <path d="M8 15a8 8 0 0 0 16 0M16 23v5M12 28h8" />
    </>
  ),
  // 雙音符（跟日誌戳記的音符同一個輪廓）
  music: (
    <>
      <path d="M12 24V9l14-3v15M12 13l14-3" />
      <circle cx="8.5" cy="24" r="3.5" />
      <circle cx="22.5" cy="21" r="3.5" />
    </>
  ),
  live: (
    <>
      <path d="M4 26h24M7 26V12l9-6 9 6v14" />
      <path d="M12 26v-7a4 4 0 0 1 8 0v7" />
    </>
  ),
  exhibition: (
    <>
      <rect x="6" y="5" width="20" height="16" />
      <path d="M10 17l4-5 3 3 2-2 3 4M16 21v6M11 27h10" />
    </>
  ),
};

const SETTING_PATHS: Record<TasteSetting, React.ReactNode> = {
  home: <path d="M5 15l11-9 11 9M8 13v13h16V13M14 26v-7h4v7" />,
  out: (
    <>
      <path d="M9 27V5h12v22M21 8l5 2v15l-5 2" />
      <circle cx="18" cy="16" r="0.8" />
    </>
  ),
  both: (
    <>
      <path d="M3 17l7-6 7 6M5 15v10h10V15" />
      <path d="M19 27V9h8v18" />
    </>
  ),
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" {...STROKE}>
      {children}
    </svg>
  );
}

export function MediaIcon({ media }: { media: MediaKey }) {
  return <Icon>{MEDIA_PATHS[media]}</Icon>;
}

export function SettingIcon({ setting }: { setting: TasteSetting }) {
  return <Icon>{SETTING_PATHS[setting]}</Icon>;
}
