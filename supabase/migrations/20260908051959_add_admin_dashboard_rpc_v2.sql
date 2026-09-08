create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  result jsonb;
begin
  if caller is null then
    raise exception 'Unauthorized';
  end if;

  select p.role into caller_role from public.profiles p where p.id = caller;
  if caller_role is distinct from 'admin' then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'confirmed_users', (select count(*) from auth.users where email_confirmed_at is not null),
    'new_users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'active_users_7d', (select count(distinct user_id) from public.usage_history where created_at >= now() - interval '7 days'),
    'total_activities', (select count(*) from public.usage_history),
    'activities_7d', (select count(*) from public.usage_history where created_at >= now() - interval '7 days'),
    'total_drug_records', (select count(*) from public.drugs),
    'total_hospitals', (select count(*) from public.hospitals),
    'usage_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('date', d.day::date, 'count', coalesce(x.cnt, 0)) order by d.day)
      from generate_series(current_date - 6, current_date, interval '1 day') d(day)
      left join (
        select created_at::date day, count(*) cnt from public.usage_history
        where created_at >= current_date - 6 group by created_at::date
      ) x on x.day = d.day::date
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to authenticated;