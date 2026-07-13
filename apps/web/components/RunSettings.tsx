'use client';

import React from 'react';
import { Info, RotateCcw } from 'lucide-react';
import { ModelInput } from './ModelInput';

interface RunSettingsProps {
  model: string;
  setModel: (v: string) => void;
  temperature: number;
  setTemperature: (v: number) => void;
  timeoutSec: number;
  setTimeoutSec: (v: number) => void;
  webSearch: boolean;
  setWebSearch: (v: boolean) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  onReset: () => void;
}

const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-studio-blue' : 'bg-[#c4c7c5]'}`}
  >
    <span
      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
    />
  </button>
);

export const RunSettings: React.FC<RunSettingsProps> = ({
  model,
  setModel,
  temperature,
  setTemperature,
  timeoutSec,
  setTimeoutSec,
  webSearch,
  setWebSearch,
  systemPrompt,
  setSystemPrompt,
  onReset,
}) => {
  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-studio-border bg-studio-canvas">
      <header className="flex items-center justify-between border-b border-studio-line px-5 py-[14px]">
        <h2 className="font-display text-[15px] font-medium text-studio-text">Run settings</h2>
        <button
          onClick={onReset}
          title="Reset settings"
          className="grid h-8 w-8 place-items-center rounded-full text-studio-muted hover:bg-studio-hover"
        >
          <RotateCcw className="h-[18px] w-[18px]" />
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section>
          <label className="mb-1.5 block text-xs font-medium text-studio-muted">Model</label>
          <ModelInput value={model} onChange={setModel} />
          <p className="mt-1.5 text-xs text-studio-faint">Any OpenRouter model — vision models also do OCR.</p>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-studio-muted">Temperature</label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Math.min(2, Math.max(0, Number(e.target.value))))}
              className="w-14 rounded-md border border-studio-border bg-white px-2 py-1 text-right text-sm text-studio-text focus:border-studio-blue focus:outline-none"
            />
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full"
          />
        </section>

        <section>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-studio-muted">Timeout (s)</label>
            <input
              type="number"
              min={0}
              step={5}
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(Math.max(0, Number(e.target.value)))}
              className="w-16 rounded-md border border-studio-border bg-white px-2 py-1 text-right text-sm text-studio-text focus:border-studio-blue focus:outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-studio-faint">Per call. 0 = no limit.</p>
        </section>

        <section>
          <label className="mb-1.5 block text-xs font-medium text-studio-muted">System instructions</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            placeholder="Optional. e.g. You are a precise OCR assistant…"
            className="w-full resize-none rounded-lg border border-studio-border bg-white px-3 py-2.5 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none focus:ring-1 focus:ring-studio-blue"
          />
        </section>

        <section>
          <h3 className="mb-1 text-xs font-medium text-studio-muted">Tools</h3>
          <div className="flex items-center justify-between rounded-lg px-1 py-1.5">
            <span className="flex items-center gap-1.5 text-sm text-studio-text">
              Web search
              <Info className="h-3.5 w-3.5 text-studio-faint" />
            </span>
            <Switch checked={webSearch} onChange={setWebSearch} />
          </div>
          <p className="px-1 text-xs text-studio-faint">
            Uses OpenRouter's built-in web plugin (billed to your key).
          </p>
        </section>
      </div>
    </aside>
  );
};
