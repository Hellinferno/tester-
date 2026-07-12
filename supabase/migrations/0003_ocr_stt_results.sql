-- 0003_ocr_stt_results.sql
-- OCR + STT extraction results (FR-05..FR-13).

create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  media_id uuid references public.media_files(id) on delete cascade,
  extracted_text text,
  confidence_score numeric(5, 4),
  language_detected varchar(10),
  processing_time_ms integer,
  engine_used varchar(50),
  word_count integer,
  bounding_boxes jsonb,
  raw_result jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.stt_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  media_id uuid references public.media_files(id) on delete cascade,
  transcript text,
  confidence_score numeric(5, 4),
  language_detected varchar(10),
  processing_time_ms integer,
  engine_used varchar(50),
  word_count integer,
  words jsonb,
  speaker_labels jsonb,
  raw_result jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ocr_request_id on public.ocr_results(request_id);
create index if not exists idx_ocr_media_id on public.ocr_results(media_id);
create index if not exists idx_ocr_confidence on public.ocr_results(confidence_score);
create index if not exists idx_ocr_bounding_boxes on public.ocr_results using gin (bounding_boxes);
-- full-text search on extracted text
create index if not exists idx_ocr_text_search
  on public.ocr_results using gin (to_tsvector('english', coalesce(extracted_text, '')));

create index if not exists idx_stt_request_id on public.stt_results(request_id);
create index if not exists idx_stt_media_id on public.stt_results(media_id);
create index if not exists idx_stt_confidence on public.stt_results(confidence_score);
create index if not exists idx_stt_transcript_search
  on public.stt_results using gin (to_tsvector('english', coalesce(transcript, '')));
