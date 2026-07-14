'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Wand2 } from 'lucide-react';
import { ModelInput } from './ModelInput';
import { OrModel } from '../lib/openrouter';
import { getStored, setStored } from '../lib/settings';
import { activeBaseUrl, activeKey } from '../lib/providers';
import { useProvider } from '../lib/providerContext';
import { RouterConfig, RouterRun, RouterSlots, RouterStep } from '../lib/router';

export const fmtUsd = (c: number) => '$' + c.toFixed(c >= 0.01 ? 4 : 6);

export const download = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

// Starting lineups. Fast holds Gemma by default (the hypothesis under test);
// the bench's stats can promote it. Custom endpoints have no presets — edit slots.
type Preset = { budget: RouterSlots; quality: RouterSlots };
export const PRESETS: Record<'openrouter' | 'gemini', Preset> = {
  openrouter: {
    budget: { scout: 'google/gemini-2.5-flash-lite', fast: 'google/gemma-3-27b-it', smart: 'google/gemini-2.5-flash', expert: 'google/gemini-2.5-pro' },
    quality: { scout: 'google/gemini-2.5-flash-lite', fast: 'google/gemini-2.5-flash-lite', smart: 'google/gemini-2.5-flash', expert: 'google/gemini-2.5-pro' },
  },
  gemini: {
    budget: { scout: 'gemini-2.5-flash-lite', fast: 'gemini-2.0-flash-lite', smart: 'gemini-2.5-flash', expert: 'gemini-2.5-pro' },
    quality: { scout: 'gemini-2.5-flash-lite', fast: 'gemini-2.5-flash-lite', smart: 'gemini-2.5-flash', expert: 'gemini-2.5-pro' },
  },
};
// Slots start empty — you fill them (type a model, or click a preset button).
export const DEFAULT_SLOTS: RouterSlots = { scout: '', fast: '', smart: '', expert: '' };

export interface RouterConfigState {
  slots: RouterSlots;
  setSlots: (s: RouterSlots) => void;
  budgetSec: number;
  setBudgetSec: (n: number) => void;
  backup: boolean;
  setBackup: (b: boolean) => void;
  maxTokens: number;
  setMaxTokens: (n: number) => void;
  batchSize: number;
  setBatchSize: (n: number) => void;
}

export function useRouterConfig(): RouterConfigState {
  const [slots, setSlots] = useState<RouterSlots>(DEFAULT_SLOTS);
  const [budgetSec, setBudgetSec] = useState(10);
  const [backup, setBackup] = useState(true);
  const [maxTokens, setMaxTokens] = useState(0);
  const [batchSize, setBatchSize] = useState(1);

  useEffect(() => {
    setSlots(getStored('or.router.slots', DEFAULT_SLOTS));
    setBudgetSec(getStored('or.router.budget', 10));
    setBackup(getStored('or.router.backup', true));
    setMaxTokens(getStored('or.router.maxtok', 0));
    setBatchSize(getStored('or.router.batch', 1));
  }, []);
  useEffect(() => setStored('or.router.slots', slots), [slots]);
  useEffect(() => setStored('or.router.budget', budgetSec), [budgetSec]);
  useEffect(() => setStored('or.router.backup', backup), [backup]);
  useEffect(() => setStored('or.router.maxtok', maxTokens), [maxTokens]);
  useEffect(() => setStored('or.router.batch', batchSize), [batchSize]);

  return { slots, setSlots, budgetSec, setBudgetSec, backup, setBackup, maxTokens, setMaxTokens, batchSize, setBatchSize };
}

/** Assemble the run-time RouterConfig (key/baseUrl/models pulled fresh). Per-call
 *  timeout is a safety cap keyed off the budget, not a hard cut of valid work. */
export function assembleConfig(
  provider: ReturnType<typeof useProvider>['provider'],
  cfg: RouterConfigState,
  models: OrModel[],
  signal?: AbortSignal,
): RouterConfig {
  return {
    provider,
    apiKey: activeKey(provider),
    baseUrl: activeBaseUrl(provider),
    slots: cfg.slots,
    budgetSec: cfg.budgetSec,
    backup: cfg.backup,
    maxTokens: cfg.maxTokens,
    models,
    signal,
    timeoutMs: Math.max(cfg.budgetSec, 20) * 1000,
  };
}

