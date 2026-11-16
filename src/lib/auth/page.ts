/** Server component 用：取 uid，未登入導到 /login?next=（proxy 已先擋，這裡是第二道並取得 uid 做過濾） */

import { redirect } from "next/navigation";
import { loginRedirectPath } from "./paths";
import { getCurrentUserId } from "./session";

export async function requirePageUserId(currentPath: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect(loginRedirectPath(currentPath, ""));
  return userId;
}
