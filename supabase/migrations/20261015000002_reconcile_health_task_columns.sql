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

notify pgrst, 'reload schema';
