"use client";

import { useState } from "react";
import { UploadForm } from "@/components/episodes/upload-form";
import { TextIngestForm } from "@/components/episodes/text-ingest-form";
import { RssSubscribeForm } from "@/components/episodes/rss-subscribe-form";
import { cn } from "@/lib/utils";

type Mode = "audio" | "text" | "rss";

const MODES: Array<{ value: Mode; label: string }> = [
  { value: "audio", label: "上傳音訊" },
  { value: "text", label: "貼上文字" },
  { value: "rss", label: "RSS 訂閱" },
];

export function IngestTabs() {
  const [mode, setMode] = useState<Mode>("audio");

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-ink-200">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              mode === m.value
                ? "border-ember text-ember-deep"
                : "border-transparent text-ink-600 hover:text-ink-950",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "audio" && <UploadForm />}
      {mode === "text" && <TextIngestForm />}
      {mode === "rss" && <RssSubscribeForm />}
    </div>
  );
}
