-- 錄音／音檔儲存桶改為 private：說一段的錄音是私人內容，拿到公開網址就能聽不行。
-- episodes.audio_url 仍存公開網址格式當識別，讀取端（校樣頁播放、/api/transcribe、本機 worker）
-- 一律以 service role 換短效簽名網址（src/lib/audio/signed-url.ts）；上傳本來就走簽名上傳網址，不受影響。
update storage.buckets set public = false where id = 'audio';
