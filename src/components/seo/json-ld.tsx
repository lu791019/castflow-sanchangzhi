/** 結構化資料：<script type="application/ld+json">；內容由純函式組好，這裡只負責序列化（跳脫 </script>） */

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replaceAll("<", "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
