"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createAudioUploadAction,
  createUploadedEpisodeAction,
} from "@/app/(app)/episodes/new/upload-actions";
import { compressAudio } from "@/lib/audio/compress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Loader2 } from "lucide-react";

const ACCEPTED_TYPES = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac", "audio/x-m4a"];
const MAX_SIZE = 200 * 1024 * 1024; // 200MB

type Stage = "idle" | "compressing" | "uploading" | "saving" | "done" | "error";

export function UploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!ACCEPTED_TYPES.includes(f.type)) {
      setErrorMsg("請上傳 MP3、WAV、M4A 或 AAC 格式的音訊檔案");
      return;
    }
    if (f.size > MAX_SIZE) {
      setErrorMsg("檔案大小不能超過 200MB");
      return;
    }

    setFile(f);
    setErrorMsg("");
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }, [title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    try {
      // 1. Compress
      setStage("compressing");
      setProgress(0);
      const compressed = await compressAudio(file, setProgress);

      // 2. server 簽發上傳網址（路徑在使用者自己的目錄），瀏覽器直接 PUT 檔案到 storage
      setStage("uploading");
      setProgress(0);
      const target = await createAudioUploadAction(compressed.name);
      if ("error" in target) throw new Error(target.error);

      const uploadResponse = await fetch(target.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": compressed.type || "application/octet-stream" },
        body: compressed,
      });
      if (!uploadResponse.ok) {
        throw new Error(`上傳失敗（HTTP ${uploadResponse.status}）`);
      }

      // 3. server 驗證路徑與檔案後建集數
      setStage("saving");
      const created = await createUploadedEpisodeAction(title, target.path);
      if ("error" in created) throw new Error(created.error);

      setStage("done");
      router.push(`/episodes/${created.episodeId}`);
    } catch (err) {
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "上傳失敗");
    }
  };

  const stageLabel: Record<Stage, string> = {
    idle: "",
    compressing: `壓縮中... ${progress}%`,
    uploading: "上傳中...",
    saving: "儲存中...",
    done: "完成！",
    error: errorMsg,
  };

  const isProcessing = !["idle", "done", "error"].includes(stage);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">集數標題</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="輸入集數標題"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">音訊檔案</label>
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          {file ? (
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div>
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">MP3 / WAV / M4A / AAC，最大 200MB</p>
            </div>
          )}
          <input
            type="file"
            accept=".mp3,.wav,.m4a,.aac"
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            style={{ position: "relative" }}
          />
        </div>
      </div>

      {(stage !== "idle" || errorMsg) && (
        <p className={`text-sm ${stage === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {stageLabel[stage]}
        </p>
      )}

      <Button type="submit" disabled={!file || !title.trim() || isProcessing} className="w-full">
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            處理中
          </>
        ) : (
          "上傳並開始轉錄"
        )}
      </Button>
    </form>
  );
}
