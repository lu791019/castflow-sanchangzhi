"use client";

/**
 * 散場之前①出門類的篩選（觸控 ≥44）：
 * - 演出分頁下的小標籤：全部／演唱會／獨立音樂／戲劇／舞蹈／音樂祭（只列有資料的；窄螢幕換行，不橫向捲動）
 * - 「全部」與演出、展覽分頁的「在哪個縣市」（原生 select；選項只列 30 天內有活動的縣市，多的在前）：
 *   改了先 POST 存（換裝置也記得），API 回依新縣市重算的①直接換畫面；router.refresh() 只在背景同步
 *   （畫面不等 refresh：打包版偶爾套不上 refresh 的串流回應，選單會一直停用）
 * - 選了縣市但這一類沒場次：一句話，不讓整區消失
 */

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { BeforeCard } from "@/lib/before/cards";
import type { ThisWeekView } from "@/lib/before/load";
import type { BeforeFilter } from "@/lib/before/filter";
import {
  availableSubFilters,
  cityChoices,
  isOutingMedia,
  liveEmptyCopy,
  showsCityFilter,
  SUB_FILTER_LABELS,
  type CityFilter,
  type SubFilter,
} from "@/lib/before/live-filter";

const ALL_CITIES = "";
const SAVE_FAILED = "沒存到，稍後再試";

function SubFilterChips({ options, value, onChange }: { options: SubFilter[]; value: SubFilter; onChange: (next: SubFilter) => void }) {
  return (
    <div role="group" aria-label="演出類型" className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={`flex min-h-11 flex-none items-center rounded-control border px-3 text-caption transition-colors ${
              active ? "border-ember-dark bg-ember-tint font-bold text-ember-deep" : "border-ink-200 bg-paper text-ink-700"
            }`}
          >
            {SUB_FILTER_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}

/** 存縣市；回依新縣市重算的①（server 重算失敗時 null） */
async function saveCity(city: string | null): Promise<ThisWeekView | null> {
  const response = await fetch("/api/before/city", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json().catch(() => null)) as { thisWeek?: ThisWeekView | null } | null;
  return body?.thisWeek ?? null;
}

function CitySelect({ cityFilter, onCityView }: { cityFilter: CityFilter; onCityView?: (view: ThisWeekView) => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (value: string) => {
    const next = value === ALL_CITIES ? null : value;
    setSaving(true);
    setError(null);
    try {
      const view = await saveCity(next);
      if (view && onCityView) onCityView(view);
      startTransition(() => router.refresh());
    } catch (cause) {
      console.error("[before] 縣市沒存到", cause instanceof Error ? cause.message : cause);
      setError(SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3">
      <label className="flex items-center gap-2.5 text-caption text-ink-600">
        在哪個縣市
        <select
          value={cityFilter.city ?? ALL_CITIES}
          disabled={saving}
          aria-busy={saving}
          onChange={(event) => void change(event.target.value)}
          className="min-h-11 rounded-control border border-ink-200 bg-paper px-3 text-note text-ink-950 disabled:opacity-60"
        >
          <option value={ALL_CITIES}>全部縣市</option>
          {cityChoices(cityFilter.cities, cityFilter.city).map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p role="alert" className="mt-1.5 mb-0 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface LiveFiltersProps {
  active: BeforeFilter;
  sub: SubFilter;
  onSub: (next: SubFilter) => void;
  liveSub: readonly BeforeCard[];
  cityFilter?: CityFilter;
  /** 這個分頁目前一張卡都沒有 */
  empty: boolean;
  onCityView?: (view: ThisWeekView) => void;
}

export function LiveFilters({ active, sub, onSub, liveSub, cityFilter, empty, onCityView }: LiveFiltersProps) {
  if (!showsCityFilter(active)) return null;
  const subs = active === "live" ? availableSubFilters(liveSub) : [];
  const showCity = cityFilter && (cityFilter.city !== null || cityFilter.cities.length > 0);
  return (
    <>
      {subs.length > 0 ? <SubFilterChips options={subs} value={sub} onChange={onSub} /> : null}
      {showCity ? <CitySelect cityFilter={cityFilter} onCityView={onCityView} /> : null}
      {empty && cityFilter?.city && isOutingMedia(active) ? (
        <p className="mt-3 mb-0 border-b border-ink-200 pb-3 text-caption text-ink-600">{liveEmptyCopy(cityFilter.city, active, sub)}</p>
      ) : null}
    </>
  );
}
