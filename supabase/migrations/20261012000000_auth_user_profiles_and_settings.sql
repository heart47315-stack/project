create or replace function public.medsafeai_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  birth_date text := metadata ->> 'date_of_birth';
  profile_height text := metadata ->> 'height';
  profile_weight text := metadata ->> 'weight';
  parsed_birth_date date;
begin
  if birth_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    begin
      parsed_birth_date := birth_date::date;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        parsed_birth_date := null;
    end;
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    date_of_birth,
    gender,
    height,
    weight,
    blood_type
  )
  values (
    new.id,
    nullif(metadata ->> 'full_name', ''),
    new.email,
    parsed_birth_date,
    nullif(metadata ->> 'gender', ''),
    case
      when profile_height ~ '^[+-]?[0-9]+([.][0-9]+)?$' then profile_height::numeric
      else null
    end,
    case
      when profile_weight ~ '^[+-]?[0-9]+([.][0-9]+)?$' then profile_weight::numeric
      else null
    end,
    nullif(metadata ->> 'blood_type', '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.medsafeai_handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists medsafeai_create_profile_settings_after_signup on auth.users;
create trigger medsafeai_create_profile_settings_after_signup
  after insert on auth.users
  for each row execute function public.medsafeai_handle_new_auth_user();

insert into public.profiles (id, full_name, email)
select
  users.id,
  nullif(users.raw_user_meta_data ->> 'full_name', ''),
  users.email
from auth.users as users
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select users.id
from auth.users as users
on conflict (user_id) do nothing;
