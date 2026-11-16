"use client";

/**
 * 散場之前①「這週上映・開演・開展」整區（client）：卡片、文化部資料來源、多來源署名。
 * 換縣市時 /api/before/city 存好後回依新縣市重算的①，直接換這一區；router.refresh() 只在背景同步
 * （打包版偶爾套不上 refresh 的串流回應）。
 */

import { useEffect, useSyncExternalStore } from "react";
import type { ThisWeekView } from "@/lib/before/load";
import { EVENT_CREDIT_PREFIX, EVENT_SOURCE_CREDITS } from "@/lib/events/credits";
import type { EventSource } from "@/lib/events/collected";
import { CULTURE_ATTRIBUTION, CULTURE_SOURCE_URL } from "@/lib/events/culture";
import { createKeyedStore } from "@/lib/ui/keyed-store";
import { ThisWeekCards } from "./this-week-cards";

export const NO_LIVE_COPY = "這週還沒有人記下演出或展覽";

/** 來源另有授權條款（科工館 CC BY-SA 4.0）：名稱後面括號標授權 */
function EventLicense({ license }: { license: { label: string; url: string } }) {
  return (
    <>
      （
      <a href={license.url} target="_blank" rel="noopener noreferrer license" className="text-ink-600 underline-offset-2">
        {license.label}
      </a>
      ）
    </>
  );
}

/** 多來源活動的署名：只列卡片實際用到的來源 */
function EventCredits({ sources, afterCulture }: { sources: EventSource[]; afterCulture: boolean }) {
  return (
    <p className={`${afterCulture ? "mt-1.5" : "mt-3"} mb-0 text-eyebrow text-ink-600`}>
      {EVENT_CREDIT_PREFIX}
      {sources.map((source, index) => (
        <span key={source}>
          {index > 0 ? "、" : null}
          <a href={EVENT_SOURCE_CREDITS[source].url} target="_blank" rel="noopener noreferrer" className="text-ink-600 underline-offset-2">
            {EVENT_SOURCE_CREDITS[source].label}
          </a>
          {EVENT_SOURCE_CREDITS[source].license ? <EventLicense license={EVENT_SOURCE_CREDITS[source].license} /> : null}
        </span>
      ))}
    </p>
  );
}

/**
 * 換縣市後 API 回的新①：記在頁面層級（不放元件 state：背景 refresh 套上較舊的回應而重掛元件時，不會掉回舊縣市）。
 * server 重讀到同一個縣市就以 server 為準並清掉。
 */
const CITY_VIEW_KEY = "before";
const cityViews = createKeyedStore<ThisWeekView | null>(null);

function serverCaughtUp(initial: ThisWeekView, chosen: ThisWeekView | null): boolean {
  return chosen !== null && initial.cityFilter.city === chosen.cityFilter.city && initial !== chosen;
}

export function ThisWeekSection({ initial }: { initial: ThisWeekView }) {
  const chosen = useSyncExternalStore(cityViews.subscribe, () => cityViews.get(CITY_VIEW_KEY), () => null);
  const caughtUp = serverCaughtUp(initial, chosen);
  useEffect(() => {
    if (caughtUp) cityViews.set(CITY_VIEW_KEY, null);
  }, [caughtUp]);
  const view = chosen && !caughtUp ? chosen : initial;
  const { cards, hasLive, hasCulture, eventSources, liveSub, cityFilter } = view;
  const onCityView = (next: ThisWeekView) => cityViews.set(CITY_VIEW_KEY, next);
  return (
    <section aria-labelledby="before-this-week" className="pt-5">
      <h2 id="before-this-week" className="sr-only">
        這週上映・開演・開展
      </h2>
      {cards.length > 0 || cityFilter?.city ? <ThisWeekCards cards={cards} liveSub={liveSub} cityFilter={cityFilter} onCityView={onCityView} /> : null}
      {hasLive ? null : (
        <p className="mt-3 mb-0 border-b border-ink-200 pb-3 text-caption text-ink-600">{NO_LIVE_COPY}</p>
      )}
      {/* 政府資料開放授權：標示來源 */}
      {hasCulture ? (
        <p className="mt-3 mb-0 text-eyebrow text-ink-600">
          <a href={CULTURE_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-ink-600 underline-offset-2">
            {CULTURE_ATTRIBUTION}
          </a>
        </p>
      ) : null}
      {eventSources.length > 0 ? <EventCredits sources={eventSources} afterCulture={hasCulture} /> : null}
    </section>
  );
}
