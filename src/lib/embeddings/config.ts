/** 詞向量設定：VOYAGE_API_KEY（Dex 申請中；沒有時整條路徑降級為只用共同作品配對） */

export function readVoyageKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.VOYAGE_API_KEY?.trim();
  return value ? value : null;
}

/** 同一個 process 只通知一次（每篇文章、每輪 worker 都會走到，不能洗版） */
export function createOnceWarner(warn: () => void): () => void {
  let warned = false;
  return () => {
    if (warned) return;
    warned = true;
    warn();
  };
}
