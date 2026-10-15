alter table public.health_tasks
  add column if not exists series_id uuid,
  add column if not exists deleted_at timestamptz;

update public.health_tasks
set series_id = gen_random_uuid()
where series_id is null;

alter table public.health_tasks
  alter column series_id set default gen_random_uuid(),
  alter column series_id drop not null;

with duplicate_occurrences as (
  select
    id,
    row_number() over (
      partition by series_id, task_date, task_time
      order by id
    ) as occurrence_number
  from public.health_tasks
)
update public.health_tasks as tasks
set series_id = gen_random_uuid()
from duplicate_occurrences
where tasks.id = duplicate_occurrences.id
  and duplicate_occurrences.occurrence_number > 1;

create index if not exists health_tasks_series_idx
  on public.health_tasks (user_id, series_id, task_date);

create unique index if not exists health_tasks_series_occurrence_idx
  on public.health_tasks (series_id, task_date, task_time);

create table if not exists public.health_task_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.health_tasks(id) on delete set null,
  event_type text not null check (event_type in ('created', 'updated', 'status_changed', 'deleted')),
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.health_task_history enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('health_tasks', 'health_task_history')
  loop
    execute format('drop policy %I on public.%I', existing_policy.policyname, existing_policy.tablename);
  end loop;
end;
$$;

create policy "Users can read own health task history"
  on public.health_task_history
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can select own health tasks"
  on public.health_tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own health tasks"
  on public.health_tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id and deleted_at is null);

create policy "Users can update own health tasks"
  on public.health_tasks
  for update
  to authenticated
  using (auth.uid() = user_id and deleted_at is null)
  with check (auth.uid() = user_id);

revoke all on table public.health_tasks from public, anon, authenticated;
grant select, insert, update on table public.health_tasks to authenticated;

revoke all on table public.health_task_history from public, anon, authenticated;
grant select on table public.health_task_history to authenticated;

create index if not exists health_task_history_user_occurred_idx
  on public.health_task_history (user_id, occurred_at desc);

create index if not exists health_task_history_task_idx
  on public.health_task_history (task_id, occurred_at desc);

insert into public.health_task_history (user_id, task_id, event_type, after_data, occurred_at)
select tasks.user_id, tasks.id, 'created', to_jsonb(tasks), tasks.created_at
from public.health_tasks as tasks
where not exists (
  select 1
  from public.health_task_history as history
  where history.task_id = tasks.id
    and history.event_type = 'created'
);

create or replace function public.medsafeai_audit_health_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_snapshot jsonb;
  after_snapshot jsonb;
  event_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.health_task_history (user_id, task_id, event_type, after_data)
    values (new.user_id, new.id, 'created', to_jsonb(new));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - array['updated_at', 'notification_id'])
      is not distinct from
      (to_jsonb(old) - array['updated_at', 'notification_id']) then
      return new;
    end if;

    before_snapshot := to_jsonb(old);
    after_snapshot := to_jsonb(new);

    if old.deleted_at is null and new.deleted_at is not null then
      event_name := 'deleted';
    elsif old.status is distinct from new.status then
      event_name := 'status_changed';
    else
      event_name := 'updated';
    end if;

    insert into public.health_task_history (user_id, task_id, event_type, before_data, after_data)
    values (new.user_id, new.id, event_name, before_snapshot, after_snapshot);
    return new;
  end if;

  insert into public.health_task_history (user_id, task_id, event_type, before_data)
  values (old.user_id, old.id, 'deleted', to_jsonb(old));
  return old;
end;
$$;

revoke all on function public.medsafeai_audit_health_task() from public, anon, authenticated;

drop trigger if exists medsafeai_health_task_audit on public.health_tasks;
create trigger medsafeai_health_task_audit
  after insert or update or delete on public.health_tasks
  for each row execute function public.medsafeai_audit_health_task();
