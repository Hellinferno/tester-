-- 0008_rls_policies.sql
-- Row-Level Security. Users see only their own rows; service role bypasses RLS.
-- Admins (role = 'admin') see all. Follows rules.md §3 (security).

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- ── Enable RLS everywhere ───────────────────────────────────────────
alter table public.users                         enable row level security;
alter table public.requests                      enable row level security;
alter table public.media_files                   enable row level security;
alter table public.ocr_results                   enable row level security;
alter table public.stt_results                   enable row level security;
alter table public.analysis_results              enable row level security;
alter table public.routing_decisions             enable row level security;
alter table public.responses                     enable row level security;
alter table public.system_instruction_profiles   enable row level security;
alter table public.model_configs                 enable row level security;
alter table public.ocr_test_results              enable row level security;
alter table public.stt_test_results              enable row level security;
alter table public.model_performance_logs        enable row level security;

-- ── users: self read, self update (limited), admin all ──────────────
create policy "users_select_self_or_admin"
  on public.users for select
  using (id = auth.uid() or public.is_admin());

create policy "users_update_self"
  on public.users for update
  using (id = auth.uid());

-- ── Generic "owner or admin" policy for request-scoped tables ───────
-- requests / media_files / ocr_results / stt_results / analysis_results /
-- routing_decisions / responses / ocr_test_results / stt_test_results /
-- model_performance_logs

create policy "requests_owner_select"
  on public.requests for select
  using (user_id = auth.uid() or public.is_admin());

create policy "requests_owner_insert"
  on public.requests for insert
  with check (user_id = auth.uid());

create policy "requests_owner_update"
  on public.requests for update
  using (user_id = auth.uid() or public.is_admin());

create policy "media_owner_select"
  on public.media_files for select
  using (user_id = auth.uid() or public.is_admin());

create policy "media_owner_insert"
  on public.media_files for insert
  with check (user_id = auth.uid());

create policy "ocr_owner_select"
  on public.ocr_results for select
  using (
    request_id in (select id from public.requests where user_id = auth.uid())
    or public.is_admin()
  );

create policy "ocr_service_insert"
  on public.ocr_results for insert
  with check (true); -- inserts happen via service role (bypasses RLS)

create policy "stt_owner_select"
  on public.stt_results for select
  using (
    request_id in (select id from public.requests where user_id = auth.uid())
    or public.is_admin()
  );

create policy "stt_service_insert"
  on public.stt_results for insert
  with check (true);

create policy "analysis_owner_select"
  on public.analysis_results for select
  using (
    request_id in (select id from public.requests where user_id = auth.uid())
    or public.is_admin()
  );

create policy "analysis_service_insert"
  on public.analysis_results for insert
  with check (true);

create policy "routing_owner_select"
  on public.routing_decisions for select
  using (
    request_id in (select id from public.requests where user_id = auth.uid())
    or public.is_admin()
  );

create policy "routing_service_insert"
  on public.routing_decisions for insert
  with check (true);

create policy "responses_owner_select"
  on public.responses for select
  using (
    request_id in (select id from public.requests where user_id = auth.uid())
    or public.is_admin()
  );

create policy "responses_service_insert"
  on public.responses for insert
  with check (true);

-- ── Catalog tables: world-readable, admin-writable ──────────────────
create policy "model_configs_world_read"
  on public.model_configs for select
  using (is_active or public.is_admin());

create policy "model_configs_admin_write"
  on public.model_configs for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "sip_world_read"
  on public.system_instruction_profiles for select
  using (is_active or public.is_admin());

create policy "sip_owner_or_admin_write"
  on public.system_instruction_profiles for all
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

-- ── Test results: owner-scoped ──────────────────────────────────────
create policy "ocr_test_owner_select"
  on public.ocr_test_results for select
  using (
    image_id in (
      select mf.id from public.media_files mf
      join public.requests r on mf.request_id = r.id
      where r.user_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "ocr_test_owner_insert"
  on public.ocr_test_results for insert
  with check (true);

create policy "stt_test_owner_select"
  on public.stt_test_results for select
  using (
    audio_id in (
      select mf.id from public.media_files mf
      join public.requests r on mf.request_id = r.id
      where r.user_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "stt_test_owner_insert"
  on public.stt_test_results for insert
  with check (true);

create policy "perf_log_admin_select"
  on public.model_performance_logs for select
  using (public.is_admin());

create policy "perf_log_service_insert"
  on public.model_performance_logs for insert
  with check (true);
