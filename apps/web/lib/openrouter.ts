// Direct browser client for OpenRouter (BYOK). All AI work — chat, OCR (vision),
// STT (audio), analysis — is a chat-completions call; modality is just the
// content parts you attach. Web search uses OpenRouter's built-in `web` plugin.

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  apiKey: string;
  temperature?: number;
  webSearch?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Combine an optional external abort signal with an optional timeout, and hand
 *  back a cleanup so the timer/listener don't leak once the call finishes. */
function makeSignal(
  external?: AbortSignal,
  timeoutMs?: number,
): { signal: AbortSignal | undefined; done: () => void } {
  if (!external && !timeoutMs) return { signal: undefined, done: () => {} };
  const ctrl = new AbortController();
  const cleanups: Array<() => void> = [];
  if (external) {
    if (external.aborted) ctrl.abort((external as any).reason);
    else {
      const h = () => ctrl.abort((external as any).reason);
      external.addEventListener('abort', h, { once: true });
      cleanups.push(() => external.removeEventListener('abort', h));
    }
  }
  if (timeoutMs) {
    const t = setTimeout(() => ctrl.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
    cleanups.push(() => clearTimeout(t));
  }
  return { signal: ctrl.signal, done: () => cleanups.forEach((c) => c()) };
}

function abortMessage(e: any): string | null {
  if (e?.name === 'TimeoutError') return 'Timed out';
  if (e?.name === 'AbortError') return 'Aborted';
  return null;
}

/** Pull the human-readable message out of an OpenRouter JSON error body. */
function errorDetail(detail: string): string {
  try {
    const j = JSON.parse(detail);
    if (j?.error?.message) return String(j.error.message);
  } catch {
    /* not JSON */
  }
  return detail.slice(0, 300);
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://slm-router.studio',
    'X-Title': 'SLM Router Studio',
  };
}

function requestBody(opts: ChatOptions, stream: boolean) {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    stream,
  };
  if (opts.webSearch) body.plugins = [{ id: 'web' }];
  if (stream) body.stream_options = { include_usage: true };
  return body;
}

export interface ChatResult {
  text: string;
  usage?: Usage;
  latencyMs: number;
  error?: string;
}

/** Non-streaming completion. Returns text + usage + latency; never throws. */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const start = Date.now();
  if (!opts.apiKey) return { text: '', latencyMs: 0, error: 'No OpenRouter key set' };
  const { signal, done } = makeSignal(opts.signal, opts.timeoutMs);
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: headers(opts.apiKey),
      body: JSON.stringify(requestBody(opts, false)),
      signal,
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { text: '', latencyMs, error: `HTTP ${res.status}: ${errorDetail(detail)}` };
    }
    const json = await res.json();
    return { text: json.choices?.[0]?.message?.content ?? '', usage: json.usage, latencyMs };
  } catch (e: any) {
    return { text: '', latencyMs: Date.now() - start, error: abortMessage(e) || String(e) };
  } finally {
    done();
  }
}

export interface StreamMeta {
  usage?: Usage;
  latencyMs: number;
}

/** Streaming completion. Yields content deltas; calls onDone once with usage +
 *  latency when the stream ends. Throws on non-OK response. */
export async function* chatStream(
  opts: ChatOptions,
  onDone?: (m: StreamMeta) => void,
): AsyncGenerator<string> {
  if (!opts.apiKey) throw new Error('No OpenRouter key set');
  const start = Date.now();
  let usage: Usage | undefined;
  let finished = false;
  const finish = () => {
    if (!finished) {
      finished = true;
      onDone?.({ usage, latencyMs: Date.now() - start });
    }
  };
  const { signal, done } = makeSignal(opts.signal, opts.timeoutMs);
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: headers(opts.apiKey),
      body: JSON.stringify(requestBody(opts, true)),
      signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errorDetail(detail)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done: rdone, value } = await reader.read();
      if (rdone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const obj = JSON.parse(data);
          if (obj.usage) usage = obj.usage;
          const delta = obj.choices?.[0]?.delta?.content;
          if (delta) yield delta as string;
        } catch {
          /* keepalive / partial line */
        }
      }
    }
  } finally {
    finish();
    done();
  }
}

