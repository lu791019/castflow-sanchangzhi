-- 023 P3 回信：讀者寫給作者的信、作者回覆與刊登、作者封鎖寄信人
--
-- 規則（P3 Token RULE）：
--   * 回信 ≤140 字；每人每篇一封（episode_id, sender_id 唯一）；預設不公開，作者決定刊登。
--   * 作者每封回一次、≤140 字，跟著信走，刊登時一起出現；讀者不能再回。
--   * 不推播：只在「我的 › 來信」看到未讀（read_at is null）。
--   * 被封鎖的寄信人仍可「寄出」（不明示被封鎖），信標記 suppressed，作者看不到。
--
-- 授權模型同 015/017：瀏覽器不直連，一律走 server（service role）＋程式層 userId 過濾。
-- 開 RLS、不建任何 policy，並收回 anon/authenticated 的表權限。
-- 字數用 char_length（以字元計，與前端 Array.from 一致）。

create table if not exists letters (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  -- 收信作者（寄出當下文章的 user_id）；冗餘存一份讓來信列表只靠索引查
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  reply text,
  replied_at timestamptz,
  -- none＝作者還沒決定、published＝刊登在文章末尾、kept＝只放在這裡
  status text not null default 'none',
  published_at timestamptz,
  read_at timestamptz,
  reported_at timestamptz,
  -- 寄出時寄信人已被作者封鎖：作者看不到，寄信人不知道
  suppressed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint letters_one_per_episode unique (episode_id, sender_id),
  constraint letters_not_self check (sender_id <> author_id),
  constraint letters_body_length check (body = btrim(body) and char_length(body) between 1 and 140),
  constraint letters_reply_length check (
    reply is null or (reply = btrim(reply) and char_length(reply) between 1 and 140)
  ),
  constraint letters_status_check check (status in ('none', 'published', 'kept')),
  constraint letters_published_at check ((status = 'published') = (published_at is not null))
);

-- 來信列表（作者、新到舊）與未讀數
create index if not exists idx_letters_author on letters(author_id, created_at desc) where not suppressed;
-- 文章末尾的讀者來函
create index if not exists idx_letters_published on letters(episode_id, published_at)
  where status = 'published' and not suppressed;

create table if not exists letter_blocks (
  author_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (author_id, blocked_id),
  constraint letter_blocks_not_self check (author_id <> blocked_id)
);

alter table letters enable row level security;
alter table letter_blocks enable row level security;
revoke all on letters from anon, authenticated;
revoke all on letter_blocks from anon, authenticated;
