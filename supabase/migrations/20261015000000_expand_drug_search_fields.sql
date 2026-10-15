alter table public.drugs
  add column if not exists generic_name text,
  add column if not exists drug_category text,
  add column if not exists name_th text,
  add column if not exists name_en text,
  add column if not exists brand_name text,
  add column if not exists aliases_th text;

grant select on table public.drugs to anon, authenticated;
