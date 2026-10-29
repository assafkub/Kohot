-- Kohot: several versions of teams per game day; players see only one of them.
-- A version is simply a game row; versions of a day share group_id and played_on.

-- Publishing a version unpublishes the other versions of the same day.
create or replace function public.publish_game(p_game uuid, p_publish boolean) returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
begin
  select * into g from public.games where id = p_game;
  if g.id is null or not public.is_group_manager(g.group_id) then
    raise exception 'not allowed';
  end if;
  if p_publish then
    update public.games set published_at = null
      where group_id = g.group_id and played_on = g.played_on and id <> g.id and published_at is not null;
  end if;
  update public.games set published_at = case when p_publish then now() end
    where id = g.id
    returning * into g;
  return g;
end;
$$;

-- Same as before, but at most one game per day: the latest published, in case a version was moved to a day
-- that already had a published one.
create or replace function public.published_games(p_group uuid)
returns table (id uuid, played_on date, title text, published_at timestamptz, teams jsonb)
language sql stable security definer set search_path = '' as $$
  select * from (
    select distinct on (g.played_on) g.id, g.played_on, g.title, g.published_at,
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
      ) as teams
    from public.games g
    where g.group_id = p_group
      and g.published_at is not null
      and (public.is_super_admin() or public.is_group_member(p_group))
    order by g.played_on desc, g.published_at desc
  ) latest
  order by played_on desc
  limit 50;
$$;

revoke execute on function public.publish_game(uuid, boolean) from public, anon;
grant execute on function public.publish_game(uuid, boolean) to authenticated;
