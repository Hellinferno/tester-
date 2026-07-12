-- Seed data: default model catalog + system instruction profiles.
-- Re-runnable (idempotent on model_id / title).

-- ── Model catalog (FR-19..FR-23, routing matrix from 08-computation-engine-spec.md §5.3) ──
insert into public.model_configs
  (model_id, provider, display_name, description, capabilities, max_tokens, context_window,
   cost_per_1k_input, cost_per_1k_output, average_latency_ms, is_active, is_fallback, priority)
values
  ('anthropic/claude-3.5-sonnet', 'openrouter', 'Claude 3.5 Sonnet',
   'Top-tier reasoning, code and vision. Used for high-complexity queries.',
   array['vision', 'code', 'reasoning', 'multilingual'], 8192, 200000,
   0.003, 0.015, 2500, true, false, 90),
  ('openai/gpt-4o', 'openrouter', 'GPT-4o',
   'Strong multimodal generalist with vision.',
   array['vision', 'code', 'reasoning', 'multilingual'], 16384, 128000,
   0.005, 0.015, 2200, true, true, 85),
  ('openai/gpt-4o-mini', 'openrouter', 'GPT-4o mini',
   'Fast, cheap general-purpose model. Good default for medium complexity.',
   array['vision', 'code', 'reasoning', 'multilingual'], 16384, 128000,
   0.000150, 0.000600, 900, true, false, 60),
  ('google/gemini-flash-1.5', 'openrouter', 'Gemini 1.5 Flash',
   'Very fast and cheap. Best for low-complexity factual queries.',
   array['vision', 'code', 'reasoning', 'multilingual'], 8192, 1000000,
   0.0000375, 0.000150, 700, true, false, 40),
  ('google/gemini-pro-1.5', 'openrouter', 'Gemini 1.5 Pro',
   'Large context window, strong multimodal reasoning.',
   array['vision', 'code', 'reasoning', 'multilingual'], 8192, 2000000,
   0.001250, 0.005, 2000, true, false, 70),
  ('meta-llama/llama-3.1-8b-instruct', 'openrouter', 'Llama 3.1 8B Instruct',
   'Open fast model; also the default analysis SLM.',
   array['code', 'reasoning', 'multilingual'], 4096, 128000,
   0.000018, 0.000018, 500, true, false, 30),
  ('openai/o1-mini', 'openrouter', 'o1-mini',
   'Deep reasoning for critical / multi-step problems.',
   array['reasoning', 'code'], 65536, 128000,
   0.003, 0.012, 8000, true, false, 80)
on conflict (model_id) do update set
  display_name = excluded.display_name,
  capabilities = excluded.capabilities,
  cost_per_1k_input = excluded.cost_per_1k_input,
  cost_per_1k_output = excluded.cost_per_1k_output,
  updated_at = now();

-- ── System instruction profiles (FR-24..FR-32) ──
insert into public.system_instruction_profiles
  (title, instructions, temperature, thinking_mode, thinking_budget, structured_outputs,
   code_execution, function_calling, grounding_google_search, grounding_google_maps,
   url_context, applicable_modalities, applicable_subjects, applicable_complexity_levels,
   is_default, is_active, priority)
values
  (
    'Default Assistant',
    'You are a helpful, accurate assistant. Answer concisely and cite sources when relevant.',
    0.7, false, 0, false, false, false, false, false, false,
    array['image_text','image_voice','image_only','voice_only','text_only'],
    array['general_knowledge'],
    array['low','medium'],
    true, true, 10
  ),
  (
    'Technical Analysis',
    'You are a technical analyst. Provide detailed, structured explanations with code examples when relevant. Be precise and cite sources.',
    0.3, true, 4000, true, true, false, true, false, true,
    array['image_text','text_only'],
    array['computer_science','mathematics','engineering','data_science'],
    array['medium','high','critical'],
    false, true, 50
  ),
  (
    'Creative Writing',
    'You are a creative writing assistant. Be imaginative, varied, and expressive.',
    1.2, false, 0, false, false, false, false, false, false,
    array['text_only','voice_only'],
    array['literature','creative_writing','art'],
    array['low','medium'],
    false, true, 30
  ),
  (
    'Code Expert',
    'You are an expert software engineer. Produce correct, idiomatic, well-tested code. Explain trade-offs. Prefer minimal diffs.',
    0.2, true, 6000, true, true, true, false, false, true,
    array['image_text','text_only'],
    array['computer_science','coding'],
    array['high','critical'],
    false, true, 60
  )
on conflict do nothing;
