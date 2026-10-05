create table if not exists public.health_tasks (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  task_type text not null check (task_type in ('medicine', 'doctor_appointment', 'health_checkup', 'health_schedule')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  task_date date not null,
  task_time time not null default '09:00',
  repeat_type text not null default 'none' check (repeat_type in ('none', 'daily', 'weekly', 'monthly')),
  repeat_days smallint[] not null default '{}',
  enabled boolean not null default true,
  completed_at timestamptz,
  notification_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.health_tasks enable row level security;

drop policy if exists "Users can select own health tasks" on public.health_tasks;
drop policy if exists "Users can insert own health tasks" on public.health_tasks;
drop policy if exists "Users can update own health tasks" on public.health_tasks;
drop policy if exists "Users can delete own health tasks" on public.health_tasks;

create policy "Users can select own health tasks" on public.health_tasks
  for select using ((auth.uid()) = user_id);
create policy "Users can insert own health tasks" on public.health_tasks
  for insert with check ((auth.uid()) = user_id);
create policy "Users can update own health tasks" on public.health_tasks
  for update using ((auth.uid()) = user_id) with check ((auth.uid()) = user_id);
create policy "Users can delete own health tasks" on public.health_tasks
  for delete using ((auth.uid()) = user_id);

create index if not exists health_tasks_user_date_idx on public.health_tasks (user_id, task_date, task_time);
create index if not exists health_tasks_user_status_idx on public.health_tasks (user_id, status);
create index if not exists health_tasks_user_type_idx on public.health_tasks (user_id, task_type);
create index if not exists health_tasks_series_idx on public.health_tasks (user_id, series_id, task_date);
create unique index if not exists health_tasks_series_occurrence_idx on public.health_tasks (series_id, task_date, task_time);
