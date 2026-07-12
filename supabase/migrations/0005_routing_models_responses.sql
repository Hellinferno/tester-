-- 0005_routing_models_responses.sql
-- Model catalog + routing decisions + responses (FR-19..FR-23).

create table if not exists public.model_configs (
  id uuid primary key default gen_random_uuid(),
  model_id varchar(100) unique not null,
  provider varchar(50) not null,
  display_name varchar(100),
  description text,
  capabilities text[],
  max_tokens integer,
  context_window integer,
  cost_per_1k_input numeric(10, 6),
  cost_per_1k_output numeric(10, 6),
  average_latency_ms integer,
  is_active boolean not null default true,
  is_fallback boolean not null default false,
  priority integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger model_configs_touch_updated_at
  before update on public.model_configs
  for each row execute function public.touch_updated_at();

create table if not exists public.routing_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  analysis_id uuid references public.analysis_results(id) on delete set null,
  selected_model_id varchar(100) not null,
  provider varchar(50) not null,
  confidence numeric(5, 4),
  estimated_cost numeric(10, 6),
  estimated_latency_ms integer,
  actual_cost numeric(10, 6),
  actual_latency_ms integer,
  fallback_used boolean not null default false,
  fallback_chain jsonb,
  routing_reason text,
  system_instruction_profile_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  routing_id uuid references public.routing_decisions(id) on delete set null,
  content text,
  content_type varchar(30) not null default 'text/markdown',
  tokens_used integer,
  tokens_input integer,
  tokens_output integer,
  finish_reason varchar(20),
  generation_time_ms integer,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

alter table public.requests
  drop constraint if exists fk_response;
alter table public.requests
  add constraint fk_response foreign key (response_id) references public.responses(id) on delete set null;

create index if not exists idx_routing_request_id on public.routing_decisions(request_id);
create index if not exists idx_routing_model on public.routing_decisions(selected_model_id);
create index if not exists idx_routing_created_at on public.routing_decisions(created_at desc);
create index if not exists idx_responses_request_id on public.responses(request_id);
create index if not exists idx_model_configs_active on public.model_configs(is_active) where is_active = true;
