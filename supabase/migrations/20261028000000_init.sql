-- Kohot: groups of friends, their players, and saved games.
-- Every table is protected by RLS: a user sees only the groups they belong to.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  rating numeric(2, 1) not null default 4
    check (rating between 1 and 7 and rating * 2 = floor(rating * 2)),
  positions text[] not null default '{}'
    check (positions <@ array['GK', 'CB', 'FB', 'MID', 'FWD']::text[]),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index players_group_name_idx on public.players (group_id, lower(trim(name)));

create table public.games (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  played_on date not null default current_date,
  teams jsonb not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index games_group_idx on public.games (group_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger players_touch before update on public.players
  for each row execute function public.touch_updated_at();

-- Membership check used by the policies. SECURITY DEFINER avoids recursive RLS on group_members.
create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;

create policy "members read group" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "members rename group" on public.groups
  for update to authenticated using (public.is_group_member(id)) with check (public.is_group_member(id));

create policy "members see members" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "leave group" on public.group_members
  for delete to authenticated using (user_id = auth.uid());

create policy "members manage players" on public.players
  for all to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

create policy "members manage games" on public.games
  for all to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

-- Groups are created and joined only through these functions.
create or replace function public.create_group(p_name text) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.groups (name, created_by) values (trim(p_name), auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id, role) values (g.id, auth.uid(), 'owner');
  return g;
end;
$$;

create or replace function public.join_group(p_code text) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into g from public.groups where invite_code = upper(trim(p_code));
  if g.id is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid())
    on conflict do nothing;
  return g;
end;
$$;

revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
