import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginRedirectPath, safeNextPath } from "@/lib/auth/paths";
import { getCurrentUserId } from "@/lib/auth/session";
import { loadBeforeCity } from "@/lib/before/city-repository";
import { loadQuestionnaire, loadTasteLiveKinds } from "@/lib/taste/repository";
import { TasteFlow, type TasteInitial } from "./taste-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "品味問卷｜散場誌",
  robots: { index: false },
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 讀不到就從空白開始，不擋問卷 */
async function orBlank<T>(label: string, load: () => Promise<T>, blank: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(`[taste] load ${label} failed`, error instanceof Error ? error.message : error);
    return blank;
  }
}

async function initialAnswers(userId: string): Promise<TasteInitial> {
  const [questionnaire, city, liveKinds] = await Promise.all([
    orBlank("questionnaire", () => loadQuestionnaire(userId), null),
    orBlank("city", () => loadBeforeCity(userId), null),
    orBlank("live kinds", () => loadTasteLiveKinds(userId), []),
  ]);
  return { questionnaire, city, liveKinds };
}

/** 取完筆名之後的品味問卷（3 題；勾了演出或展覽多問縣市與演出種類，Q-63；可跳過）；答完去 next（預設散場之前） */
export default async function TasteOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  const userId = await getCurrentUserId();
  if (!userId) redirect(loginRedirectPath("/onboarding/taste", ""));
  return <TasteFlow next={next} initial={await initialAnswers(userId)} />;
}
