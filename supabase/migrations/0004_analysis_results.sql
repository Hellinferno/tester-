-- 0004_analysis_results.sql
-- SLM analysis output (FR-14..FR-18).

create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  complexity_level varchar(20) check (complexity_level in ('low', 'medium', 'high', 'critical')),
  complexity_score numeric(5, 4),
  complexity_reasoning text,
  reasoning_type varchar(50) check (reasoning_type in (
    'factual', 'analytical', 'creative', 'multi_step', 'comparative', 'synthetic'
  )),
  estimated_steps integer,
  requires_chain_of_thought boolean not null default false,
  primary_subject varchar(100),
  subject_confidence numeric(5, 4),
  subject_subcategories text[],
  domain_tags text[],
  primary_intent varchar(100),
  secondary_intents text[],
  entities jsonb,
  query_reformulation text,
  output_format varchar(20) check (output_format in ('text', 'json', 'markdown', 'code', 'image')),
  estimated_length varchar(20) check (estimated_length in ('short', 'medium', 'long')),
  special_requirements text[],
  system_instruction_profile_id uuid,
  analysis_time_ms integer,
  raw_analysis jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analysis_request_id on public.analysis_results(request_id);
create index if not exists idx_analysis_complexity on public.analysis_results(complexity_level);
create index if not exists idx_analysis_subject on public.analysis_results(primary_subject);
create index if not exists idx_analysis_entities on public.analysis_results using gin (entities);
create index if not exists idx_analysis_raw on public.analysis_results using gin (raw_analysis);
