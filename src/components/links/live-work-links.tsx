"use client";

/**
 * 在哪看＋補連結區（資訊欄、場刊頁）：讀者「告訴我們」送出、已生效的連結直接放進畫面（API 回的那一筆），
 * router.refresh() 只在背景同步。畫面不靠 refresh 的串流回應（打包版偶爾套不上）。
 */

import { useRouter } from "next/navigation";
import { startTransition, useSyncExternalStore } from "react";
import { WatchSection } from "@/components/share/watch-section";
import { withAddedLink } from "@/lib/links/merge";
import type { WorkLink, WorkLinksView } from "@/lib/links/types";
import { createKeyedStore } from "@/lib/ui/keyed-store";
import { boxWatchInfo } from "@/lib/links/view";
import type { WatchInfo } from "@/lib/watch/service";
import type { WorkKind } from "@/lib/works/format";
import { WorkLinks } from "./work-links";

const NONE: readonly WorkLink[] = [];
/** 依作品記讀者這次補的連結（不放元件 state：背景 refresh 重掛元件時不會掉） */
const addedLinks = createKeyedStore<readonly WorkLink[]>(NONE);

interface LiveWorkLinksProps {
  workId: string;
  workKind: WorkKind;
  links: WorkLinksView;
  /** 在哪看／在哪聽；null = 不顯示該區（演出／展覽） */
  watch?: WatchInfo | null;
  podcast?: boolean;
  readHref?: string | null;
}

export function LiveWorkLinks({ workId, workKind, links, watch = null, podcast = false, readHref = null }: LiveWorkLinksProps) {
  const router = useRouter();
  // 讀者補的連結一直疊在 server 資料上（同來源以新的為準，server 重讀到之後疊上去也不會重複）：
  // refresh 若套上較舊的回應，畫面也不會倒退
  const added = useSyncExternalStore(addedLinks.subscribe, () => addedLinks.get(workId), () => NONE);
  const view = added.reduce(withAddedLink, links);
  const shownWatch = added.length > 0 && watch ? boxWatchInfo(view, watch) : watch;

  const onAdded = (link: WorkLink) => {
    addedLinks.update(workId, (previous) => [...previous, link]);
    startTransition(() => router.refresh());
  };

  return (
    <>
      {shownWatch ? <WatchSection watch={shownWatch} podcast={podcast} readHref={readHref} /> : null}
      <WorkLinks workId={workId} workKind={workKind} links={view} onAdded={onAdded} />
    </>
  );
}
