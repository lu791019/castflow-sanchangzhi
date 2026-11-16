import { NextRequest, NextResponse } from "next/server";
import { getServerNotify } from "@/lib/alerts/notify";
import { validateApiKey } from "@/lib/api-guard";
import { listDueReminders, settlePlans } from "@/lib/journal/repository";
import { listDueSettlePrompts } from "@/lib/journal/settle-repository";
import { serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 散場當下提醒（settle_prompt）讀取失敗不擋其他提醒，但要推警報 */
async function settlePromptsOrEmpty() {
  try {
    return await listDueSettlePrompts();
  } catch (error) {
    await getServerNotify()("warn", "散場提醒讀取失敗，本輪略過", errorMessage(error)).catch(() => undefined);
    return [];
  }
}

/** 給 worker：到期且未提醒的紀錄（含已組好的通知文案與點擊網址），x-api-key 守衛 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    await settlePlans().catch((error: unknown) => {
      console.error("[journal:due] 計畫轉已看失敗", { message: errorMessage(error) });
    });
    const [reminders, settle] = await Promise.all([listDueReminders(), settlePromptsOrEmpty()]);
    return NextResponse.json({ reminders: [...reminders, ...settle] });
  } catch (error) {
    return serverError("journal:due", error, "讀取到期提醒失敗");
  }
}
