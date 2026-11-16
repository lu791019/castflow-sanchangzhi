import { notFound } from "next/navigation";
import { requirePageUserId } from "@/lib/auth/page";
import { loadOwnedStyle } from "@/lib/auth/owned-reads";
import { createAdminClient } from "@/lib/supabase/admin";
import { StyleEditor } from "./style-editor";

export default async function StyleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requirePageUserId(`/styles/${id}`);

  // 不是自己的風格 → 404（不透露是否存在）
  const style = await loadOwnedStyle(createAdminClient(), userId, id);
  if (!style) notFound();

  return <StyleEditor style={style} />;
}
