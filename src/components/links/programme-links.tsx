/** 場刊頁的「去哪買票」區（server）：手填售票網址＋依場館類型排的搜尋連結＋缺口補資料 */

import { loadWorkLinks } from "@/lib/links/repository";
import type { WorkKind } from "@/lib/works/format";
import { LiveWorkLinks } from "./live-work-links";

export async function ProgrammeLinks({ workId, workKind }: { workId: string; workKind: WorkKind }) {
  const loaded = await loadWorkLinks(workId);
  if (!loaded) return null;
  return (
    <div className="mt-12">
      <LiveWorkLinks workId={workId} workKind={workKind} links={loaded} />
    </div>
  );
}