/** Build a user message with optional image (data URL) and audio (base64). */
export function userMessage(
  text: string,
  images?: string | string[],
  audio?: { data: string; format: string },
): ChatMessage {
  const imgs = images ? (Array.isArray(images) ? images : [images]) : [];
  if (!imgs.length && !audio) return { role: 'user', content: text };
  const parts: ContentPart[] = [];
  if (text) parts.push({ type: 'text', text });
  for (const url of imgs) parts.push({ type: 'image_url', image_url: { url } });
  if (audio) parts.push({ type: 'input_audio', input_audio: audio });
  return { role: 'user', content: parts };
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/** base64 payload + format from an audio File (for the input_audio content part). */
export async function fileToAudio(file: File): Promise<{ data: string; format: string }> {
  const dataUrl = await fileToDataURL(file);
  const base64 = dataUrl.split(',')[1] || '';
  const format = (file.name.split('.').pop() || 'mp3').toLowerCase();
  return { data: base64, format };
}

export interface OrModel {
  id: string;
  name?: string;
  pricing?: { prompt: number; completion: number };
  inputs?: string[];
}

// ── Staged pipeline: OCR / STT run as their own visible steps ─────────
export type StageName = 'ocr' | 'stt' | 'answer';

export interface Stage {
  name: StageName;
  label: string;
  text: string;
  usage?: Usage;
  latencyMs: number;
  error?: string;
}

export interface PipelineResult {
  stages: Stage[];
  answer: string;
  totalLatencyMs: number;
  totalTokens: number;
  totalCost?: number;
  error?: string;
}

export interface PipelineInput {
  model: string;
  apiKey: string;
  prompt: string;
  temperature?: number;
  webSearch?: boolean;
  images?: string[];
  audio?: { data: string; format: string };
  signal?: AbortSignal;
  timeoutMs?: number;
  pricing?: { prompt: number; completion: number };
}

const OCR_INSTRUCTION =
  'Extract ALL text from this image, verbatim, preserving line breaks. If the image contains no text, briefly describe it. Output only the result — no preamble or commentary.';
const STT_INSTRUCTION =
  'Transcribe this audio verbatim. Output only the transcript — no preamble or commentary.';

/** Run OCR (if image) and/or STT (if audio) as separate steps, then answer the
 *  prompt using the extracted text. Each step reports its own text + usage + ms. */
export async function runPipeline(inp: PipelineInput): Promise<PipelineResult> {
  const stages: Stage[] = [];
  const images = inp.images || [];
  let sttText = '';

  // OCR each image as its own visible step.
  for (let i = 0; i < images.length; i++) {
    const r = await chat({
      model: inp.model,
      apiKey: inp.apiKey,
      temperature: 0,
      signal: inp.signal,
      timeoutMs: inp.timeoutMs,
      messages: [userMessage(OCR_INSTRUCTION, images[i])],
    });
    stages.push({
      name: 'ocr',
      label: images.length > 1 ? `OCR — image ${i + 1}` : 'OCR — read',
      text: r.text,
      usage: r.usage,
      latencyMs: r.latencyMs,
      error: r.error,
    });
  }

  if (inp.audio) {
    const r = await chat({
      model: inp.model,
      apiKey: inp.apiKey,
      temperature: 0,
      signal: inp.signal,
      timeoutMs: inp.timeoutMs,
      messages: [userMessage(STT_INSTRUCTION, undefined, inp.audio)],
    });
    stages.push({ name: 'stt', label: 'STT — transcript', text: r.text, usage: r.usage, latencyMs: r.latencyMs, error: r.error });
    sttText = r.text;
  }

  // Answer sees the actual images (real multimodal response) + the transcript.
  const context = sttText ? `\n\n[Audio transcript]\n${sttText}` : '';
  const answerPrompt = (inp.prompt?.trim() || 'Analyze the provided content.') + context;

  const r = await chat({
    model: inp.model,
    apiKey: inp.apiKey,
    temperature: inp.temperature,
    webSearch: inp.webSearch,
    signal: inp.signal,
    timeoutMs: inp.timeoutMs,
    messages: [userMessage(answerPrompt, images)],
  });
  stages.push({ name: 'answer', label: 'Answer', text: r.text, usage: r.usage, latencyMs: r.latencyMs, error: r.error });

  const totalLatencyMs = stages.reduce((s, x) => s + (x.latencyMs || 0), 0);
  const totalTokens = stages.reduce((s, x) => s + (x.usage?.total_tokens || 0), 0);
  const totalCost = inp.pricing ? stages.reduce((s, x) => s + usdCost(x.usage, inp.pricing), 0) : undefined;
  const error = stages.find((s) => s.error)?.error;
  return { stages, answer: r.text, totalLatencyMs, totalTokens, totalCost, error };
}

/** Live model list from OpenRouter (public; no key needed). */
export async function fetchModels(): Promise<OrModel[]> {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/models`);
    const json = await res.json();
    return (json.data || [])
      .map((m: any) => ({
        id: m.id as string,
        name: m.name as string,
        pricing: m.pricing
          ? { prompt: Number(m.pricing.prompt) || 0, completion: Number(m.pricing.completion) || 0 }
          : undefined,
        inputs: Array.isArray(m.architecture?.input_modalities) ? m.architecture.input_modalities : undefined,
      }))
      .sort((a: OrModel, b: OrModel) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

let _modelsCache: OrModel[] | null = null;
let _modelsInflight: Promise<OrModel[]> | null = null;

/** Cached model list — shared by the pickers and the cost estimator. */
export function fetchModelsCached(): Promise<OrModel[]> {
  if (_modelsCache) return Promise.resolve(_modelsCache);
  if (!_modelsInflight)
    _modelsInflight = fetchModels().then((m) => {
      _modelsCache = m;
      return m;
    });
  return _modelsInflight;
}

export function pricingFor(models: OrModel[], id: string): { prompt: number; completion: number } | undefined {
  return models.find((m) => m.id === id)?.pricing;
}

/** Input modalities the model accepts, or undefined if unknown (custom id / not
 *  in the fetched list). Used to warn before sending images/audio to a
 *  text-only model. */
export function modelInputs(models: OrModel[], id: string): string[] | undefined {
  return models.find((m) => m.id === id)?.inputs;
}

export function usdCost(usage: Usage | undefined, pricing?: { prompt: number; completion: number }): number {
  if (!usage || !pricing) return 0;
  return (usage.prompt_tokens || 0) * pricing.prompt + (usage.completion_tokens || 0) * pricing.completion;
}
