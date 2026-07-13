'use client';

import React, { useEffect, useId, useState } from 'react';
import { fetchModels, OrModel } from '../lib/openrouter';

// Module-level cache so every picker shares one live model fetch.
let cache: OrModel[] | null = null;
let inflight: Promise<OrModel[]> | null = null;

function useLiveModels(): OrModel[] {
  const [models, setModels] = useState<OrModel[]>(cache || []);
  useEffect(() => {
    if (cache) {
      setModels(cache);
      return;
    }
    if (!inflight) inflight = fetchModels();
    let alive = true;
    inflight.then((m) => {
      cache = m;
      if (alive) setModels(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return models;
}

interface ModelInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onEnter?: () => void;
}

/** Model id input with autocomplete over the live OpenRouter model list. */
export const ModelInput: React.FC<ModelInputProps> = ({ value, onChange, placeholder, onEnter }) => {
  const models = useLiveModels();
  const listId = useId();
  return (
    <>
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
    </>
  );
};
