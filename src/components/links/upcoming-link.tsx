/** 日誌「接下來」每列右側的次鈕：「去哪買票」「在哪看」「官網」（雛型版本二） */

import { LINK_KIND_LABELS } from "@/lib/links/merge";
import type { WorkLink } from "@/lib/links/types";
import { SECONDARY_BUTTON } from "./link-parts";

export function UpcomingLinkButton({ link }: { link: WorkLink }) {
  const label = LINK_KIND_LABELS[link.kind];
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={link.origin === "search" ? `在 ${link.label} 搜尋` : link.label}
      className={SECONDARY_BUTTON}
    >
      {label}
    </a>
  );
}
