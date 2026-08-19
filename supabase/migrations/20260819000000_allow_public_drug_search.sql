alter table public.drugs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'drugs'
      and policyname = 'Anyone can search drugs'
  ) then
    create policy "Anyone can search drugs"
    on public.drugs
    for select
    to anon, authenticated
    using (true);
  end if;
end $$;