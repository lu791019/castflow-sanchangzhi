/** server 端：帶登入者 id 掛上導覽（進度依 user id 分開存；訪客 null）；目錄頁首 ⓘ 只給訪客 */

import { requestUserId as currentUserId } from "@/lib/auth/request-user";
import { TourHost } from "./tour-host";
import { TourInfoButton } from "./tour-info-button";

export async function TourMount() {
  return <TourHost userId={await currentUserId()} />;
}

export async function TourGuestInfo() {
  return (await currentUserId()) ? null : <TourInfoButton tour="feed-tour-info" />;
}
