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
  try {
    if (!opts.apiKey) return { text: '', latencyMs: 0, error: 'No OpenRouter key set' };
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: headers(opts.apiKey),
      body: JSON.stringify(requestBody(opts, false)),
      signal: opts.signal,
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { text: '', latencyMs, error: `HTTP ${res.status}: ${detail.slice(0, 300)}` };
    }
    const json = await res.json();
    return { text: json.choices?.[0]?.message?.content ?? '', usage: json.usage, latencyMs };
  } catch (e: any) {
    return { text: '', latencyMs: Date.now() - start, error: e?.name === 'AbortError' ? 'Aborted' : String(e) };
  }
}

/** Streaming completion. Yields content deltas. Throws on non-OK response. */
export async function* chatStream(opts: ChatOptions): AsyncGenerator<string> {
  if (!opts.apiKey) throw new Error('No OpenRouter key set');
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(opts.apiKey),
    body: JSON.stringify(requestBody(opts, true)),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
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
        const delta = obj.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        /* keepalive / partial line */
      }
    }
  }
}

/** Build a user message with optional image (data URL) and audio (base64). */
export function userMessage(
  text: string,
  imageDataUrl?: string,
  audio?: { data: string; format: string },
): ChatMessage {
  if (!imageDataUrl && !audio) return { role: 'user', content: text };
  const parts: ContentPart[] = [];
  if (text) parts.push({ type: 'text', text });
  if (imageDataUrl) parts.push({ type: 'image_url', image_url: { url: imageDataUrl } });
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
}

/** Live model list from OpenRouter (public; no key needed). */
export async function fetchModels(): Promise<OrModel[]> {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/models`);
    const json = await res.json();
    return (json.data || [])
      .map((m: any) => ({ id: m.id as string, name: m.name as string }))
      .sort((a: OrModel, b: OrModel) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}
