'use client';

import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Settings, Trash2, X } from 'lucide-react';
import { getOpenRouterKey, setOpenRouterKey } from '../../lib/settings';

// Gear button in the navbar that opens a modal for entering the user's own
// OpenRouter API key (BYOK). The key is stored in localStorage only.
export const SettingsPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  // Load the stored key whenever the modal opens (and on mount for the badge).
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
        className="flex items-center space-x-2 rounded-full border px-3 py-1.5 transition-colors border-gray-700 bg-gray-900/80 hover:bg-gray-800"
        title="Set your OpenRouter API key"
      >
        <Settings className="h-4 w-4 text-gray-300" />
        <span
          className={`h-2 w-2 rounded-full ${hasKey ? 'bg-emerald-400' : 'bg-amber-400'}`}
        />
        <span className="text-xs font-medium text-gray-300">
          {hasKey ? 'Key set' : 'No key'}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2">
                <KeyRound className="h-5 w-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">OpenRouter API Key</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-gray-400">
              Bring your own key. It is stored only in this browser and sent with each
              request as the <code className="text-gray-300">X-OpenRouter-Key</code> header —
              never saved on the server. Get one at{' '}
              <span className="text-blue-400">openrouter.ai/keys</span>.
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                API Key
              </label>
              <div className="relative">
                <input
                  type={reveal ? 'text' : 'password'}
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full rounded-xl border border-gray-800 bg-gray-900 p-3 pr-10 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={handleClear}
                className="flex items-center space-x-1.5 rounded-lg border border-gray-800 px-3 py-2 text-xs font-medium text-gray-400 hover:bg-gray-900 hover:text-gray-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-blue-500/30"
              >
                {saved ? <Check className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                <span>{saved ? 'Saved' : 'Save key'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
