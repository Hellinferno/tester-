// Client-side settings: the user's own OpenRouter key (BYOK) lives only in the
// browser's localStorage and is sent per-request as the X-OpenRouter-Key header.
// It is never persisted server-side. SSR-safe (guards `window`).

const OPENROUTER_KEY_STORAGE = 'slm_openrouter_key';

export function getOpenRouterKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(OPENROUTER_KEY_STORAGE) || '';
}

export function setOpenRouterKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    window.localStorage.setItem(OPENROUTER_KEY_STORAGE, trimmed);
  } else {
    window.localStorage.removeItem(OPENROUTER_KEY_STORAGE);
  }
}

export function hasOpenRouterKey(): boolean {
  return getOpenRouterKey().length > 0;
}

// Base URL the browser uses to reach the orchestrator (Render URL in prod).
export const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:8001';

// Default generation model: 'auto' = smart routing, or an OpenRouter model id.
export const DEFAULT_MODEL = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'auto';
