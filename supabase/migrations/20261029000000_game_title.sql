-- Editable game name, e.g. "כדורגל חמישי - 29.10". Null means "use the default name for the date".
alter table public.games add column if not exists title text check (char_length(title) <= 60);
