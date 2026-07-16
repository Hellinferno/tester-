// Native Google Gemini API client (BYOK, browser-direct). Presents the same
// chat()/chatStream() shape as the OpenRouter client so the pipeline is
// provider-agnostic; the message translation to Gemini's format lives here.

import { abortMessage, errorDetail, makeSignal } from './signal';
import type { ChatOptions, ChatResult, ContentPart, OrModel, StreamMeta, Usage } from './openrouter';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function geminiHeaders(key: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-goog-api-key': key };
}

function normModel(id: string): string {
  return id.replace(/^models\//, '').replace(/^gemini:/, '');
}

function toGeminiParts(content: string | ContentPart[]): any[] {
  if (typeof content === 'string') return [{ text: content }];
  return content.map((p: ContentPart) => {
    if (p.type === 'text') return { text: p.text };
    if (p.type === 'image_url') {
      const m = /^data:([^;]+);base64,(.*)$/.exec(p.image_url.url);
      return m ? { inline_data: { mime_type: m[1], data: m[2] } } : { text: p.image_url.url };
    }
    return { inline_data: { mime_type: `audio/${p.input_audio.format}`, data: p.input_audio.data } };
  });
}

function buildGeminiBody(opts: ChatOptions) {
  const systemParts: any[] = [];
  const contents: any[] = [];
  for (const m of opts.messages) {
    if (m.role === 'system') {
      systemParts.push(...toGeminiParts(m.content));
      continue;
    }
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: toGeminiParts(m.content) });
  }
  const body: Record<string, unknown> = { contents };
  if (systemParts.length) body.systemInstruction = { parts: systemParts };
  const gc: Record<string, unknown> = {};
  if (opts.temperature != null) gc.temperature = opts.temperature;
  if (opts.maxTokens && opts.maxTokens > 0) gc.maxOutputTokens = opts.maxTokens;
  // Only send when > 0 — 0 is illegal on gemini-2.5-pro (can't disable thinking).
  if (opts.thinkingBudget && opts.thinkingBudget > 0) gc.thinkingConfig = { thinkingBudget: Math.floor(opts.thinkingBudget) };
  if (Object.keys(gc).length) body.generationConfig = gc;
  if (opts.webSearch) body.tools = [{ google_search: {} }];
  return body;
}

function geminiUsage(u: any): Usage | undefined {
  if (!u) return undefined;
  return {
    prompt_tokens: u.promptTokenCount,
    completion_tokens: u.candidatesTokenCount,
    total_tokens: u.totalTokenCount,
    reasoning_tokens: u.thoughtsTokenCount,
  };
}

export async function geminiChat(opts: ChatOptions): Promise<ChatResult> {
  const start = Date.now();
  if (!opts.apiKey) return { text: '', latencyMs: 0, error: 'No Gemini key set' };
  const { signal, done } = makeSignal(opts.signal, opts.timeoutMs);
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${normModel(opts.model)}:generateContent`, {
      method: 'POST',
      headers: geminiHeaders(opts.apiKey),
      body: JSON.stringify(buildGeminiBody(opts)),
      signal,
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { text: '', latencyMs, error: `HTTP ${res.status}: ${errorDetail(detail)}` };
    }
    const json = await res.json();
    const text = (json.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
    return { text, usage: geminiUsage(json.usageMetadata), latencyMs };
  } catch (e: any) {
    return { text: '', latencyMs: Date.now() - start, error: abortMessage(e) || String(e) };
  } finally {
    done();
  }
}

export async function* geminiChatStream(opts: ChatOptions, onDone?: (m: StreamMeta) => void): AsyncGenerator<string> {
  if (!opts.apiKey) throw new Error('No Gemini key set');
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
    const res = await fetch(`${GEMINI_BASE}/models/${normModel(opts.model)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: geminiHeaders(opts.apiKey),
      body: JSON.stringify(buildGeminiBody(opts)),
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
        if (!data) continue;
        try {
          const obj = JSON.parse(data);
          if (obj.usageMetadata) usage = geminiUsage(obj.usageMetadata);
          const text = (obj.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
          if (text) yield text as string;
        } catch {
          /* partial line */
        }
      }
    }
  } finally {
    finish();
    done();
  }
}

// Rough Gemini price table (USD per 1M tokens). Estimates — Gemini doesn't
// expose pricing via the API. Matched by substring, most specific first.
const GEMINI_PRICES: { match: string; prompt: number; completion: number }[] = [
  { match: '2.5-pro', prompt: 1.25, completion: 10 },
  { match: '2.5-flash-lite', prompt: 0.1, completion: 0.4 },
  { match: '2.5-flash', prompt: 0.3, completion: 2.5 },
  { match: '2.0-flash-lite', prompt: 0.075, completion: 0.3 },
  { match: '2.0-flash', prompt: 0.1, completion: 0.4 },
  { match: '1.5-pro', prompt: 1.25, completion: 5 },
  { match: '1.5-flash-8b', prompt: 0.0375, completion: 0.15 },
  { match: '1.5-flash', prompt: 0.075, completion: 0.3 },
];

function geminiPricing(id: string): { prompt: number; completion: number } | undefined {
  const p = GEMINI_PRICES.find((x) => id.includes(x.match));
  return p ? { prompt: p.prompt / 1e6, completion: p.completion / 1e6 } : undefined;
}

/** List Gemini models (needs the key). Marks them multimodal so the vision
 *  filter passes, and attaches estimated pricing. */
export async function fetchGeminiModels(key: string): Promise<OrModel[]> {
  if (!key) return [];
  try {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, { headers: geminiHeaders(key) });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => {
        const id = String(m.name || '').replace(/^models\//, '');
        return { id, name: m.displayName || id, pricing: geminiPricing(id), inputs: ['text', 'image', 'audio'] };
      })
      .sort((a: OrModel, b: OrModel) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}
