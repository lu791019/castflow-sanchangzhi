-- 019：我的 › 設定「預設公開範圍」「發佈時一起寫好社群貼文」（設計稿 P2 設定 A）
-- 存在 profiles（只經 server 以 service role 寫入，017 已收回使用者直接寫入權限）。
-- 新建集數時由 trigger 套用作者的預設值；校樣頁仍可逐篇修改。
-- RSS 訂閱自動進來的集數不是作者說的，不套用。

alter table profiles
  add column if not exists default_visibility text not null default 'public';
alter table profiles drop constraint if exists profiles_default_visibility_check;
alter table profiles
  add constraint profiles_default_visibility_check
  check (default_visibility in ('public', 'unlisted', 'private'));

alter table profiles
  add column if not exists generate_social boolean not null default true;

create or replace function apply_profile_publish_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_profile record;
begin
  if new.source = 'rss' or new.user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;
  select p.default_visibility, p.generate_social into v_profile
  from profiles p
  where p.id = new.user_id::uuid;
  if found then
    new.visibility := v_profile.default_visibility;
    new.generate_social := v_profile.generate_social;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_episodes_profile_publish_defaults on episodes;
create trigger trg_episodes_profile_publish_defaults
  before insert on episodes
  for each row execute function apply_profile_publish_defaults();
