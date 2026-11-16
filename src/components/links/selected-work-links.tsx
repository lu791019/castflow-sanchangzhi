"use client";

/** 記一筆／排行程選定作品後，作品列下方的在哪看／去哪買票（GET /api/works/[id]/links） */

import { useEffect, useState } from "react";
import { withAddedLink } from "@/lib/links/merge";
import type { WorkLink, WorkLinksView } from "@/lib/links/types";
import type { WorkKind } from "@/lib/works/format";
import { WorkLinks } from "./work-links";

type State = { workId: string; links: WorkLinksView } | null;

export function SelectedWorkLinks({ workId, workKind }: { workId: string; workKind: WorkKind }) {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/works/${workId}/links`, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { data: WorkLinksView };
        setState({ workId, links: body.data });
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        // 連結只是附加資訊：讀不到就不顯示，不擋記一筆（server 端失敗已推警報）
        console.error("[log-sheet] 讀取作品連結失敗", error instanceof Error ? error.message : error);
      });
    return () => abort.abort();
  }, [workId]);

  if (!state || state.workId !== workId) return null;
  const added = (link: WorkLink) => setState({ workId, links: withAddedLink(state.links, link) });
  return <WorkLinks workId={workId} workKind={workKind} links={state.links} compact onAdded={added} />;
}
