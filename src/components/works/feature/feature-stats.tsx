/** 特輯統計欄（P3 作品特輯 A/B/C）：收錄／本週／最近一段；零感受改為收錄／最近一段／第一段等你。數字用阿拉伯數字 */

interface FeatureStatsProps {
  count: number;
  /** 本週說過的人數（同場） */
  weekPeople: number;
  latest: string | null;
}

interface Stat {
  label: string;
  value: string;
  tone: "lead" | "plain" | "muted" | "ember";
}

function statsFor({ count, weekPeople, latest }: FeatureStatsProps): Stat[] {
  const total: Stat = { label: "收錄", value: `${count} 段感受`, tone: "lead" };
  if (count === 0) {
    return [total, { label: "最近一段", value: "—", tone: "muted" }, { label: "第一段", value: "等你", tone: "ember" }];
  }
  return [
    total,
    weekPeople > 0
      ? { label: "本週", value: `${weekPeople} 人說過`, tone: "plain" }
      : { label: "本週", value: "還沒有人", tone: "muted" },
    { label: "最近一段", value: latest ?? "—", tone: "plain" },
  ];
}

const TONE_CLASS: Record<Stat["tone"], string> = {
  lead: "font-serif-tc text-prose font-bold text-ink-950",
  plain: "pt-[3px] text-note text-ink-950 tabular-nums",
  muted: "pt-[3px] text-note text-ink-600",
  ember: "pt-[3px] text-note font-bold text-ember-dark",
};

export function FeatureStats(props: FeatureStatsProps) {
  return (
    <div className="mt-6 grid grid-cols-3 border-t border-b border-t-ink-950 border-b-ink-200 py-3">
      {statsFor(props).map((stat, index) => (
        <div key={stat.label} className={`flex flex-col gap-0.5 ${index > 0 ? "border-l border-ink-200 pl-3" : ""}`}>
          <span className="text-eyebrow tracking-[0.14em] text-ink-600">{stat.label}</span>
          <span className={TONE_CLASS[stat.tone]}>{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
