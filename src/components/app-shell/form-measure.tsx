/**
 * 表單頁（設定、我的節目、搬進舊文章）的內容寬度上限（Dex 10/15「約 720」）：
 * ≥1024 外框照舊 1360、左緣對齊刊頭，這一層靠左、最寬 Tailwind `max-w-3xl`（768，含頁面自帶的左右 16）→ 內容 736，
 * 是現有尺寸 token 裡最接近 720 的（`2xl` 672 → 內容只剩 640）。
 * 手機、平板不變（外框本來就只有 480／664）。取筆名、品味問卷在帳號流程版面（app/(account)/layout.tsx），本來就是 480 單欄，不用包。
 */
export function FormMeasure({ children }: { children: React.ReactNode }) {
  return <div className="lg:max-w-3xl">{children}</div>;
}
