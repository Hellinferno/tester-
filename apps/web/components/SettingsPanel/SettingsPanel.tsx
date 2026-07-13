'use client';

import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import {
  getGeminiKey,
  getOpenRouterKey,
  setGeminiKey,
  setOpenRouterKey,
} from '../../lib/settings';
import { useProvider } from '../../lib/providerContext';

// Sidebar "Keys & provider" button + modal. Both BYOK keys live only in the
// browser's localStorage. The provider toggle chooses which one every call uses.
export const SettingsPanel: React.FC = () => {
  const { provider, setProvider } = useProvider();
  const [open, setOpen] = useState(false);
  const [orKey, setOrKey] = useState('');
  const [gemKey, setGemKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasActiveKey, setHasActiveKey] = useState(false);

  const refreshBadge = () =>
    setHasActiveKey((provider === 'gemini' ? getGeminiKey() : getOpenRouterKey()).length > 0);

  useEffect(() => {
    refreshBadge();
    if (open) {
      setOrKey(getOpenRouterKey());
      setGemKey(getGeminiKey());
      setSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, provider]);

  const handleSave = () => {
    setOpenRouterKey(orKey);
    setGeminiKey(gemKey);
    refreshBadge();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const providerLabel = provider === 'gemini' ? 'Gemini' : 'OpenRouter';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm text-studio-text transition-colors hover:bg-studio-hover"
      >
        <KeyRound className="h-[18px] w-[18px] text-studio-muted" />
        <span className="flex-1 text-left">{providerLabel} key</span>
        <span className={`h-2 w-2 rounded-full ${hasActiveKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-studio-border bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-studio-line pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-studio-blue" />
                <h3 className="font-display text-[15px] font-medium text-studio-text">Provider & keys</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-studio-muted hover:text-studio-text">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* provider toggle */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-studio-muted">Provider</label>
              <div className="flex gap-1 rounded-lg border border-studio-border p-1">
                {(['openrouter', 'gemini'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
                      provider === p ? 'bg-studio-bluesoft font-medium text-studio-bluetext' : 'text-studio-muted hover:bg-studio-hover'
                    }`}
                  >
                    {p === 'gemini' ? 'Gemini (Google)' : 'OpenRouter'}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-studio-faint">All calls use the selected provider and its key.</p>
            </div>

            <KeyField
              label="OpenRouter API key"
              value={orKey}
              onChange={setOrKey}
              reveal={reveal}
              placeholder="sk-or-v1-..."
              active={provider === 'openrouter'}
            />
            <KeyField
              label="Gemini API key"
              value={gemKey}
              onChange={setGemKey}
              reveal={reveal}
              placeholder="AIza..."
              active={provider === 'gemini'}
            />

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setReveal((r) => !r)}
                className="flex items-center gap-1.5 text-xs text-studio-muted hover:text-studio-text"
              >
                {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {reveal ? 'Hide' : 'Show'} keys
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-lg bg-studio-blue px-4 py-2 text-xs font-medium text-white hover:bg-studio-bluehover"
              >
                {saved ? <Check className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
            <p className="mt-3 text-xs text-studio-faint">
              Stored only in this browser, sent per request. Never saved on a server.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

const KeyField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  reveal: boolean;
  placeholder: string;
  active: boolean;
}> = ({ label, value, onChange, reveal, placeholder, active }) => (
  <div className="mt-4">
    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-studio-muted">
      {label}
      {active && <span className="rounded-full bg-studio-bluesoft px-1.5 text-[10px] text-studio-bluetext">active</span>}
    </label>
    <input
      type={reveal ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-studio-border bg-white p-2.5 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none focus:ring-1 focus:ring-studio-blue"
    />
  </div>
);
