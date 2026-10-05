create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  reminder_type text not null default 'general',
  reminder_date date not null,
  reminder_time time not null,
  repeat_type text not null default 'none',
  repeat_days integer[] not null default '{}',
  enabled boolean not null default true,
  notification_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminders enable row level security;

drop policy if exists "Users can manage own reminders" on public.reminders;
create policy "Users can manage own reminders" on public.reminders
  for all using ((auth.uid()) = user_id) with check ((auth.uid()) = user_id);

create index if not exists reminders_user_date_idx on public.reminders (user_id, reminder_date, reminder_time);
