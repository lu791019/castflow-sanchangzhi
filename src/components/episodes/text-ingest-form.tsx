"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ingestTextAction } from "@/app/(app)/episodes/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";

export function TextIngestForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim() || submitting) return;

    setSubmitting(true);
    setErrorMsg("");

    const result = await ingestTextAction({ title, text });

    if (result.error) {
      setErrorMsg(result.error);
      setSubmitting(false);
      // 生成失敗但 episode 已建立 → 導去集數頁，可從既有按鈕重試生成
      if (result.episodeId) {
        router.push(`/episodes/${result.episodeId}`);
      }
      return;
    }

    router.push(`/episodes/${result.episodeId}/edit`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">標題</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="輸入標題"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">文字內容</label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="貼上逐字稿或文章全文，直接生成 6 平台文案（不經轉錄）"
          rows={12}
          required
        />
      </div>

      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

      <Button
        type="submit"
        disabled={!title.trim() || !text.trim() || submitting}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            生成中，請稍候...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            生成 6 平台文案
          </>
        )}
      </Button>
    </form>
  );
}
