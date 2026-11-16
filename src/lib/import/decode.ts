/**
 * 網頁位元組 → 字串（純函式）：編碼看 Content-Type 的 charset，沒寫再看 <meta charset>／http-equiv，
 * 都沒有或不認得就用 UTF-8。台灣舊部落格常見 Big5，Node 內建的 TextDecoder（full ICU）認得。
 */

const META_SNIFF_BYTES = 2048;

function charsetFromContentType(contentType: string | null): string | null {
  const match = contentType?.match(/charset\s*=\s*["']?([\w.:-]+)/i);
  return match ? match[1] : null;
}

function charsetFromMeta(bytes: Uint8Array): string | null {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, META_SNIFF_BYTES));
  const match = head.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i);
  return match ? match[1] : null;
}

function decoderFor(label: string | null): TextDecoder | null {
  if (!label) return null;
  try {
    return new TextDecoder(label);
  } catch {
    return null;
  }
}

export function decodeHtml(bytes: Uint8Array, contentType: string | null): string {
  const decoder =
    decoderFor(charsetFromContentType(contentType)) ?? decoderFor(charsetFromMeta(bytes)) ?? new TextDecoder("utf-8");
  return decoder.decode(bytes);
}

/** 只收 HTML；伺服器沒給 Content-Type 時放行，交給正文抽取判斷 */
export function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  const type = contentType.split(";")[0].trim().toLowerCase();
  return type === "text/html" || type === "application/xhtml+xml";
}
