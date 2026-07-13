// Shared HTTP helpers used by both the OpenRouter and Gemini clients.

/** Combine an optional external abort signal with an optional timeout, and hand
 *  back a cleanup so the timer/listener don't leak once the call finishes. */
export function makeSignal(
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

export function abortMessage(e: any): string | null {
  if (e?.name === 'TimeoutError') return 'Timed out';
  if (e?.name === 'AbortError') return 'Aborted';
  return null;
}

/** Pull the human-readable message out of a provider's JSON error body. */
export function errorDetail(detail: string): string {
  try {
    const j = JSON.parse(detail);
    if (j?.error?.message) return String(j.error.message);
  } catch {
    /* not JSON */
  }
  return detail.slice(0, 300);
}
