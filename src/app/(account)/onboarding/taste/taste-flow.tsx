"use client";

/**
 * 新用戶品味問卷（Q-42、Q-63）：媒介複選 → 在家／出門 → 挑 3 部看過或想看的
 * → ④常在哪個縣市看演出、看展（①勾了演出或展覽才問）→ ⑤演出想看哪種（①勾了演出才問）。
 * 沒勾演出、展覽的人跟以前一樣只有 3 題（lib/taste/steps.ts）。
 * 每一步都能跳過；跳過時把已答的存下（沒答就不寫），直接去 next。
 */

import { useState, useTransition } from "react";
import { CityChoices, LiveKindChoices, MediaChoices, SettingChoices } from "@/components/taste/taste-choices";
import { allPicksAnswered, TastePicks, type PickedWork } from "@/components/taste/taste-picks";
import type { LiveSubcategory } from "@/lib/events/subcategory";
import { asksCity, asksLiveKinds, tasteSteps, type TasteStep } from "@/lib/taste/steps";
import type { MediaKey, Questionnaire, TasteSetting } from "@/lib/taste/types";
import { saveTasteOnboardingAction } from "./actions";

const STEP_COPY: Record<TasteStep, { title: string; note: string }> = {
  media: { title: "平常看什麼、聽什麼？", note: "可以複選。散場之前會照這個排順序。" },
  setting: { title: "比較常在家，還是出門？", note: "在家追劇，還是出門看一場、聽一場。" },
  picks: { title: "挑 3 部看過或想看的", note: "每部選看過或想看。只拿來排散場之前，不會記進日誌，也不會提醒你。" },
  city: { title: "常在哪個縣市看演出、看展？", note: "選一個。散場之前會先列這裡的演出和展覽，之後隨時能換。" },
  live: { title: "演出想看哪種？", note: "可以複選。散場之前會把這幾種排在前面。" },
};

const UNANSWERED = "每一部都選一下看過或想看。";

const PRIMARY_BUTTON =
  "flex h-[52px] w-full items-center justify-center rounded-[4px] pl-[0.16em] text-lede font-bold tracking-[0.16em] transition-colors disabled:opacity-60";

/** 問卷進來時已有的答案（重來一次時帶出）；④沒存過或存的是全部縣市都當沒答 */
export interface TasteInitial {
  questionnaire: Questionnaire | null;
  city: string | null;
  liveKinds: LiveSubcategory[];
}

interface TasteFlowProps {
  next: string;
  initial: TasteInitial;
}

function StepHead({ index, count, step, onSkip, pending }: { index: number; count: number; step: TasteStep; onSkip: () => void; pending: boolean }) {
  const copy = STEP_COPY[step];
  return (
    <>
      <div className="flex items-start justify-between pt-6 pr-2 pl-4">
        <div className="flex flex-col gap-2 pt-1.5">
          <span className="text-caption font-bold tracking-[0.2em] text-ember-dark tabular-nums">
            品味・{index + 1}/{count}
          </span>
          <h1 className="m-0 font-serif-tc text-section leading-[1.5] font-bold text-ink-950">{copy.title}</h1>
        </div>
        <button type="button" onClick={onSkip} disabled={pending} className="min-h-11 px-2 text-note text-ink-600 underline-offset-4 hover:underline">
          先跳過
        </button>
      </div>
      <p className="mx-4 mt-1 mb-0 text-note leading-[1.7] text-ink-700">{copy.note}</p>
    </>
  );
}

export function TasteFlow({ next, initial }: TasteFlowProps) {
  const [index, setIndex] = useState(0);
  const [media, setMedia] = useState<MediaKey[]>(initial.questionnaire?.media ?? []);
  const [setting, setSetting] = useState<TasteSetting | null>(initial.questionnaire?.setting ?? null);
  const [picks, setPicks] = useState<PickedWork[]>([]);
  /** undefined＝還沒答；null＝都可以 */
  const [city, setCity] = useState<string | null | undefined>(initial.city ?? undefined);
  const [liveKinds, setLiveKinds] = useState<LiveSubcategory[]>(initial.liveKinds);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const steps = tasteSteps(media);
  const current = Math.min(index, steps.length - 1);
  const step = steps[current];
  const last = current === steps.length - 1;

  /** 整頁導向：散場之前要由 server 依新的品味資料重排；只送選了看過／想看的；④⑤只送①勾到的 */
  function save(withPicks: ReadonlyArray<PickedWork & { seen: boolean }>) {
    setError(null);
    startTransition(async () => {
      const followUps = {
        ...(asksCity(media) && city !== undefined ? { city } : {}),
        ...(asksLiveKinds(media) && liveKinds.length > 0 ? { liveKinds } : {}),
      };
      const answered = media.length > 0 || setting !== null || withPicks.length > 0 || Object.keys(followUps).length > 0;
      if (answered) {
        const result = await saveTasteOnboardingAction({
          media,
          setting,
          picks: withPicks.map((pick) => ({ workId: pick.workId, seen: pick.seen })),
          ...followUps,
        });
        if (!result.ok) return setError(result.error);
      }
      window.location.replace(next);
    });
  }

  function advance() {
    if (step === "picks" && !allPicksAnswered(picks)) return setError(UNANSWERED);
    if (!last) return setIndex(current + 1);
    save(picks.filter((pick): pick is PickedWork & { seen: boolean } => pick.seen !== null));
  }

  /** 跳過：已選好看過／想看的照存，還沒選的不存 */
  function skip() {
    save(picks.filter((pick): pick is PickedWork & { seen: boolean } => pick.seen !== null));
  }

  function changePicks(next: PickedWork[]) {
    setPicks(next);
    if (error === UNANSWERED && allPicksAnswered(next)) setError(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <StepHead index={current} count={steps.length} step={step} onSkip={skip} pending={pending} />
      <div className="mx-4 mt-6">
        {step === "media" ? <MediaChoices value={media} onChange={setMedia} /> : null}
        {step === "setting" ? <SettingChoices value={setting} onChange={setSetting} /> : null}
        {step === "picks" ? <TastePicks picks={picks} onChange={changePicks} /> : null}
        {step === "city" ? <CityChoices value={city} onChange={setCity} /> : null}
        {step === "live" ? <LiveKindChoices value={liveKinds} onChange={setLiveKinds} /> : null}
      </div>
      {error ? (
        <p role="alert" className="mx-4 mt-3 mb-0 text-note text-ember-deep">
          {error}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-2 px-4 pt-8 pb-3.5">
        <button type="button" onClick={advance} disabled={pending} className={`${PRIMARY_BUTTON} bg-ember-dark text-paper`}>
          {pending ? "儲存中…" : last ? "完成" : "下一題"}
        </button>
        {current > 0 ? (
          <button type="button" onClick={() => setIndex(current - 1)} disabled={pending} className="min-h-11 text-note text-ink-600">
            上一題
          </button>
        ) : null}
      </div>
    </div>
  );
}
