-- Kohot: the name of the manager who made each version, shown in history.
-- Taken from the Google name in the sign-in token; games.created_by already holds the user id.
alter table public.games add column if not exists created_by_name text
  default coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email');

-- Existing games: the name of the user who saved them, where known.
update public.games g
  set created_by_name = coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email)
  from auth.users u
  where u.id = g.created_by and g.created_by_name is null;
