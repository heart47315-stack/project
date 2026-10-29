create extension if not exists vector with schema extensions;

create table if not exists public.medical_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text,
  source text not null,
  source_url text,
  document_hash text,
  content_hash text,
  chunk_index integer not null default 0,
  chunk_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.medical_knowledge enable row level security;

alter table public.medical_knowledge
  add column if not exists document_hash text,
  add column if not exists content_hash text,
  add column if not exists chunk_index integer not null default 0,
  add column if not exists chunk_count integer not null default 1;

create unique index if not exists medical_knowledge_content_hash_key
  on public.medical_knowledge (content_hash)
  where content_hash is not null;

create index if not exists medical_knowledge_embedding_idx
  on public.medical_knowledge using hnsw (embedding extensions.vector_cosine_ops)
  where status = 'approved' and embedding is not null;

create index if not exists medical_knowledge_status_idx
  on public.medical_knowledge (status);

drop policy if exists "Authenticated users can read approved medical knowledge" on public.medical_knowledge;
create policy "Authenticated users can read approved medical knowledge"
  on public.medical_knowledge
  for select to authenticated
  using (status = 'approved' and approved_by is not null and approved_at is not null);

grant select on table public.medical_knowledge to authenticated;

create or replace function public.match_medical_knowledge(
  query_embedding extensions.vector(1536),
  match_threshold real default 0.62,
  match_count integer default 6
)
returns table (
  id uuid,
  title text,
  content text,
  category text,
  source text,
  source_url text,
  metadata jsonb,
  similarity real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    mk.id,
    mk.title,
    mk.content,
    mk.category,
    mk.source,
    mk.source_url,
    mk.metadata,
    (1 - (mk.embedding <=> query_embedding))::real as similarity
  from public.medical_knowledge as mk
  where mk.status = 'approved'
    and mk.approved_by is not null
    and mk.approved_at is not null
    and mk.embedding is not null
    and (1 - (mk.embedding <=> query_embedding)) >= greatest(0, least(coalesce(match_threshold, 0.62), 1))
  order by mk.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 6), 20));
$$;

revoke all on function public.match_medical_knowledge(extensions.vector(1536), real, integer) from public, anon;
grant execute on function public.match_medical_knowledge(extensions.vector(1536), real, integer) to authenticated;
