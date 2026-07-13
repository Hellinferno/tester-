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

const GEMINI_KEY_STORAGE = 'slm_gemini_key';

export function getGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function setGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) window.localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  else window.localStorage.removeItem(GEMINI_KEY_STORAGE);
}

// Generic localStorage JSON store (SSR-safe). Used to persist model choices,
// system prompt, temperature, etc. across sessions.
export function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function setStored<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}
