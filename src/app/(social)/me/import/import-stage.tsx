"use client";

/** 匯入頁主體：貼網址（可多篇）→ 排隊一次抓一篇 → 每篇一張確認卡 */

import { useEffect, useRef, useState } from "react";
import { addUrls, MAX_QUEUE, nextQueued, removeItem, updateItem, type QueueItem, type QueueState } from "@/lib/import/queue";
import { requestPreview } from "./client";
import { ImportCard } from "./import-card";

function makeIdFactory(): () => string {
  let seq = 0;
  return () => `import-${Date.now().toString(36)}-${++seq}`;
}

export function ImportStage() {
  const [text, setText] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const makeId = useRef(makeIdFactory());
  // 一次只抓一篇：輪到的那篇就是「讀取中」；ref 記已送出的，StrictMode 重跑 effect 也不重複打 API
  const next = nextQueued(queue);
  const nextId = next?.id ?? null;
  const nextUrl = next?.rawUrl ?? null;
  const started = useRef(new Set<string>());

  useEffect(() => {
    if (!nextId || !nextUrl || started.current.has(nextId)) return;
    started.current.add(nextId);
    void requestPreview(nextUrl).then((state) => setQueue((current) => updateItem(current, nextId, state)));
  }, [nextId, nextUrl]);

  const add = () => {
    if (!text.trim()) return;
    setQueue((current) => addUrls(current, text, makeId.current));
    setText("");
  };

  const setState = (id: string) => (state: QueueState) => setQueue((current) => updateItem(current, id, state));

  return (
    <>
      <form
        aria-label="貼上文章網址"
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-600">文章網址（一行一篇，最多 {MAX_QUEUE} 篇）</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            className="resize-none border border-ink-300 bg-transparent px-3 py-2.5 text-note leading-[1.7] text-ink-950 outline-none placeholder:text-ink-400 focus:border-ink-950"
          />
        </label>
        <button
          type="submit"
          disabled={!text.trim() || queue.length >= MAX_QUEUE}
          className="mt-3 h-11 w-full rounded-[4px] border border-ink-950 text-note font-bold text-ink-950 disabled:opacity-50"
        >
          讀取文章
        </button>
      </form>

      <section aria-label="排隊中的文章" className="mt-8 flex flex-col gap-2">
        {queue.map((item) => (
          <ImportCard
            key={item.id}
            item={item}
            loading={item.id === nextId}
            onState={setState(item.id)}
            onRemove={() => setQueue((current) => removeItem(current, item.id))}
          />
        ))}
      </section>
    </>
  );
}
