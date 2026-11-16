"use client";

/**
 * 設定「品味」：可改問卷①媒介、②在家／出門、④縣市、⑤演出種類（③挑 3 部只在問卷）；改了就存，失敗退回。
 * ④⑤顯示條件同問卷（lib/taste/steps.ts）：①勾了演出或展覽才有④、勾了演出才有⑤。
 * 每次只送改到的那題：④⑤沒改就不帶，免得蓋掉在散場之前另外換過的縣市。
 */

import { useState, useTransition } from "react";
import { saveTasteSettingsAction } from "@/app/(account)/onboarding/taste/actions";
import { CityChoices, LiveKindChoices, MediaChoices, SettingChoices } from "@/components/taste/taste-choices";
import type { LiveSubcategory } from "@/lib/events/subcategory";
import { asksCity, asksLiveKinds } from "@/lib/taste/steps";
import type { MediaKey, Questionnaire, TasteSetting } from "@/lib/taste/types";

export interface TasteSettingsInitial {
  questionnaire: Questionnaire;
  /** 散場之前的縣市：null＝全部縣市（都可以）；undefined＝讀不到，不預選 */
  city: string | null | undefined;
  liveKinds: LiveSubcategory[];
}

type Change = Partial<Pick<TasteSettingsInitial, "city" | "liveKinds">> & { questionnaire?: Questionnaire };

export function TasteSection({ initial }: { initial: TasteSettingsInitial }) {
  const [answers, setAnswers] = useState<TasteSettingsInitial>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { media, setting } = answers.questionnaire;

  function save(change: Change) {
    const previous = answers;
    const next = { ...answers, ...change };
    setAnswers(next);
    setError(null);
    startTransition(async () => {
      const result = await saveTasteSettingsAction({
        ...next.questionnaire,
        ...("city" in change ? { city: change.city } : {}),
        ...("liveKinds" in change ? { liveKinds: change.liveKinds } : {}),
      });
      if (!result.ok) {
        setAnswers(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 pt-3.5">
      <div className="flex flex-col gap-2">
        <span className="text-note text-ink-700">平常看什麼、聽什麼（可複選）</span>
        <MediaChoices value={media} onChange={(next: MediaKey[]) => save({ questionnaire: { media: next, setting } })} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-note text-ink-700">比較常在家，還是出門</span>
        <SettingChoices value={setting} onChange={(next: TasteSetting) => save({ questionnaire: { media, setting: next } })} />
      </div>
      {asksCity(media) ? (
        <div className="flex flex-col gap-2">
          <span className="text-note text-ink-700">常在哪個縣市看演出、看展（散場之前先列這裡）</span>
          <CityChoices value={answers.city} onChange={(city: string | null) => save({ city })} />
        </div>
      ) : null}
      {asksLiveKinds(media) ? (
        <div className="flex flex-col gap-2">
          <span className="text-note text-ink-700">演出想看哪種（可複選）</span>
          <LiveKindChoices value={answers.liveKinds} onChange={(liveKinds: LiveSubcategory[]) => save({ liveKinds })} />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-caption text-ember-deep">
          {error}
        </p>
      ) : null}
      <p className="m-0 text-caption leading-[1.8] text-ink-600">記得越多，散場之前越照你的口味排；這裡只在剛開始、紀錄還少的時候派上用場。</p>
    </div>
  );
}
