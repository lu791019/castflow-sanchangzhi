/** 補封面流程的實際接線（server only）：下載、轉存 covers 桶、寫待審表、補空的 poster_url、警報 */

import { getServerNotify } from "@/lib/alerts/notify";
import { downloadRemoteCover } from "./fetch-remote";
import { fillEmptyPoster } from "./repository";
import { coversPublicPrefix, uploadCover } from "./storage";
import { insertCoverSubmission } from "./submissions";
import { submitCover, type CoverSubmitInput, type CoverSubmitResult } from "./submit";

function warn(title: string, detail: string): void {
  console.warn(`[covers] ${title}`, detail);
  void getServerNotify()("warn", title, detail).catch(() => undefined);
}

export function submitWorkCover(input: CoverSubmitInput): Promise<CoverSubmitResult> {
  return submitCover(
    {
      ownPrefix: coversPublicPrefix(),
      download: downloadRemoteCover,
      store: (bytes, type) => uploadCover(input.userId, bytes, type),
      insertSubmission: insertCoverSubmission,
      fillEmptyPoster,
      warn,
    },
    input,
  );
}
