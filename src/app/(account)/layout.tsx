/** 帳號流程（歡迎、找回專欄、取筆名）：單欄、沒有底部導航；各頁自帶刊頭與 16px 邊距（設計稿 P2 第一次打開） */
export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-paper font-sans-tc text-ink-900">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">{children}</div>
    </div>
  );
}
