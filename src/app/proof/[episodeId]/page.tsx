import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { loginRedirectPath } from "@/lib/auth/paths";
import { loadProofData, type ProofData } from "@/lib/proof/load";
import { isListed, nextOrdinal } from "@/lib/proof/publish";
import { toProofDoc } from "@/lib/proof/document";
import { contentFailure } from "@/lib/proof/failure";
import { deriveLede, extractPullQuote } from "@/lib/share/article";
import { taipeiParts, pad2 } from "@/lib/journal/time";
import { ProofGenerating } from "./proof-generating";
import { TranscribeFailed, Transcribing } from "./proof-transcribe";
import { ProofPublished } from "./proof-published";
import { ProofView } from "./proof-view";
import "./proof.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "校樣｜散場誌",
  robots: { index: false },
};

function PublishedState({ data }: { data: ProofData }) {
  const { episode } = data;
  const doc = toProofDoc(data.content?.body ?? "", episode.title);
  const title = doc.title;
  const listedInWork = data.workFeelingCount !== null && isListed(episode.visibility);
  return (
    <ProofPublished
      episodeId={episode.id}
      title={title}
      shareSlug={episode.shareSlug ?? ""}
      visibility={episode.visibility}
      publishedAt={episode.publishedAt ?? episode.createdAt}
      authorOrdinal={nextOrdinal(data.authorPublishedCount)}
      workOrdinal={listedInWork ? nextOrdinal(data.workFeelingCount ?? 0) : null}
      workTitle={data.work?.title ?? null}
      generateSocial={episode.generateSocial}
      pullQuote={episode.pullQuote ?? extractPullQuote(doc.blocks)}
      lede={deriveLede(doc.blocks).lede}
      work={data.work}
    />
  );
}

/** 錯誤／等待態頂部小字：「《海街日記》・10.10 22:14」 */
function stateMeta(data: ProofData): string {
  const parts = taipeiParts(new Date(data.episode.createdAt));
  const when = `${pad2(parts.month)}.${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
  return data.work ? `《${data.work.title}》・${when}` : when;
}

function ProofBody({ data }: { data: ProofData }) {
  const { episode, content, transcript } = data;
  if (episode.publishedAt && episode.shareSlug) return <PublishedState data={data} />;
  const context = {
    meta: `${stateMeta(data)} 說的`,
    transcript: transcript?.text ?? "",
    durationSeconds: transcript?.durationSeconds ?? null,
    typed: episode.source === "text",
  };
  // 正文是模型拒絕訊息（【無法生成】）的舊草稿：不給編輯與發佈，顯示整理失敗（UX-02）
  const failure = content ? contentFailure(content.body, transcript?.text ?? null) : null;
  if (content && failure) {
    return <ProofGenerating key={content.id} episodeId={episode.id} context={context} initialFailure={failure} />;
  }
  if (content) return <ProofView key={content.id} data={data} />;
  if (transcript) return <ProofGenerating episodeId={episode.id} context={context} />;
  if (episode.status === "error") {
    return <TranscribeFailed meta={`${stateMeta(data)} 錄的`} audioUrl={episode.audioUrl} />;
  }
  return <Transcribing meta={stateMeta(data)} audioUrl={episode.audioUrl} createdAt={episode.createdAt} />;
}

export default async function ProofPage({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  // proxy 已擋未登入；不是自己的文章 → 404（不透露存在與否）
  const userId = await getCurrentUserId();
  if (!userId) redirect(loginRedirectPath(`/proof/${episodeId}`, ""));
  const data = await loadProofData(episodeId, userId);
  if (!data) notFound();

  // 桌機只有校樣本體（可編輯狀態）攤成 60／40 雙欄；等待、錯誤、已發佈維持單欄
  const editable = Boolean(data.content) && !(data.episode.publishedAt && data.episode.shareSlug);
  return (
    <div className="min-h-dvh overflow-x-clip bg-paper font-sans-tc text-ink-900">
      <div className={`relative mx-auto w-full max-w-[480px] md:max-w-[664px] ${editable ? "lg:max-w-none" : ""}`}>
        <ProofBody data={data} />
      </div>
    </div>
  );
}
