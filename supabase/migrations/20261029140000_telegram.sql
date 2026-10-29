-- Kohot: Telegram bot. A manager links a Telegram chat to one group with a one-time code from Settings,
-- then pastes the list of who is coming and gets three balanced splits back.
-- The bot runs on the server with the service role key, so these tables have RLS on and no policies.

create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);
alter table public.telegram_link_codes enable row level security;

create table if not exists public.telegram_links (
  chat_id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  linked_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;

-- A new one-time code for linking Telegram to this group; the manager's earlier codes stop working.
create or replace function public.create_telegram_link_code(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  new_code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
begin
  if not public.is_group_manager(p_group) then
    raise exception 'not allowed';
  end if;
  delete from public.telegram_link_codes where user_id = auth.uid() or expires_at < now();
  insert into public.telegram_link_codes (code, user_id, group_id) values (new_code, auth.uid(), p_group);
  return new_code;
end;
$$;

revoke execute on function public.create_telegram_link_code(uuid) from public, anon;
grant execute on function public.create_telegram_link_code(uuid) to authenticated;
