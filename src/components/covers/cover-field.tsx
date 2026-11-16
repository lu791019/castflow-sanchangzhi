"use client";

/**
 * 記一筆場外的「封面」列：貼圖片網址，或上傳（jpg/png/webp ≤3MB → /api/covers 回 Storage 網址）。
 * 選填；送出時以 liveCoverUrl 帶給 server，場刊沒封面才寫入（第一位填的人為準）。
 */

import { useRef, useState } from "react";
import { FallbackImg } from "@/components/ui/fallback-img";
import { safeImageUrl } from "@/lib/covers/cover";
import { COVER_MAX_BYTES } from "@/lib/covers/upload";

const ACCEPT = "image/jpeg,image/png,image/webp";

interface CoverFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** 送出被退（抓不到這張圖）時收起預覽，不留破圖（UX-25） */
  hidePreview?: boolean;
}

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/covers", { method: "POST", body: form });
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(body.error ?? "上傳失敗，再試一次");
  return body.url;
}

export function CoverField({ value, onChange, hidePreview = false }: CoverFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = hidePreview ? null : safeImageUrl(value);

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > COVER_MAX_BYTES) {
      setError("圖片不可超過 3MB");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadFile(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上傳失敗，再試一次");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-ink-200">
      <div className="flex min-h-11 items-center gap-3">
        <span className="w-7 flex-none text-caption tracking-[0.08em] text-ink-600">封面</span>
        {/* 載入失敗（網址不是圖、被擋）就不顯示預覽 */}
        <FallbackImg src={preview} alt="封面預覽" fallback={null} className="block h-9 w-6 flex-none border border-ink-950 object-cover" />
        <label className="flex min-w-0 flex-1">
          <span className="sr-only">封面圖片網址</span>
          <input
            type="url"
            inputMode="url"
            value={value}
            onChange={(event) => {
              setError(null);
              onChange(event.target.value);
            }}
            maxLength={2000}
            placeholder="貼圖片網址（選填）"
            className="h-[42px] min-w-0 flex-1 bg-transparent text-lede text-ink-950 outline-none placeholder:text-ink-400"
          />
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="hit-44 min-h-8 flex-none rounded-control border border-ink-950 px-2.5 text-caption font-bold text-ink-950 disabled:text-ink-400"
        >
          {busy ? "上傳中…" : "上傳"}
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT} onChange={pick} className="hidden" aria-label="上傳封面圖片" />
      </div>
      {error ? (
        <p role="alert" className="m-0 pb-2 pl-10 text-eyebrow text-ember-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}
