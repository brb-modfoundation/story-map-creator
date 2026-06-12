-- ============================================================
-- Story Maps — Supabase Schema
-- Run this in your Supabase SQL Editor
-- Project: https://ifwmzmcnozyyavjjyqrn.supabase.co
-- ============================================================

-- Story maps table
create table if not exists story_maps (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  title        text not null,
  slug         text unique not null,
  story_config jsonb not null default '{"chapters":[]}',
  map_config   jsonb not null default '{}',
  published    boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Row Level Security
alter table story_maps enable row level security;

-- Owners can do everything with their own maps
create policy "owners_all"
  on story_maps for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Anyone can read published maps (for the public viewer)
create policy "public_read_published"
  on story_maps for select
  using (published = true);

-- Auto-update updated_at on every update
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger story_maps_updated_at
  before update on story_maps
  for each row execute function update_updated_at();
