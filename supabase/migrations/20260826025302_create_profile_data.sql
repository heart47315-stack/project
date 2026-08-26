create table if not exists public.usage_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  title text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null,
  item_id text not null,
  title text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  language text not null default 'th',
  updated_at timestamptz not null default now()
);

alter table public.usage_history enable row level security;
alter table public.saved_items enable row level security;
alter table public.user_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usage_history' and policyname = 'Users can manage own usage history') then
    create policy "Users can manage own usage history" on public.usage_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_items' and policyname = 'Users can manage own saved items') then
    create policy "Users can manage own saved items" on public.saved_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_settings' and policyname = 'Users can manage own settings') then
    create policy "Users can manage own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;