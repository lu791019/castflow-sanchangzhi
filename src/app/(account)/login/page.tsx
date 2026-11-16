import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginContextNote } from "@/lib/auth/login-context";
import { safeNextPath } from "@/lib/auth/paths";
import { getCurrentUserId } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { LOGIN_COPY, loginMode, LOGIN_START_STEP } from "./login-mode";
import { Welcome } from "./welcome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登入｜散場誌",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

/**
 * 沒帶 next、也不是從封面點 email 入口 → 歡迎頁（第一次打開 A）；
 * 其餘（被擋下來要登入、先說後登入 /login?next=%2Fsay%3Fresume%3D1、連結失效）→ 直接到 email 表單（D）。
 * 表單標題依來源（UX-12）：新人「用 email 開一個專欄」、回來的人「找回專欄」（login-mode.ts）。
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = firstParam(params.next);
  const next = safeNextPath(rawNext);
  if (await getCurrentUserId()) redirect(next);

  const linkFailed = firstParam(params.error) === "link";
  const contextNote = loginContextNote(next);
  const step = firstParam(params.step);
  if (!rawNext && !linkFailed && step !== "mail" && step !== LOGIN_START_STEP) return <Welcome />;
  const copy = LOGIN_COPY[loginMode({ next, step, linkFailed })];

  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-4 grid h-[52px] flex-none grid-cols-[1fr_auto_1fr] items-center border-b border-ink-950">
        <Link href="/login" aria-label="返回" className="-ml-3 flex size-11 items-center justify-center justify-self-start text-ink-950">
          <BackIcon />
        </Link>
        <span className="font-serif-tc text-prose font-bold tracking-[0.1em] text-ink-950">{copy.title}</span>
        <span />
      </header>

      <div className="px-4 pt-7">
        <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">{copy.eyebrow}</span>
        <h1 className="mt-2.5 mb-0 font-serif-tc text-section leading-[1.6] font-bold text-ink-950">
          {copy.heading[0]}
          <br />
          {copy.heading[1]}
        </h1>
        <p className="mt-2 mb-0 text-note leading-[1.8] text-ink-700">{copy.note}</p>
        {contextNote ? <p className="mt-2 mb-0 text-note leading-[1.8] font-bold text-ember-dark">{contextNote}</p> : null}
        {linkFailed ? (
          <p role="alert" className="mt-3 mb-0 text-note text-ember-deep">
            這個連結過期或已經用過了，再寄一次吧。
          </p>
        ) : null}
      </div>

      <LoginForm next={next} />
    </main>
  );
}
