"use client";

/** 設定 › 外觀（設計稿「P4 放映廳・切換規則」）：跟隨系統／明亮／放映廳三選一，立刻套用 */

import { useTheme } from "@/components/theme/theme-provider";
import { statusLine, type ThemePreference } from "@/lib/theme/theme";

const LIGHT: [string, string] = ["#faf8f4", "#141210"];
const SCREEN: [string, string] = ["#141110", "#d9d2c7"];

const OPTIONS: ReadonlyArray<{
  id: ThemePreference;
  label: string;
  tag?: string;
  desc: string;
  swatch: [[string, string], [string, string]];
}> = [
  { id: "system", label: "跟隨系統", tag: "預設", desc: "手機變暗，刊物也跟著關燈。", swatch: [LIGHT, SCREEN] },
  { id: "light", label: "明亮", desc: "白天的紙，墨字。", swatch: [LIGHT, LIGHT] },
  { id: "screen", label: "放映廳", desc: "關燈後的戲院，暖的黑。", swatch: [SCREEN, SCREEN] },
];

/** 選項右側 40×26 小樣張：左右兩半各畫兩條字線 */
function Swatch({ halves }: { halves: [[string, string], [string, string]] }) {
  return (
    <span aria-hidden="true" className="mt-[3px] flex h-[26px] w-10 shadow-[0_0_0_1px_var(--color-ink-200)]">
      {halves.map(([bg, fg], index) => (
        <span key={index} className="flex flex-1 flex-col justify-center gap-[3px] pl-1" style={{ background: bg }}>
          <span className="block h-0.5 w-3" style={{ background: fg }} />
          <span className="block h-0.5 w-2" style={{ background: fg }} />
        </span>
      ))}
    </span>
  );
}

export function AppearanceSection() {
  const { preference, override, systemDark, setPreference, clearOverride } = useTheme();

  return (
    <>
      <div role="radiogroup" aria-labelledby="s-look" className="mt-2 border-t border-ink-200">
        {OPTIONS.map((option) => {
          const on = preference === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPreference(option.id)}
              className="grid min-h-16 w-full grid-cols-[24px_minmax(0,1fr)_44px] items-start gap-x-2.5 border-b border-ink-200 bg-transparent py-3 text-left font-sans-tc"
            >
              <span
                aria-hidden="true"
                className={`mt-[5px] ml-[3px] block size-3 rounded-full transition-colors duration-150 ${
                  on ? "bg-ember shadow-[0_0_0_3px_var(--color-paper),0_0_0_4px_var(--color-ember)]" : "shadow-[inset_0_0_0_1px_var(--color-ink-400)]"
                }`}
              />
              <span className="flex flex-col gap-0.5">
                <span className={`text-lede text-ink-950 ${on ? "font-bold" : ""}`}>
                  {option.label}
                  {option.tag ? <span className="text-eyebrow font-normal text-ink-600">　{option.tag}</span> : null}
                </span>
                <span className="text-caption text-ink-700">{option.desc}</span>
              </span>
              <Swatch halves={option.swatch} />
            </button>
          );
        })}
      </div>
      <p role="status" className="mt-2.5 mb-0 text-eyebrow leading-[1.7] text-ink-600">
        {statusLine(preference, systemDark)}
      </p>
      {override ? (
        <div className="mt-2 flex min-h-[52px] items-center justify-between gap-2.5 bg-ember-tint pl-3 shadow-[inset_2px_0_0_var(--color-ember)]">
          <span className="text-note leading-[1.5] text-ink-950">
            {override === "screen" ? "今晚暫時關燈中" : "今晚暫時開燈中"}
            <span className="block text-eyebrow text-ink-700">從單集頁按的，不會改到這裡的選擇</span>
          </span>
          <button type="button" onClick={clearOverride} className="min-h-11 bg-transparent px-3 text-note font-bold text-ember-dark">
            恢復
          </button>
        </div>
      ) : null}
    </>
  );
}
