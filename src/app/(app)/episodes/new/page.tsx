import { IngestTabs } from "@/components/episodes/ingest-tabs";
import { PageHeader } from "@/components/layout/page-header";

export default function NewEpisodePage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        eyebrow="CastFlow · 集數"
        title="新增集數"
        description="上傳音訊自動轉錄，或直接貼上文字生成文案。"
      />
      <div className="mt-6">
        <IngestTabs />
      </div>
    </div>
  );
}
