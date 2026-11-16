"use client";

/**
 * 散場之前①的分類切換＋卡片格：全部／電影／影集／Podcast／音樂／演出／展覽（觸控 ≥44）。
 * 「全部」放排好的前幾張；選了類別看那一類全部。沒有卡的類別不出現（來源掛掉只少那一類）。
 * 演出、展覽另有細分類小標籤與縣市選擇（live-filters.tsx）。
 */

import { useState } from "react";
import type { BeforeCard } from "@/lib/before/cards";
import type { ThisWeekView } from "@/lib/before/load";
import { BEFORE_FILTERS, type BeforeFilter } from "@/lib/before/filter";
import { availableSubFilters, filterTabs, visibleCards, type CityFilter, type SubFilter } from "@/lib/before/live-filter";
import { beforeAllLimits, maxOf, trimClass } from "@/lib/wide/layout";
import { BeforeCardView } from "./before-card";
import { LiveFilters } from "./live-filters";

/** 「全部」各寬度張數（手機 12；寬版依欄數排滿，Q-60） */
const ALL_LIMITS = beforeAllLimits();

const LABELS = new Map(BEFORE_FILTERS.map(({ value, label }) => [value, label]));

function FilterTabs({ options, value, onChange }: { options: BeforeFilter[]; value: BeforeFilter; onChange: (next: BeforeFilter) => void }) {
  return (
    <div role="group" aria-label="分類" className="flex gap-[22px] overflow-x-auto border-b border-ink-200 lg:mt-3 lg:gap-x-6">
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={`flex min-h-11 flex-none items-center text-note lg:text-lede ${
              active ? "font-bold text-ink-950 shadow-[inset_0_-2px_0_var(--color-ember)]" : "text-ink-600"
            }`}
          >
            {LABELS.get(option)}
          </button>
        );
      })}
    </div>
  );
}

interface ThisWeekCardsProps {
  cards: BeforeCard[];
  /** 演出細類的卡（小標籤用） */
  liveSub?: BeforeCard[];
  cityFilter?: CityFilter;
  /** 換縣市後 API 回的新①（直接換畫面） */
  onCityView?: (view: ThisWeekView) => void;
}

export function ThisWeekCards({ cards, liveSub = [], cityFilter, onCityView }: ThisWeekCardsProps) {
  const options = filterTabs(cards, cityFilter?.city ?? null);
  const [filter, setFilter] = useState<BeforeFilter>("all");
  const [sub, setSub] = useState<SubFilter>("all");
  const active = options.includes(filter) ? filter : "all";
  const activeSub = availableSubFilters(liveSub).includes(sub) ? sub : "all";
  const visible = visibleCards(cards, liveSub, active, activeSub, maxOf(ALL_LIMITS));

  return (
    <>
      {options.length > 2 ? <FilterTabs options={options} value={active} onChange={setFilter} /> : null}
      <LiveFilters
        active={active}
        sub={activeSub}
        onSub={setSub}
        liveSub={liveSub}
        cityFilter={cityFilter}
        empty={visible.length === 0}
        onCityView={onCityView}
      />
      {/* 欄數跟 BEFORE_GRID_COLUMNS 同步：手機 2、平板 3、1024 2、1280 3、1440+ 4 */}
      <div className="p4-stagger mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:mt-7 lg:mb-10 lg:grid-cols-2 lg:gap-x-7 lg:gap-y-10 xl:grid-cols-3 min-[90rem]:grid-cols-4">
        {visible.map((card, index) => (
          <BeforeCardView
            key={card.key}
            card={card}
            tour={index === 0 ? "before-plan" : undefined}
            className={active === "all" ? trimClass(index, ALL_LIMITS) : ""}
          />
        ))}
      </div>
    </>
  );
}
