"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateContentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

interface GenerateViewProps {
  episodeId: string;
  episodeTitle: string;
  transcriptPreview: string;
  hasContent: boolean;
}

/** 文案生成 UI；資料由 server page 依擁有者讀好傳入，瀏覽器不直連 DB */
export function GenerateView({
  episodeId,
  episodeTitle,
  transcriptPreview,
  hasContent,
}: GenerateViewProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setGenerating(true);
    setError("");

    const result = await generateContentAction(episodeId);

    if (result.error) {
      setError(result.error);
      setGenerating(false);
    } else {
      router.push(`/episodes/${episodeId}/edit`);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="CastFlow · AI 文案生成" title={episodeTitle} />

      {transcriptPreview ? (
        <div className="mt-6 border-t-2 border-ink-950 bg-paper-2 p-5">
          <h2 className="mb-2 text-eyebrow font-bold tracking-[0.2em] text-ink-600">
            逐字稿預覽
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-800">
            {transcriptPreview}...
          </p>
        </div>
      ) : (
        <p className="mt-6 text-ink-600">尚無逐字稿，請先完成轉錄。</p>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex gap-3">
        {hasContent && !generating && (
          <Link href={`/episodes/${episodeId}/edit`}>
            <Button variant="outline">
              查看已生成文案
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}

        <Button onClick={handleGenerate} disabled={generating || !transcriptPreview}>
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              生成中（約 30 秒）...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {hasContent ? "重新生成全部文案" : "生成 6 平台文案"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
