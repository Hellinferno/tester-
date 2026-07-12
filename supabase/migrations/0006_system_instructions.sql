-- 0006_system_instructions.sql
-- System instruction profiles (FR-24..FR-32). Mirrors Google AI Studio config.

create table if not exists public.system_instruction_profiles (
  id uuid primary key default gen_random_uuid(),
  title varchar(200) not null,
  instructions text not null,
  temperature numeric(3, 2) not null default 0.7 check (temperature >= 0 and temperature <= 2),
  thinking_mode boolean not null default false,
  thinking_budget integer not null default 0,
  structured_outputs boolean not null default false,
  code_execution boolean not null default false,
  function_calling boolean not null default false,
  grounding_google_search boolean not null default false,
  grounding_google_maps boolean not null default false,
  url_context boolean not null default false,
  applicable_modalities text[],
  applicable_subjects text[],
  applicable_complexity_levels text[],
  is_default boolean not null default false,
  is_active boolean not null default true,
  priority integer not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sip_touch_updated_at
  before update on public.system_instruction_profiles
  for each row execute function public.touch_updated_at();

-- Link analysis_results + routing_decisions to profiles
alter table public.analysis_results
  drop constraint if exists fk_instruction_profile;
alter table public.analysis_results
  add constraint fk_instruction_profile
  foreign key (system_instruction_profile_id) references public.system_instruction_profiles(id) on delete set null;

alter table public.routing_decisions
  drop constraint if exists fk_instruction_profile;
alter table public.routing_decisions
  add constraint fk_instruction_profile
  foreign key (system_instruction_profile_id) references public.system_instruction_profiles(id) on delete set null;

create index if not exists idx_sip_active on public.system_instruction_profiles(is_active) where is_active = true;
create index if not exists idx_sip_default on public.system_instruction_profiles(is_default) where is_default = true;
create index if not exists idx_analysis_instruction_profile on public.analysis_results(system_instruction_profile_id);
