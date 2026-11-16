-- 詞向量配對（Q-48，10/14 Dex 拍板，模型 Voyage voyage-3，1024 維）
-- 1. pgvector（Supabase 慣例裝在 extensions schema）。
-- 2. episode_embeddings：一篇文章一列。只收「以筆名署名＋公開發佈＋有分享網址＋非 RSS」的文章；
--    content_hash＝模型＋送出文字的雜湊，相同就不重算；checked_at＝worker 最後一次核對 hash 的時間（輪流核對用）。
--    RLS 開啟且不給任何 policy：只有 service role 讀寫（配對在 server 端算），anon／authenticated 一律碰不到。
-- 3. 文章改成不公開、匿名、撤回發佈 → trigger 立刻刪該列；文章刪除 → cascade。
-- 4. similar_public_authors()：配對用，回每位其他公開筆名作者「與我最像的那一篇」與 cosine 相似度。
-- 5. embedding_refresh_queue()：worker 補算佇列（沒有 embedding 的優先，其次最久沒核對的）。

create extension if not exists vector with schema extensions;

create table if not exists episode_embeddings (
  episode_id uuid primary key references episodes (id) on delete cascade,
  model text not null,
  dim integer not null check (dim = 1024),
  embedding extensions.vector(1024) not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  checked_at timestamptz not null default now()
);

alter table episode_embeddings enable row level security;
revoke all on table episode_embeddings from anon, authenticated;

create index if not exists episode_embeddings_cosine_idx
  on episode_embeddings using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists episode_embeddings_checked_idx on episode_embeddings (checked_at);

-- 與 src/lib/resonance/public-authors.ts、src/lib/embeddings/eligibility.ts 同一條規則
create or replace function episode_embedding_eligible(e episodes)
returns boolean
language sql
immutable
set search_path = public
as $$
  select e.visibility = 'public'
    and e.byline = 'pen_name'
    and e.published_at is not null
    and e.share_slug is not null
    and e.source is distinct from 'rss';
$$;

create or replace function episode_embeddings_prune_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not episode_embedding_eligible(new) then
    delete from episode_embeddings where episode_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists episode_embeddings_prune on episodes;
create trigger episode_embeddings_prune
  after update of visibility, byline, published_at, share_slug, source on episodes
  for each row execute function episode_embeddings_prune_on_update();

create or replace function similar_public_authors(
  p_user_id text,
  p_min_similarity double precision default 0,
  p_per_episode integer default 50
)
returns table (user_id text, similarity double precision, episode_id uuid, title text)
language sql
stable
set search_path = public, extensions
as $$
  with mine as (
    select ee.embedding
    from episode_embeddings ee
    join episodes e on e.id = ee.episode_id
    where e.user_id = p_user_id and episode_embedding_eligible(e)
  ),
  pairs as (
    select o.user_id, o.episode_id, o.title, o.similarity
    from mine m
    cross join lateral (
      select e2.user_id, e2.id as episode_id, e2.title, 1 - (x.embedding <=> m.embedding) as similarity
      from episode_embeddings x
      join episodes e2 on e2.id = x.episode_id
      where e2.user_id <> p_user_id and episode_embedding_eligible(e2)
      order by x.embedding <=> m.embedding
      limit p_per_episode
    ) o
  )
  select distinct on (pairs.user_id) pairs.user_id, pairs.similarity, pairs.episode_id, pairs.title
  from pairs
  where pairs.similarity >= p_min_similarity
  order by pairs.user_id, pairs.similarity desc;
$$;

create or replace function embedding_refresh_queue(p_limit integer default 50)
returns table (episode_id uuid, title text, work_id uuid, content_hash text, model text)
language sql
stable
set search_path = public
as $$
  select e.id, e.title, e.work_id, ee.content_hash, ee.model
  from episodes e
  left join episode_embeddings ee on ee.episode_id = e.id
  where episode_embedding_eligible(e)
  order by ee.episode_id is not null, ee.checked_at asc nulls first, e.published_at desc
  limit greatest(1, least(p_limit, 500));
$$;

-- 這些函式只給 server（service role）用
revoke execute on function similar_public_authors(text, double precision, integer) from public, anon, authenticated;
revoke execute on function embedding_refresh_queue(integer) from public, anon, authenticated;
revoke execute on function episode_embeddings_prune_on_update() from public, anon, authenticated;
grant execute on function similar_public_authors(text, double precision, integer) to service_role;
grant execute on function embedding_refresh_queue(integer) to service_role;