// ── Config editor: presets + slots + knobs + batch size ───────────────
export const SlotsBar: React.FC<{ cfg: RouterConfigState; showBatch?: boolean }> = ({ cfg, showBatch }) => {
  const { provider } = useProvider();
  const preset = provider === 'gemini' ? PRESETS.gemini : provider === 'custom' ? null : PRESETS.openrouter;
  const setSlot = (k: keyof RouterSlots, v: string) => cfg.setSlots({ ...cfg.slots, [k]: v });

  return (
    <div className="mb-6 rounded-xl border border-studio-border bg-studio-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-xs font-medium text-studio-muted">Model lineup</label>
        {preset && (
          <div className="flex gap-1.5">
            <button onClick={() => cfg.setSlots(preset.budget)} className="rounded-full border border-studio-border px-2.5 py-1 text-[11px] text-studio-text hover:bg-studio-hover">
              Budget (Gemma)
            </button>
            <button onClick={() => cfg.setSlots(preset.quality)} className="rounded-full border border-studio-border px-2.5 py-1 text-[11px] text-studio-text hover:bg-studio-hover">
              Quality
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {(['scout', 'fast', 'smart', 'expert'] as (keyof RouterSlots)[]).map((k) => (
          <div key={k}>
            <div className="mb-1 text-[11px] font-medium capitalize text-studio-muted">
              {k}
              <span className="ml-1 font-normal text-studio-faint">{SLOT_HINT[k]}</span>
            </div>
            <ModelInput value={cfg.slots[k]} onChange={(v) => setSlot(k, v)} placeholder={`${k} model`} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-1.5 text-xs text-studio-muted">
          Budget (s)
          <input type="number" min={1} value={cfg.budgetSec} onChange={(e) => cfg.setBudgetSec(Math.max(1, Number(e.target.value)))} className="w-16 rounded-lg border border-studio-border bg-white px-2 py-1.5 text-sm text-studio-text focus:border-studio-blue focus:outline-none" />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-studio-muted">
          <input type="checkbox" checked={cfg.backup} onChange={(e) => cfg.setBackup(e.target.checked)} className="h-3.5 w-3.5 accent-studio-blue" />
          Backup race (hard)
        </label>
        <label className="flex items-center gap-1.5 text-xs text-studio-muted">
          Max tokens
          <input type="number" min={0} step={256} value={cfg.maxTokens} onChange={(e) => cfg.setMaxTokens(Math.max(0, Number(e.target.value)))} className="w-20 rounded-lg border border-studio-border bg-white px-2 py-1.5 text-sm text-studio-text focus:border-studio-blue focus:outline-none" />
        </label>
        {showBatch && (
          <label className="flex items-center gap-1.5 text-xs text-studio-muted">
            Batch size
            <input type="number" min={1} max={10} value={cfg.batchSize} onChange={(e) => cfg.setBatchSize(Math.max(1, Math.min(10, Number(e.target.value))))} className="w-16 rounded-lg border border-studio-border bg-white px-2 py-1.5 text-sm text-studio-text focus:border-studio-blue focus:outline-none" />
          </label>
        )}
      </div>
      {showBatch && <p className="mt-2 text-[11px] text-studio-faint">Batch size = how many calls run at once. Raise it to go faster; too high can hit provider rate limits (429), which show as per-item errors.</p>}
    </div>
  );
};

const SLOT_HINT: Record<keyof RouterSlots, string> = {
  scout: 'classifies',
  fast: 'cheap solver',
  smart: 'mid solver',
  expert: 'strong solver',
};

// ── Result card for one router run ────────────────────────────────────
const DIFF_COLOR: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-sky-100 text-sky-700',
  hard: 'bg-amber-100 text-amber-700',
  extreme: 'bg-red-100 text-red-700',
};

export const RouterRunCard: React.FC<{ run: RouterRun; budgetSec: number }> = ({ run, budgetSec }) => {
  if (run.retake) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
          <AlertTriangle className="h-4 w-4" /> Retake the photo ({run.retake.reason})
        </div>
        <p className="mt-1 text-sm text-amber-700">{run.retake.detail}</p>
        <p className="mt-2 text-[11px] text-amber-600">Zero LLM spend — the image gate caught this before any model was called.</p>
      </div>
    );
  }
  const budgetMs = budgetSec * 1000;
  const pct = Math.min(100, (run.totalTimeMs / budgetMs) * 100);
  const overBudget = run.totalTimeMs > budgetMs;

  return (
    <div className="space-y-3">
      {run.check && run.check.images.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {run.check.images.map((im) => (
            <span key={im.index} className={`rounded-full px-2 py-0.5 ${im.verdict.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              img {im.index + 1}: {im.verdict.ok ? 'ok' : im.verdict.reason}{im.enhanced ? ' → enhanced' : ''}
            </span>
          ))}
        </div>
      )}

      {run.scout && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-studio-muted">Analysis:</span>
          <span className="rounded-full bg-studio-bluesoft px-2 py-0.5 text-studio-bluetext">{run.scout.subject}</span>
          <span className={`rounded-full px-2 py-0.5 ${DIFF_COLOR[run.scout.difficulty] || 'bg-studio-hover text-studio-muted'}`}>{run.scout.difficulty}</span>
          <span className="text-studio-faint">logic {run.scout.logicDepth} · {run.scout.type}</span>
        </div>
      )}

      {run.decision && (
        <div className="text-xs">
          <span className="font-medium text-studio-muted">Decision:</span> <span className="font-mono text-studio-text">{run.decision.model}</span>
          <span className="text-studio-faint"> — {run.decision.reason}</span>
          {run.decision.backupModel && <span className="text-studio-faint"> · backup: {run.decision.backupModel}</span>}
        </div>
      )}

      <div className="rounded-lg border border-studio-border bg-white p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-studio-muted">Answer</span>
          {typeof run.confidence === 'number' && <span className="text-[10px] text-studio-faint">conf {run.confidence.toFixed(2)}</span>}
        </div>
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[13px] leading-6 text-studio-text">
          {run.answer || <span className="text-studio-faint">(no answer)</span>}
        </div>
        {run.finalValue && <div className="mt-2 text-sm font-medium text-studio-text">Final answer: {run.finalValue}</div>}
      </div>

      {run.steps.length > 0 && <StepList steps={run.steps} />}

      <div className="flex items-center justify-between font-mono text-[11px] text-studio-faint">
        <span>
          total {run.totalTokens} tok · {run.totalTimeMs} ms{run.totalCost != null ? ` · ${fmtUsd(run.totalCost)}` : ''}
        </span>
        <span className={overBudget ? 'text-red-600' : 'text-emerald-600'}>
          {(run.totalTimeMs / 1000).toFixed(1)}s / {budgetSec}s
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-studio-hover">
        <div className={`h-full ${overBudget ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
      {run.error && <div className="text-xs text-red-600">{run.error}</div>}
    </div>
  );
};

const ROLE_LABEL: Record<string, string> = { analyze: 'analyze', answer: 'answer', backup: 'backup' };

export const StepList: React.FC<{ steps: RouterStep[] }> = ({ steps }) => (
  <div className="space-y-1">
    {steps.map((s, i) => (
      <div key={i} className="flex items-center gap-2 rounded-md bg-studio-surface px-2.5 py-1.5 text-[11px]">
        <span className="w-16 shrink-0 font-medium text-studio-muted">{ROLE_LABEL[s.role] || s.role}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-studio-text">{s.model}</span>
        {s.status === 'error' && !/cancelled/.test(s.note || '') && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />}
        <span className="shrink-0 font-mono text-studio-faint">
          {s.tokens != null ? `${s.tokens} tok · ` : ''}{s.latencyMs} ms{s.cost != null ? ` · ${fmtUsd(s.cost)}` : ''}
        </span>
        {s.note && <span className="max-w-[38%] shrink-0 truncate text-studio-faint">{s.note}</span>}
      </div>
    ))}
  </div>
);

// Small shared bits for the compare/scoreboard tables.
export const Badge: React.FC<{ children: React.ReactNode; cls?: string }> = ({ children, cls }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${cls || 'bg-studio-hover text-studio-muted'}`}>{children}</span>
);

export const UseAsScoutBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1 rounded-full border border-studio-border px-2 py-0.5 text-[10px] text-studio-text hover:bg-studio-hover">
    <Wand2 className="h-3 w-3" /> Use as Scout
  </button>
);
