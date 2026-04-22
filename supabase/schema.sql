create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  first_name text not null,
  last_name text not null,
  bio text check (char_length(bio) <= 160),
  avatar_url text,
  website text,
  location text,
  posts_count integer not null default 0,
  follower_count integer not null default 0,
  following_count integer not null default 0,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 280),
  image_url text,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 280),
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
before update on public.posts
for each row execute function public.touch_updated_at();

create or replace function public.increment_post_like_count(post_id_input uuid)
returns void language sql security definer set search_path = public as $$
  update public.posts set like_count = like_count + 1 where id = post_id_input;
$$;

create or replace function public.decrement_post_like_count(post_id_input uuid)
returns void language sql security definer set search_path = public as $$
  update public.posts set like_count = greatest(0, like_count - 1) where id = post_id_input;
$$;

create or replace function public.increment_post_comment_count(post_id_input uuid)
returns void language sql security definer set search_path = public as $$
  update public.posts set comment_count = comment_count + 1 where id = post_id_input;
$$;

create or replace function public.decrement_post_comment_count(post_id_input uuid)
returns void language sql security definer set search_path = public as $$
  update public.posts set comment_count = greatest(0, comment_count - 1) where id = post_id_input;
$$;

create or replace function public.sync_post_like_count(post_id_input uuid)
returns void language sql security definer set search_path = public as $$
  update public.posts
  set like_count = (
    select count(*)
    from public.likes
    where post_id = post_id_input
  )
  where id = post_id_input;
$$;

create or replace function public.sync_post_comment_count(post_id_input uuid)
returns void language sql security definer set search_path = public as $$
  update public.posts
  set comment_count = (
    select count(*)
    from public.comments
    where post_id = post_id_input
  )
  where id = post_id_input;
$$;

create or replace function public.delete_post_owned(post_id_input uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  deleted_rows integer := 0;
begin
  delete from public.posts
  where id = post_id_input
    and author_id = auth.uid();

  get diagnostics deleted_rows = row_count;
  return deleted_rows > 0;
end;
$$;

create or replace function public.sync_profile_post_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set posts_count = posts_count + 1 where id = new.author_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set posts_count = greatest(0, posts_count - 1) where id = old.author_id;
  end if;
  return null;
end;
$$;

drop trigger if exists posts_profile_counter on public.posts;
create trigger posts_profile_counter
after insert or delete on public.posts
for each row execute function public.sync_profile_post_count();

create or replace function public.sync_follow_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
    update public.profiles set follower_count = greatest(0, follower_count - 1) where id = old.following_id;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_profile_counter on public.follows;
create trigger follows_profile_counter
after insert or delete on public.follows
for each row execute function public.sync_follow_counts();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

create policy "public profiles read"
on public.profiles for select using (true);

create policy "users manage own profile"
on public.profiles for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "public posts read"
on public.posts for select using (is_active = true);

create policy "users create own posts"
on public.posts for insert with check (auth.uid() = author_id);

create policy "users update own posts"
on public.posts for update using (auth.uid() = author_id);

create policy "users delete own posts"
on public.posts for delete using (auth.uid() = author_id);

create policy "users like posts"
on public.likes for insert with check (auth.uid() = user_id);

create policy "users unlike own likes"
on public.likes for delete using (auth.uid() = user_id);

create policy "public comments read"
on public.comments for select using (true);

create policy "users create comments"
on public.comments for insert with check (auth.uid() = author_id);

create policy "users delete own comments"
on public.comments for delete using (auth.uid() = author_id);

create policy "public follows read"
on public.follows for select using (true);

create policy "users create own follows"
on public.follows for insert with check (auth.uid() = follower_id);

create policy "users delete own follows"
on public.follows for delete using (auth.uid() = follower_id);
