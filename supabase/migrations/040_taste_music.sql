-- 品味問卷加「音樂」（10/15 Dex 拍板）：taste_profiles.media 多收 music
--   既有資料不動：舊問卷沒有 music 照常運作；音樂足跡由程式改算 music（見 src/lib/taste/profile.ts），不做資料遷移
-- 冪等可重複執行

alter table taste_profiles
  drop constraint if exists taste_profiles_media_check;

alter table taste_profiles
  add constraint taste_profiles_media_check
    check (media <@ array['movie', 'series', 'podcast', 'music', 'live', 'exhibition']::text[]);
