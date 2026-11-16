-- 品味資料（Q-42，Dex 10/13 晚）：新用戶三題問卷的前兩題
--   media：媒介複選（movie 電影／series 影集／podcast／live 演出／exhibition 展覽）
--   setting：在家 home／出門 out／都有 both；沒答是 null
-- 第三題「挑 3 部」直接寫進 journal_entries，不存在這裡。
-- 問卷只在行為不足時補權（src/lib/taste/），行為資料一律從既有表現算。
-- 寫入只走 server（service role，src/lib/taste/repository.ts）；登入者只能讀自己的（同 profiles，017）。

create table if not exists taste_profiles (
  user_id text primary key,
  media text[] not null default '{}',
  setting text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taste_profiles_setting_check check (setting is null or setting in ('home', 'out', 'both')),
  constraint taste_profiles_media_check
    check (media <@ array['movie', 'series', 'podcast', 'live', 'exhibition']::text[])
);

alter table taste_profiles enable row level security;

drop policy if exists taste_profiles_self_select on taste_profiles;
create policy taste_profiles_self_select on taste_profiles
  for select to authenticated using (user_id = (select auth.uid())::text);

revoke insert, update, delete on taste_profiles from anon, authenticated;
