-- 錄音／音檔儲存桶：本地是當初手動建的，新雲端專案（上線用的東京專案）要靠這支 migration 建出來。
-- 目前維持與本地一致的 public=true（播放器與 worker 直接用 public URL 下載）。
-- ⚠️ 上線前待辦：說一段的錄音屬於私人內容，應改為 private + 簽名網址（播放原音、worker 下載、/api/transcribe 都要改），
--    （已由 020_audio_bucket_private.sql 改為 private＋簽名網址）
insert into storage.buckets (id, name, public, file_size_limit)
values ('audio', 'audio', true, 26214400) -- 25MB，與 server action bodySizeLimit 一致
on conflict (id) do nothing;
