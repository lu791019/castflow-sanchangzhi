"use client";

/**
 * 品味問卷的選項格（問卷與設定頁共用）：前兩題選圖格；④縣市、⑤演出種類（Q-63）。
 * 受控元件，狀態由呼叫端持有；觸控 ≥44。
 */

import { TAIWAN_CITIES } from "@/lib/events/city";
import type { LiveSubcategory } from "@/lib/events/subcategory";
import { LIVE_KIND_LABELS, toggleLiveKind } from "@/lib/taste/live-kinds";
import { toggleMedia } from "@/lib/taste/questionnaire";
import {
  MEDIA_KEYS,
  MEDIA_LABELS,
  SETTING_LABELS,
  TASTE_SETTINGS,
  type MediaKey,
  type TasteSetting,
} from "@/lib/taste/types";
import { MediaIcon, SettingIcon } from "./taste-icons";

const CHIP = "flex min-h-11 items-center justify-center rounded-control border px-1 text-note transition-colors";

const TILE =
  "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-control border text-note font-bold transition-colors";

function tileTone(on: boolean): string {
  return on ? "border-ember-dark bg-ember-tint text-ember-deep" : "border-ink-200 bg-paper text-ink-800";
}

export function MediaChoices({ value, onChange }: { value: readonly MediaKey[]; onChange: (next: MediaKey[]) => void }) {
  return (
    <div role="group" aria-label="平常看什麼、聽什麼" className="grid grid-cols-3 gap-2">
      {MEDIA_KEYS.map((key) => {
        const on = value.includes(key);
        return (
          <button key={key} type="button" role="checkbox" aria-checked={on} onClick={() => onChange(toggleMedia(value, key))} className={`${TILE} ${tileTone(on)}`}>
            <MediaIcon media={key} />
            {MEDIA_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}

export function SettingChoices({ value, onChange }: { value: TasteSetting | null; onChange: (next: TasteSetting) => void }) {
  return (
    <div role="radiogroup" aria-label="在家還是出門" className="grid grid-cols-3 gap-2">
      {TASTE_SETTINGS.map((key) => {
        const on = value === key;
        return (
          <button key={key} type="button" role="radio" aria-checked={on} onClick={() => onChange(key)} className={`${TILE} ${tileTone(on)}`}>
            <SettingIcon setting={key} />
            {SETTING_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}

/** ④常在哪個縣市看演出、看展：單選 22 縣市＋「都可以」（null） */
export function CityChoices({ value, onChange }: { value: string | null | undefined; onChange: (next: string | null) => void }) {
  const options: Array<{ city: string | null; label: string }> = [{ city: null, label: "都可以" }, ...TAIWAN_CITIES.map((city) => ({ city, label: city }))];
  return (
    <div role="radiogroup" aria-label="常在哪個縣市看演出、看展" className="grid grid-cols-4 gap-2">
      {options.map(({ city, label }) => {
        const on = value === city;
        return (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(city)}
            className={`${CHIP} ${city === null ? "col-span-4 font-bold" : ""} ${tileTone(on)}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** ⑤演出想看哪種：複選（沿用散場之前演出細分類） */
export function LiveKindChoices({ value, onChange }: { value: readonly LiveSubcategory[]; onChange: (next: LiveSubcategory[]) => void }) {
  return (
    <div role="group" aria-label="演出想看哪種" className="grid grid-cols-3 gap-2">
      {(Object.keys(LIVE_KIND_LABELS) as LiveSubcategory[]).map((kind) => {
        const on = value.includes(kind);
        return (
          <button
            key={kind}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onChange(toggleLiveKind(value, kind))}
            className={`${CHIP} min-h-14 font-bold ${tileTone(on)}`}
          >
            {LIVE_KIND_LABELS[kind]}
          </button>
        );
      })}
    </div>
  );
}
