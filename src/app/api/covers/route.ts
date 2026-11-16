import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { uploadCover } from "@/lib/covers/storage";
import { COVER_MAX_BYTES, validateCoverUpload } from "@/lib/covers/upload";
import { badRequest, serverError } from "@/lib/http";
import { limitCoverUpload } from "@/lib/rate-limit/covers";

export const dynamic = "force-dynamic";

/** multipart 外框的餘裕：Content-Length 超過「3MB＋這個數」直接擋，不讀 body */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * 場刊封面上傳：multipart `file`（jpg/png/webp ≤3MB，看檔頭判類型）→ `covers` 桶 → { url }。
 * 只回網址；寫進 works.poster_url 由記一筆場外帶 liveCoverUrl 時決定（只補空的）。
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const limited = limitCoverUpload(auth.userId);
  if (limited) return limited;

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > COVER_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ error: "圖片不可超過 3MB" }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return badRequest("沒有收到圖片");
  }
  if (!(file instanceof File)) return badRequest("沒有收到圖片");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateCoverUpload(bytes, bytes.length);
  if (!checked.ok) return badRequest(checked.error);

  try {
    const url = await uploadCover(auth.userId, bytes, checked.value);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    return serverError("covers:upload", error, "上傳封面失敗，再試一次");
  }
}
