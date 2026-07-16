-- ============================================================
-- CRICKET BUTTERFLY EFFECT — Supabase setup
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor
-- Then set on Vercel (Settings → Environment Variables):
--   SUPABASE_URL      = https://<your-project-ref>.supabase.co
--   SUPABASE_ANON_KEY = your anon/publishable key (Settings → API)
-- ============================================================

create table if not exists public.cricket_votes (
  moment_id text primary key,
  agree integer not null default 0,
  disagree integer not null default 0
);

create table if not exists public.cricket_stories (
  id text primary key,
  data jsonb not null,
  created timestamptz not null default now()
);

alter table public.cricket_votes enable row level security;
alter table public.cricket_stories enable row level security;

-- Public can READ; all writes go through the guarded functions below
create policy "cricket_votes_read" on public.cricket_votes
  for select to anon using (true);
create policy "cricket_stories_read" on public.cricket_stories
  for select to anon using (true);

create or replace function public.cricket_cast_vote(p_moment_id text, p_vote text)
returns table(agree integer, disagree integer)
language plpgsql security definer set search_path = public as $$
begin
  if p_vote not in ('agree','disagree') then raise exception 'invalid vote'; end if;
  if p_moment_id is null or length(p_moment_id) < 1 or length(p_moment_id) > 80 then
    raise exception 'invalid moment id';
  end if;
  return query
  insert into public.cricket_votes as v (moment_id, agree, disagree)
  values (
    p_moment_id,
    case when p_vote = 'agree' then 1 else 0 end,
    case when p_vote = 'disagree' then 1 else 0 end
  )
  on conflict (moment_id) do update set
    agree    = v.agree    + case when p_vote = 'agree' then 1 else 0 end,
    disagree = v.disagree + case when p_vote = 'disagree' then 1 else 0 end
  returning v.agree, v.disagree;
end $$;

create or replace function public.cricket_save_story(p_id text, p_data jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_id is null or length(p_id) < 4 or length(p_id) > 40 then
    raise exception 'invalid story id';
  end if;
  if pg_column_size(p_data) > 20000 then
    raise exception 'story too large';
  end if;
  insert into public.cricket_stories (id, data) values (p_id, p_data)
  on conflict (id) do nothing;
end $$;

grant execute on function public.cricket_cast_vote(text, text) to anon;
grant execute on function public.cricket_save_story(text, jsonb) to anon;
