// Per-provider glue used by every view so the OpenRouter / Gemini / custom logic
// lives in one place.

import { fetchCustomModels, fetchModelsCached, OrModel, Provider } from './openrouter';
import { fetchGeminiModels } from './gemini';
import { getCustomBaseUrl, getCustomKey, getGeminiKey, getOpenRouterKey } from './settings';

export function activeKey(provider: Provider): string {
  if (provider === 'gemini') return getGeminiKey();
  if (provider === 'custom') return getCustomKey();
  return getOpenRouterKey();
}

export function activeBaseUrl(provider: Provider): string | undefined {
  return provider === 'custom' ? getCustomBaseUrl() : undefined;
}

export function providerLabel(provider: Provider): string {
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'custom') return 'custom endpoint';
  return 'OpenRouter';
}

/** Returns an error string when the provider isn't ready to run, else null. */
export function providerNotReady(provider: Provider): string | null {
  if (provider === 'custom') {
    if (!getCustomBaseUrl()) return 'Set your custom endpoint URL in the sidebar first.';
    if (!getCustomKey()) return 'Add your custom endpoint API key in the sidebar first.';
    return null;
  }
  if (!activeKey(provider)) return `Add your ${providerLabel(provider)} key in the sidebar first.`;
  return null;
}

export function fetchProviderModels(provider: Provider): Promise<OrModel[]> {
  if (provider === 'gemini') return fetchGeminiModels(getGeminiKey());
  if (provider === 'custom') return fetchCustomModels(getCustomBaseUrl(), getCustomKey());
  return fetchModelsCached();
}
