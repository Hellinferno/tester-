-- 0007_testing_metrics.sql
-- OCR/STT test results + model performance logs (test reports from testing.md).

create table if not exists public.ocr_test_results (
  id uuid primary key default gen_random_uuid(),
  test_name varchar(200),
  image_id uuid references public.media_files(id) on delete set null,
  ground_truth text,
  extracted_text text,
  character_accuracy numeric(5, 4),
  word_accuracy numeric(5, 4),
  wer numeric(5, 4),
  cer numeric(5, 4),
  engine_used varchar(50),
  language varchar(10),
  image_type varchar(20) check (image_type in ('printed', 'handwritten', 'screenshot')),
  noise_level varchar(20) check (noise_level in ('clean', 'moderate', 'heavy')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.stt_test_results (
  id uuid primary key default gen_random_uuid(),
  test_name varchar(200),
  audio_id uuid references public.media_files(id) on delete set null,
  ground_truth text,
  transcript text,
  wer numeric(5, 4),
  mer numeric(5, 4),
  wil numeric(5, 4),
  engine_used varchar(50),
  language varchar(10),
  audio_type varchar(20) check (audio_type in ('clean', 'noisy', 'accented')),
  duration_seconds numeric(10, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.model_performance_logs (
  id uuid primary key default gen_random_uuid(),
  model_id varchar(100),
  request_id uuid references public.requests(id) on delete set null,
  analysis_id uuid references public.analysis_results(id) on delete set null,
  complexity_level varchar(20),
  subject varchar(100),
  modality varchar(30),
  latency_ms integer,
  cost_usd numeric(10, 6),
  tokens_input integer,
  tokens_output integer,
  user_rating integer check (user_rating between 1 and 5),
  was_correct_routing boolean,
  created_at timestamptz not null default now()
);

create index if not exists idx_ocr_test_engine on public.ocr_test_results(engine_used);
create index if not exists idx_ocr_test_image_type on public.ocr_test_results(image_type);
create index if not exists idx_ocr_test_created_at on public.ocr_test_results(created_at desc);

create index if not exists idx_stt_test_engine on public.stt_test_results(engine_used);
create index if not exists idx_stt_test_audio_type on public.stt_test_results(audio_type);
create index if not exists idx_stt_test_created_at on public.stt_test_results(created_at desc);

create index if not exists idx_performance_model on public.model_performance_logs(model_id);
create index if not exists idx_performance_created_at on public.model_performance_logs(created_at desc);
