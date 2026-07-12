// Curated OpenRouter models offered in the model picker. 'auto' defers to the
// router's smart selection; 'custom' reveals a free-text field so the user can
// enter ANY OpenRouter model id. Keep in sync with router-service model_router.py.

export interface ModelOption {
  id: string;
  label: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'auto', label: 'Auto — smart routing' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'google/gemini-flash-1.5', label: 'Gemini 1.5 Flash' },
  { id: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B Instruct' },
  { id: 'custom', label: 'Custom model id…' },
];
