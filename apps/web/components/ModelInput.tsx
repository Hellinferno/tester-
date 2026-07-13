'use client';

import React, { useEffect, useId, useState } from 'react';
import { fetchModelsCached, OrModel, Provider } from '../lib/openrouter';
import { fetchGeminiModels } from '../lib/gemini';
import { getGeminiKey, getStored, setStored } from '../lib/settings';
import { useProvider } from '../lib/providerContext';

function useLiveModels(provider: Provider): OrModel[] {
  const [models, setModels] = useState<OrModel[]>([]);
  useEffect(() => {
    let alive = true;
    const load = provider === 'gemini' ? fetchGeminiModels(getGeminiKey()) : fetchModelsCached();
    load.then((m) => {
      if (alive) setModels(m);
    });
    return () => {
      alive = false;
    };
  }, [provider]);
  return models;
}

interface ModelInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onEnter?: () => void;
  showVisionToggle?: boolean;
}

/** Model id input with autocomplete over the live OpenRouter model list. When
 *  "vision only" is on (shared preference), the list is filtered to
 *  image-capable models — the ones that can do OCR. */
export const ModelInput: React.FC<ModelInputProps> = ({ value, onChange, placeholder, onEnter, showVisionToggle }) => {
  const { provider } = useProvider();
  const all = useLiveModels(provider);
  const [visionOnly, setVisionOnly] = useState(false);
  const listId = useId();

  useEffect(() => setVisionOnly(getStored('or.model.visionOnly', false)), []);

  const models = visionOnly ? all.filter((m) => m.inputs?.includes('image')) : all;

  return (
    <div>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder || 'e.g. openai/gpt-4o'}
        className="w-full rounded-lg border border-studio-border bg-white px-3 py-2.5 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none focus:ring-1 focus:ring-studio-blue"
      />
      <datalist id={listId}>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.id}
          </option>
        ))}
      </datalist>
      {showVisionToggle && (
        <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs text-studio-muted">
          <input
            type="checkbox"
            checked={visionOnly}
            onChange={(e) => {
              setVisionOnly(e.target.checked);
              setStored('or.model.visionOnly', e.target.checked);
            }}
            className="h-3 w-3 accent-studio-blue"
          />
          Vision models only (image / OCR)
        </label>
      )}
    </div>
  );
};
