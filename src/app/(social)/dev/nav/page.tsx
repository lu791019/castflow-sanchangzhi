import type { Metadata } from "next";
import { BottomNavBar } from "@/components/app-shell/bottom-nav";

export const metadata: Metadata = {
  title: "底部導航 · 狀態｜散場誌",
};

/** 底部導航四狀態展示（開發用，不入主導航） */
export default function NavStatesPage() {
  const states = [
    {
      key: "A",
      label: "A · 首頁 active",
      note: "頂線上 20×2 燒橙書籤 + 墨色粗體",
      bar: <BottomNavBar active="home" status="idle" />,
    },
    {
      key: "B",
      label: "B · 按住圓鈕（說一段）",
      note: "點一下＝記一筆；按住縮至 .94、圖示換麥克風、外圈燒橙 450ms 畫滿",
      bar: <BottomNavBar active={null} status="idle" demoPressed />,
    },
    {
      key: "C",
      label: "C · 錄音中",
      note: "圓鈕燒橙 + 漣漪 + 計時；其他項退 ink-300 不可點",
      bar: <BottomNavBar active={null} status="recording" recordSeconds={42} />,
    },
    {
      key: "D",
      label: "D · AI 整理中",
      note: "外圈轉動；整理好時「我的」亮燒橙小點",
      bar: <BottomNavBar active="home" status="processing" showReadyDot />,
    },
  ];

  return (
    <div className="bg-paper-2 px-4 pb-10">
      <div className="flex items-baseline justify-between border-b border-ink-950 pt-9 pb-3">
        <h1 className="m-0 font-serif-tc text-section text-ink-950">
          底部導航 · 狀態
        </h1>
        <span className="text-eyebrow tracking-[0.16em] text-ink-600">
          高 84 · 圓鈕 64 · 觸控 ≥44
        </span>
      </div>

      {states.map((state) => (
        <section key={state.key} className="pt-6">
          <div className="flex flex-col gap-1 pb-8">
            <span className="text-note font-bold text-ink-950">
              {state.label}
            </span>
            <span className="text-caption leading-[1.7] text-ink-700">
              {state.note}
            </span>
          </div>
          {state.bar}
        </section>
      ))}
    </div>
  );
}
