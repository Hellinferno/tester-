'use client';

import React from 'react';
import { ChevronDown, Info, RotateCcw } from 'lucide-react';
import { MODEL_OPTIONS } from '../lib/models';
import { AnalysisResult, RoutingDecision } from '../types';

interface RunSettingsProps {
  modelChoice: string;
  setModelChoice: (v: string) => void;
  customModel: string;
  setCustomModel: (v: string) => void;
  temperature: number;
  setTemperature: (v: number) => void;
  webSearch: boolean;
  setWebSearch: (v: boolean) => void;
  analysis?: AnalysisResult;
  routing?: RoutingDecision;
  onReset: () => void;
}

const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({
  checked,
  onChange,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
      checked ? 'bg-studio-blue' : 'bg-[#c4c7c5]'
    }`}
  >
    <span
      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const ToolRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ label, checked, onChange, disabled }) => (
  <div className="flex items-center justify-between rounded-lg px-1 py-1.5">
    <span className={`flex items-center gap-1.5 text-sm ${disabled ? 'text-studio-faint' : 'text-studio-text'}`}>
      {label}
      <Info className="h-3.5 w-3.5 text-studio-faint" />
    </span>
    <Switch checked={checked} onChange={onChange} disabled={disabled} />
  </div>
);

export const RunSettings: React.FC<RunSettingsProps> = ({
  modelChoice,
  setModelChoice,
  customModel,
  setCustomModel,
  temperature,
  setTemperature,
  webSearch,
  setWebSearch,
  analysis,
  routing,
  onReset,
}) => {
  const outputTokens = analysis?.output_requirements?.estimated_tokens ?? 0;
  const thinkingTokens = analysis?.reasoning?.thinking_tokens ?? 0;

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
        {/* Model */}
        <section>
          <label className="mb-1.5 block text-xs font-medium text-studio-muted">Model</label>
          <div className="relative">
            <select
              value={modelChoice}
              onChange={(e) => setModelChoice(e.target.value)}
              className="w-full appearance-none rounded-lg border border-studio-border bg-white py-2.5 pl-3 pr-9 text-sm text-studio-text focus:border-studio-blue focus:outline-none focus:ring-1 focus:ring-studio-blue"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-studio-muted" />
          </div>
          {modelChoice === 'custom' && (
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g. mistralai/mistral-large"
              className="mt-2 w-full rounded-lg border border-studio-border bg-white px-3 py-2.5 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none focus:ring-1 focus:ring-studio-blue"
            />
          )}
          {modelChoice === 'auto' && routing?.display_name && (
            <p className="mt-1.5 text-xs text-studio-muted">
              Router pick: <span className="text-studio-text">{routing.display_name}</span>
            </p>
          )}
        </section>

        {/* Token count */}
        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-studio-muted">Token count</span>
            <span className="font-mono text-xs text-studio-text">
              {outputTokens.toLocaleString()}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-studio-surface px-3 py-2">
              <div className="text-[11px] text-studio-muted">Est. output</div>
              <div className="text-sm font-medium text-studio-text">~{outputTokens.toLocaleString()}</div>
            </div>
            <div className="flex-1 rounded-lg bg-studio-surface px-3 py-2">
              <div className="text-[11px] text-studio-muted">Thinking</div>
              <div className="text-sm font-medium text-studio-text">
                {thinkingTokens > 0 ? `~${thinkingTokens.toLocaleString()}` : '—'}
              </div>
            </div>
          </div>
          {analysis?.subject?.primary && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-studio-bluesoft px-2.5 py-0.5 text-xs capitalize text-studio-bluetext">
                {analysis.subject.primary.replace(/_/g, ' ')}
              </span>
              <span className="rounded-full bg-studio-surface px-2.5 py-0.5 text-xs capitalize text-studio-muted">
                {analysis.complexity.level} complexity
              </span>
            </div>
          )}
        </section>

        {/* Temperature */}
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

        {/* Tools */}
        <section>
          <h3 className="mb-1 text-xs font-medium text-studio-muted">Tools</h3>
          <ToolRow label="Grounding with Google Search" checked={webSearch} onChange={setWebSearch} />
          <ToolRow label="Structured output" checked={false} onChange={() => {}} disabled />
          <ToolRow label="Code execution" checked={false} onChange={() => {}} disabled />
          <ToolRow label="Function calling" checked={false} onChange={() => {}} disabled />
        </section>
      </div>
    </aside>
  );
};
