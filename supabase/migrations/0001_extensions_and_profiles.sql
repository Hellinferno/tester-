-- 0001_extensions_and_profiles.sql
-- Extensions + link Supabase Auth users to our app's `users` table.
-- Note: Supabase manages identities in `auth.users`; our `public.users` table holds
-- app-specific profile data (role, tier, api_key, rate limits) keyed to auth.uid().

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
-- pgvector for semantic query matching (replaces Pinecone in the spec)
create extension if not exists "vector";

-- App-level user profile, 1:1 with auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) unique not null,
  display_name varchar(100),
  role varchar(20) not null default 'user' check (role in ('user', 'admin', 'developer')),
  tier varchar(20) not null default 'free' check (tier in ('free', 'pro', 'enterprise')),
  api_key varchar(64) unique,
  api_secret_hash varchar(255),
  rate_limit_per_minute integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_api_key on public.users(api_key);

-- Auto-create a profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at auto-maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();
