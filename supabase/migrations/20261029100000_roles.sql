-- Kohot: roles and published games.
--   super admin   – sees and manages every group, the only one who creates groups.
--   manager       – manages one group: players, ratings, games, members, join code.
--   player        – joins with the code and sees only published teams (names and colors, no ratings).
-- Existing members (owner/member) all become managers, so nobody loses access.

-- ---------- Super admins ----------
create table if not exists public.super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.super_admins enable row level security;
-- No policies: the table is read only through is_super_admin().

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;

-- ---------- Member roles ----------
alter table public.group_members drop constraint if exists group_members_role_check;
update public.group_members set role = 'manager' where role in ('owner', 'member');
alter table public.group_members alter column role set default 'player';
alter table public.group_members add constraint group_members_role_check check (role in ('manager', 'player'));

-- Name and email shown in the members list (auth.users is not readable from the app).
alter table public.group_members add column if not exists display_name text;
alter table public.group_members add column if not exists email text;
update public.group_members m
  set display_name = coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
      email = u.email
  from auth.users u
  where u.id = m.user_id and m.email is null;

create or replace function public.is_group_manager(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = auth.uid() and m.role = 'manager'
  );
$$;

-- ---------- Published games ----------
alter table public.games add column if not exists published_at timestamptz;
-- Also in 20261029000000_game_title.sql; repeated here in case that one was not run.
alter table public.games add column if not exists title text check (char_length(title) <= 60);

-- ---------- Policies ----------
drop policy if exists "members read group" on public.groups;
drop policy if exists "members rename group" on public.groups;
drop policy if exists "members see members" on public.group_members;
drop policy if exists "leave group" on public.group_members;
drop policy if exists "members manage players" on public.players;
drop policy if exists "members manage games" on public.games;
-- New names too, so running this file twice is harmless.
drop policy if exists "managers rename group" on public.groups;
drop policy if exists "super admin deletes group" on public.groups;
drop policy if exists "see members" on public.group_members;
drop policy if exists "leave or remove member" on public.group_members;
drop policy if exists "managers manage players" on public.players;
drop policy if exists "managers manage games" on public.games;

create policy "members read group" on public.groups
  for select to authenticated using (public.is_super_admin() or public.is_group_member(id));
create policy "managers rename group" on public.groups
  for update to authenticated using (public.is_group_manager(id)) with check (public.is_group_manager(id));
create policy "super admin deletes group" on public.groups
  for delete to authenticated using (public.is_super_admin());

-- Managers see the whole list; a player sees only their own row.
create policy "see members" on public.group_members
  for select to authenticated using (user_id = auth.uid() or public.is_group_manager(group_id));
-- Anyone can leave; a manager removes players; only the super admin removes managers.
create policy "leave or remove member" on public.group_members
  for delete to authenticated using (
    user_id = auth.uid()
    or public.is_super_admin()
    or (role = 'player' and public.is_group_manager(group_id))
  );
-- Roles change only through set_member_role(), which only the super admin may call.

-- Ratings live in players and in games.teams, so players read neither table directly.
create policy "managers manage players" on public.players
  for all to authenticated
  using (public.is_group_manager(group_id)) with check (public.is_group_manager(group_id));
create policy "managers manage games" on public.games
  for all to authenticated
  using (public.is_group_manager(group_id)) with check (public.is_group_manager(group_id));

-- ---------- Functions ----------
-- The groups this user sees, with their role. The join code is returned only to managers.
create or replace function public.my_groups()
returns table (id uuid, name text, invite_code text, role text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name,
    case when r.role in ('admin', 'manager') then g.invite_code end,
    r.role
  from public.groups g
  cross join lateral (
    select case
      when public.is_super_admin() then 'admin'
      else (select m.role from public.group_members m where m.group_id = g.id and m.user_id = auth.uid())
    end as role
  ) r
  where r.role is not null
  order by g.created_at;
$$;

create or replace function public.whoami() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('super_admin', public.is_super_admin());
$$;

-- Only the super admin creates groups. They see every group anyway, so they are not added as a member.
create or replace function public.create_group(p_name text) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  if not public.is_super_admin() then
    raise exception 'only super admin creates groups';
  end if;
  insert into public.groups (name, created_by) values (trim(p_name), auth.uid()) returning * into g;
  return g;
end;
$$;

-- Joining with the code always makes a player; an existing member keeps their role.
create or replace function public.join_group(p_code text) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
  claims jsonb := auth.jwt();
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into g from public.groups where invite_code = upper(trim(p_code));
  if g.id is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.group_members (group_id, user_id, role, display_name, email)
  values (
    g.id, auth.uid(), 'player',
    coalesce(claims -> 'user_metadata' ->> 'full_name', claims -> 'user_metadata' ->> 'name'),
    claims ->> 'email'
  )
  on conflict (group_id, user_id) do update
    set display_name = coalesce(excluded.display_name, public.group_members.display_name),
        email = coalesce(excluded.email, public.group_members.email);
  return g;
end;
$$;

create or replace function public.set_member_role(p_group uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception 'not allowed';
  end if;
  if p_role not in ('manager', 'player') then
    raise exception 'invalid role';
  end if;
  update public.group_members set role = p_role where group_id = p_group and user_id = p_user;
end;
$$;

-- A new code; the old one stops working.
create or replace function public.rotate_invite_code(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  code text;
begin
  if not public.is_group_manager(p_group) then
    raise exception 'not allowed';
  end if;
  update public.groups
    set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    where id = p_group
    returning invite_code into code;
  return code;
end;
$$;

-- What a player sees: published games, team names, colors and player names only.
create or replace function public.published_games(p_group uuid)
returns table (id uuid, played_on date, title text, published_at timestamptz, teams jsonb)
language sql stable security definer set search_path = '' as $$
  select g.id, g.played_on, g.title, g.published_at,
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'name', t ->> 'name',
          'color', t ->> 'color',
          'players', (
            select coalesce(jsonb_agg(jsonb_build_object('name', p ->> 'name')), '[]'::jsonb)
            from jsonb_array_elements(t -> 'players') p
          )
        ) order by i
      ), '[]'::jsonb)
      from jsonb_array_elements(g.teams) with ordinality as x(t, i)
    )
  from public.games g
  where g.group_id = p_group
    and g.published_at is not null
    and (public.is_super_admin() or public.is_group_member(p_group))
  order by g.played_on desc, g.published_at desc
  limit 50;
$$;

revoke execute on function public.my_groups() from public, anon;
revoke execute on function public.whoami() from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.rotate_invite_code(uuid) from public, anon;
revoke execute on function public.published_games(uuid) from public, anon;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.whoami() to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;
grant execute on function public.published_games(uuid) to authenticated;

-- Make yourself super admin (run once, with your Google email):
-- insert into public.super_admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict do nothing;
