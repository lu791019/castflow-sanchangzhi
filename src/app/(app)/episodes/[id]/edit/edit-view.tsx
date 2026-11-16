"use client";

import { useState, useCallback } from "react";
import { Content, Platform } from "@/lib/types";
import { ALL_PLATFORMS } from "@/lib/prompts/generate-content";
import { PlatformTabs } from "@/components/content/platform-tabs";
import { ContentEditor } from "@/components/content/content-editor";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Sparkles } from "lucide-react";

interface EditViewProps {
  episodeId: string;
  episodeTitle: string;
  initialContents: Content[];
}

/** 文案編輯 UI；資料由 server page 依擁有者讀好傳入，瀏覽器不直連 DB */
export function EditView({ episodeId, episodeTitle, initialContents }: EditViewProps) {
  const [contents, setContents] = useState<Content[]>(initialContents);
  const [activePlatform, setActivePlatform] = useState<Platform>("threads");

  const handleUpdate = useCallback((contentId: string, body: string) => {
    setContents((prev) => prev.map((c) => (c.id === contentId ? { ...c, body } : c)));
  }, []);

  const activeContent = contents.find((c) => c.platform === activePlatform);
  const availablePlatforms = contents.map((c) => c.platform as Platform);

  if (contents.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="CastFlow · 內容編輯" title={episodeTitle} />
        <p className="mt-4 text-ink-600">尚未生成文案。</p>
        <Link href={`/episodes/${episodeId}/generate`}>
          <Button className="mt-4">
            <Sparkles className="mr-2 h-4 w-4" />
            前往生成文案
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="CastFlow · 內容編輯"
        title={episodeTitle}
        description={`內容編輯器 — ${contents.length} 個平台`}
        actions={
          <Link href={`/episodes/${episodeId}/generate`}>
            <Button variant="outline" size="sm">
              <Sparkles className="mr-1 h-3 w-3" />
              重新生成全部
            </Button>
          </Link>
        }
      />

      <div className="mt-6">
        <PlatformTabs
          activePlatform={activePlatform}
          onSelect={setActivePlatform}
          platforms={availablePlatforms.length > 0 ? availablePlatforms : ALL_PLATFORMS}
        />

        <div className="mt-4">
          {activeContent ? (
            <ContentEditor
              key={activeContent.id}
              content={activeContent}
              episodeId={episodeId}
              onUpdate={handleUpdate}
            />
          ) : (
            <p className="text-muted-foreground">此平台尚無內容。</p>
          )}
        </div>
      </div>
    </div>
  );
}
