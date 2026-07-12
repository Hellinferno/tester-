'use client';

import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Trash2, X } from 'lucide-react';
import { getOpenRouterKey, setOpenRouterKey } from '../../lib/settings';

// Sidebar "OpenRouter key" button + modal. The key (BYOK) is stored only in the
// browser's localStorage and sent per request as X-OpenRouter-Key.
export const SettingsPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const stored = getOpenRouterKey();
    setHasKey(stored.length > 0);
    if (open) {
      setKeyValue(stored);
      setSaved(false);
    }
  }, [open]);

  const handleSave = () => {
    setOpenRouterKey(keyValue);
    setHasKey(keyValue.trim().length > 0);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClear = () => {
    setOpenRouterKey('');
    setKeyValue('');
    setHasKey(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm text-studio-text transition-colors hover:bg-studio-hover"
      >
        <KeyRound className="h-[18px] w-[18px] text-studio-muted" />
        <span className="flex-1 text-left">OpenRouter key</span>
        <span className={`h-2 w-2 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-studio-border bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-studio-line pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-studio-blue" />
                <h3 className="font-display text-[15px] font-medium text-studio-text">OpenRouter API key</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-studio-muted hover:text-studio-text">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-studio-muted">
              Bring your own key. It's stored only in this browser and sent with each request — never saved on
              the server. Get one at <span className="text-studio-bluetext">openrouter.ai/keys</span>.
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-studio-muted">API key</label>
              <div className="relative">
                <input
                  type={reveal ? 'text' : 'password'}
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full rounded-lg border border-studio-border bg-white p-3 pr-10 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none focus:ring-1 focus:ring-studio-blue"
                />
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-studio-muted hover:text-studio-text"
                >
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-lg border border-studio-border px-3 py-2 text-xs font-medium text-studio-muted hover:bg-studio-surface"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-lg bg-studio-blue px-4 py-2 text-xs font-medium text-white hover:bg-studio-bluehover"
              >
                {saved ? <Check className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                {saved ? 'Saved' : 'Save key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
