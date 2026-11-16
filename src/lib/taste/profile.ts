/**
 * 品味資料計算（純函式，Q-41／Q-43）：行為為主、問卷為輔。
 * - 媒介分佈：日誌＋自己公開發佈文章的作品 kind
 * - 場域分佈：日誌 venue（在家／通勤＝在家，電影院／演出／展覽＝出門，其他不計）
 * - 作品集合、畫記句集合：給配對用
 * 行為（日誌＋文章）不足 BEHAVIOR_THRESHOLD 筆時，問卷答案才加進來補權。
 * 問卷第三題挑的作品（UX-15 起不寫日誌）：一律進作品集合；補權時 kind 也算進媒介分佈。
 * 問卷⑤演出想看哪種（Q-63）：行為推不出細類，不管行為多少都照帶（只影響演出彼此的先後）。
 */

import type { Venue } from "@/lib/journal/types";
import type { WorkKind } from "@/lib/works/format";
import { MEDIA_KEYS, type MediaKey, type TasteInputs, type TasteProfile } from "./types";

export const BEHAVIOR_THRESHOLD = 3;
/** 問卷每個選項等同幾筆行為 */
const QUESTIONNAIRE_WEIGHT = 1;

const VENUE_SETTING: Partial<Record<Venue, "home" | "out">> = {
  home: "home",
  commute: "home",
  cinema: "out",
  live: "out",
  exhibition: "out",
};

export function mediaOfWorkKind(kind: WorkKind): MediaKey {
  return kind === "podcast_episode" ? "podcast" : kind;
}

function normalize<K extends string>(counts: Record<K, number>): Record<K, number> {
  const total = Object.values<number>(counts).reduce((sum, value) => sum + value, 0);
  if (total === 0) return counts;
  return Object.fromEntries(Object.entries<number>(counts).map(([key, value]) => [key, value / total])) as Record<K, number>;
}

function zeroMedia(): Record<MediaKey, number> {
  return Object.fromEntries(MEDIA_KEYS.map((key) => [key, 0])) as Record<MediaKey, number>;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function buildTasteProfile(inputs: TasteInputs): TasteProfile {
  const kinds = [
    ...inputs.journals.flatMap((journal) => (journal.kind ? [journal.kind] : [])),
    ...inputs.publishedWorks.map((work) => work.kind),
  ];
  const mediaCounts = kinds.reduce(
    (counts, kind) => ({ ...counts, [mediaOfWorkKind(kind)]: counts[mediaOfWorkKind(kind)] + 1 }),
    zeroMedia(),
  );
  const settingCounts = inputs.journals.reduce(
    (counts, journal) => {
      const side = VENUE_SETTING[journal.venue];
      return side ? { ...counts, [side]: counts[side] + 1 } : counts;
    },
    { home: 0, out: 0 },
  );

  const picks = inputs.picks ?? [];
  const behaviorCount = inputs.journals.length + inputs.publishedWorks.length;
  const cold = behaviorCount < BEHAVIOR_THRESHOLD;
  const questionnaire = cold ? inputs.questionnaire : null;
  const pickedMedia = cold ? picks.map((pick) => mediaOfWorkKind(pick.kind)) : [];
  const usedQuestionnaire = Boolean(questionnaire && (questionnaire.media.length > 0 || questionnaire.setting)) || pickedMedia.length > 0;
  const media = [...(questionnaire?.media ?? []), ...pickedMedia].reduce(
    (counts, key) => ({ ...counts, [key]: counts[key] + QUESTIONNAIRE_WEIGHT }),
    mediaCounts,
  );
  const setting = questionnaire?.setting
    ? questionnaire.setting === "both"
      ? { home: settingCounts.home + QUESTIONNAIRE_WEIGHT / 2, out: settingCounts.out + QUESTIONNAIRE_WEIGHT / 2 }
      : { ...settingCounts, [questionnaire.setting]: settingCounts[questionnaire.setting] + QUESTIONNAIRE_WEIGHT }
    : settingCounts;

  const works = unique([
    ...inputs.journals.flatMap((journal) => (journal.workId ? [journal.workId] : [])),
    ...inputs.publishedWorks.map((work) => work.workId),
    ...picks.map((pick) => pick.workId),
  ]);
  const passages = unique(inputs.marks.map((mark) => `${mark.episodeId}:${mark.passageHash}`));
  const normalizedMedia = normalize(media);
  const normalizedSetting = normalize(setting);
  const hasSignal = [...Object.values(normalizedMedia), ...Object.values(normalizedSetting)].some((value) => value > 0);

  return {
    media: normalizedMedia,
    setting: normalizedSetting,
    works,
    passages,
    behaviorCount,
    usedQuestionnaire,
    hasSignal,
    liveKinds: [...(inputs.liveKinds ?? [])],
  };
}
