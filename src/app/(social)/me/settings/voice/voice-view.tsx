"use client";

/** 我的語氣（Q-75、Q-79～Q-81）：貼 3～10 篇自己寫的貼文；說過的原話自動累積。只有本人看得到、不進配對。 */

import { useState, useTransition } from "react";
import { MAX_PASTED_SAMPLES, MIN_SAMPLE_CHARS, SUGGESTED_MIN_SAMPLES, type VoiceSample } from "@/lib/voice/samples";
import { addVoiceSampleAction, deleteVoiceSampleAction } from "./actions";

export function VoiceView({ pasted, spokenCount }: { pasted: VoiceSample[]; spokenCount: number }) {
  const [samples, setSamples] = useState(pasted);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const full = samples.length >= MAX_PASTED_SAMPLES;

  const add = () =>
    startTransition(async () => {
      setError("");
      const result = await addVoiceSampleAction(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSamples((current) => [result.sample, ...current]);
      setDraft("");
    });

  const remove = (id: string) =>
    startTransition(async () => {
      setError("");
      const result = await deleteVoiceSampleAction(id);
      if (result.ok) setSamples((current) => current.filter((sample) => sample.id !== id));
      else setError(result.error);
    });

  return (
    <div className="mt-6 flex flex-col gap-6">
      <p className="m-0 text-note leading-[1.8] text-ink-700">
        貼幾篇你自己寫過的貼文（Threads、IG、部落格都行），整理 Threads 時會照你的句子長短、斷句和用詞來寫。
        建議 {SUGGESTED_MIN_SAMPLES}～{MAX_PASTED_SAMPLES} 篇。只有你看得到，不會拿去配對，也不會拿去學別人的語氣。
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="voice-draft" className="text-caption text-ink-600">
          貼一篇（至少 {MIN_SAMPLE_CHARS} 字）
        </label>
        <textarea
          id="voice-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={6}
          disabled={full}
          className="w-full rounded-[10px] border border-ink-200 bg-paper p-3 text-[15px] leading-[1.7] text-ink-950"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || full || !draft.trim()}
          className="min-h-11 self-start rounded-full bg-ink-900 px-5 text-caption font-medium text-paper disabled:opacity-50"
        >
          {full ? `已滿 ${MAX_PASTED_SAMPLES} 篇` : pending ? "存進去…" : "加進我的語氣"}
        </button>
        {error ? (
          <p role="alert" className="m-0 text-caption text-ember-deep">
            {error}
          </p>
        ) : null}
      </div>

      <section className="flex flex-col gap-2" aria-label="已貼的">
        <h2 className="m-0 text-caption font-bold text-ink-950">
          已貼 {samples.length} 篇{spokenCount ? `・另有 ${spokenCount} 段你說過的話` : ""}
        </h2>
        {samples.length === 0 ? <p className="m-0 text-caption text-ink-600">還沒貼。現在整理 Threads 用的是散場誌的通用語氣。</p> : null}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {samples.map((sample) => (
            <li key={sample.id} className="flex items-start gap-3 rounded-[10px] border border-ink-200 bg-paper p-3">
              <p className="m-0 line-clamp-4 flex-1 text-[14px] leading-[1.7] whitespace-pre-wrap text-ink-800">{sample.body}</p>
              <button
                type="button"
                onClick={() => remove(sample.id)}
                disabled={pending}
                aria-label="刪掉這篇"
                className="min-h-11 flex-none px-2 text-caption text-ink-600 underline"
              >
                刪掉
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
