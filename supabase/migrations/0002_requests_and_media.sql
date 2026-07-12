-- 0002_requests_and_media.sql
-- Core request + media-file tables (FR-01..FR-04).

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  user_id uuid references public.users(id) on delete set null,
  modality varchar(30) not null check (modality in (
    'image_text', 'image_voice', 'image_only', 'voice_only', 'text_only'
  )),
  status varchar(20) not null default 'pending' check (status in (
    'pending', 'processing', 'analyzing', 'routing', 'generating', 'completed', 'failed'
  )),
  input_text text,
  input_text_hash varchar(64),
  has_image boolean not null default false,
  has_voice boolean not null default false,
  image_id uuid,
  voice_id uuid,
  estimated_complexity varchar(20),
  selected_model varchar(100),
  response_id uuid,
  latency_ms integer,
  cost_usd numeric(10, 6),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  media_type varchar(10) not null check (media_type in ('image', 'voice')),
  original_filename varchar(255),
  storage_key varchar(500) not null,
  storage_bucket varchar(100) not null,
  file_size_bytes bigint,
  mime_type varchar(50),
  width integer,
  height integer,
  duration_seconds numeric(10, 2),
  sample_rate integer,
  checksum varchar(64),
  created_at timestamptz not null default now()
);

alter table public.requests
  drop constraint if exists fk_image;
alter table public.requests
  add constraint fk_image foreign key (image_id) references public.media_files(id);

alter table public.requests
  drop constraint if exists fk_voice;
alter table public.requests
  add constraint fk_voice foreign key (voice_id) references public.media_files(id);

create index if not exists idx_requests_user_id on public.requests(user_id);
create index if not exists idx_requests_session_id on public.requests(session_id);
create index if not exists idx_requests_status on public.requests(status);
create index if not exists idx_requests_modality on public.requests(modality);
create index if not exists idx_requests_created_at on public.requests(created_at desc);
create index if not exists idx_requests_complexity on public.requests(estimated_complexity);
create index if not exists idx_requests_metadata on public.requests using gin (metadata);

create index if not exists idx_media_request_id on public.media_files(request_id);
create index if not exists idx_media_user_id on public.media_files(user_id);
create index if not exists idx_media_type on public.media_files(media_type);
