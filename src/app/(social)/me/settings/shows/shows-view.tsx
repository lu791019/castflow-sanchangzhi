"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { subscribeRssAction } from "@/app/(app)/episodes/new/actions";
import type { ShowRow } from "@/lib/me/shows";
import { unsubscribeShowAction } from "../actions";

function ShowPlate({ show }: { show: ShowRow }) {
  if (show.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- 節目封面來自外部 RSS，不經 next/image 最佳化
    return <img src={show.imageUrl} alt="" className="block size-14 object-cover" />;
  }
  return (
    <span aria-hidden="true" className="box-border flex size-14 flex-col justify-between border-t-2 border-b border-ink-950 bg-paper-2 px-[5px] pt-1 pb-[3px]">
      <span className="line-clamp-2 font-serif-tc text-eyebrow leading-[1.15] font-bold text-ink-950">{show.name}</span>
      <span className="self-end font-serif-tc text-lede leading-none font-bold text-ember-dark tabular-nums">{show.no}</span>
    </span>
  );
}

function ShowItem({ show }: { show: ShowRow }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const drop = () =>
    startTransition(async () => {
      const result = await unsubscribeShowAction(show.id);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });

  return (
    <div className="border-b border-ink-200">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-3.5 py-3.5">
        <ShowPlate show={show} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-serif-tc text-prose font-bold text-ink-950">{show.name}</span>
          <span className="text-caption text-ink-600 tabular-nums">最近一集　{show.latest}</span>
          {show.host ? <span className="truncate text-caption text-ink-600">主持　{show.host}</span> : null}
        </span>
        <button type="button" aria-expanded={asking} onClick={() => setAsking(!asking)} className="min-h-11 text-note text-ink-700">
          取消訂閱
        </button>
      </div>
      {asking ? (
        <div role="alert" className="mb-3.5 ml-[70px] border-t border-dashed border-ink-300 pt-2.5">
          <p className="m-0 text-note leading-[1.7] text-ink-900">不再收到《{show.name}》的新集數？說過的感受都會留著。</p>
          {error ? <p className="mt-1 mb-0 text-caption text-ember-deep">{error}</p> : null}
          <div className="mt-1.5 flex items-center gap-5">
            <button type="button" onClick={() => setAsking(false)} className="min-h-9 rounded-[4px] border border-ink-950 px-3.5 text-note font-bold text-ink-950">
              留著
            </button>
            <button type="button" onClick={drop} disabled={pending} className="min-h-11 text-note text-ink-700 underline underline-offset-[3px] disabled:opacity-60">
              確定取消訂閱
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddFeed({ startOpen }: { startOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await subscribeRssAction({ feedUrl: url });
      if (result.error !== undefined) return setMessage({ ok: false, text: result.error });
      setMessage({ ok: true, text: `訂好了《${result.feed.title ?? result.feed.url}》。` });
      setUrl("");
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-[52px] w-full items-center gap-2 border-b border-ink-200 text-lede font-bold text-ember-dark">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        用 RSS 網址訂閱
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="mt-4">
      <label htmlFor="rss" className="text-eyebrow font-bold tracking-[0.2em] text-ink-600">
        用 RSS 網址訂閱
      </label>
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-ink-950">
        <input
          id="rss"
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…/feed.xml"
          className="h-[52px] w-full min-w-0 border-0 bg-transparent p-0 font-serif-tc text-lede text-ink-950 caret-ember outline-none placeholder:text-ink-300"
        />
        <button type="submit" disabled={pending} className="min-h-9 rounded-[4px] border border-ink-950 px-3.5 text-note font-bold text-ink-950 disabled:opacity-60">
          {pending ? "訂閱中…" : "訂閱"}
        </button>
      </div>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={`mt-2 mb-0 text-caption ${message.ok ? "text-ink-800" : "text-ember-deep"}`}>
          {message.text}
        </p>
      ) : null}
      <p className="mt-2 mb-0 text-caption leading-[1.8] text-ink-600">不知道 RSS 在哪？節目官網或主持人的連結頁，通常會寫「RSS」或「訂閱」。</p>
    </form>
  );
}

export function ShowsView({ shows }: { shows: ShowRow[] }) {
  const empty = shows.length === 0;
  return (
    <div className="px-4 pb-[120px]">
      <div className="pt-6">
        <span className="text-caption font-bold tracking-[0.2em] text-ember-dark">RSS 訂閱</span>
        <h2 className="mt-2 mb-0 font-serif-tc text-section font-bold text-ink-950">{empty ? "還沒有訂閱的節目。" : "你在聽的節目"}</h2>
        <p className="mt-1.5 mb-0 text-note leading-[1.8] text-ink-700">
          {empty ? "貼上節目的 RSS 網址，新的一集會自己來找你。" : "新的一集出來會自己進來，打開就能聽、讀逐字稿。"}
        </p>
      </div>
      {empty ? (
        <div aria-hidden="true" className="p2-manuscript relative mt-5 h-[151px] w-full max-w-[331px]">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-300)" strokeWidth="1" strokeLinecap="round" className="absolute top-[45px] left-[136px]">
            <circle cx="6" cy="18" r="1.6" />
            <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
          </svg>
        </div>
      ) : (
        <div className="mt-[18px] border-t border-ink-950">
          {shows.map((show) => (
            <ShowItem key={show.id} show={show} />
          ))}
        </div>
      )}
      <AddFeed startOpen={empty} />
      <p className="mt-[18px] mb-0 text-caption leading-[1.8] text-ink-600">
        Apple Podcasts 找得到的節目，在作品選擇器直接搜尋就好；這裡是給找不到的、或私人的節目。
      </p>
    </div>
  );
}
