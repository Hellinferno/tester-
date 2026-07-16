'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ImageIcon, Loader2, Mic, Play, Square, Upload, X } from 'lucide-react';
import { ModelInput } from './ModelInput';
import { ChatMessage, OrModel, chat, fileToAudio, fileToDataURL, pricingFor, usdCost, userMessage } from '../lib/openrouter';
import { getStored, setStored } from '../lib/settings';
import { activeBaseUrl, activeKey, fetchProviderModels, providerNotReady } from '../lib/providers';
import { useProvider } from '../lib/providerContext';
import { runPool } from '../lib/pool';
import { fmtUsd } from './RouterShared';

type Prompts = [string, string, string];
type CardResult = {
  status: 'idle' | 'running' | 'judging' | 'done' | 'error';
  text?: string;
  latencyMs?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cost?: number;
  accuracy?: number | null; // number = score; null = judge failed; undefined = not judged
  error?: string;
};

const LABELS = ['A', 'B', 'C'];

const JUDGE_SYSTEM =
  'You are a strict grader. Compare a model ANSWER to the reference EXPECTED answer and rate how well ANSWER matches the MEANING of EXPECTED (semantic correctness, not wording). Reply with ONLY an integer from 0 to 100 — 100 = fully correct / semantically identical, 0 = completely wrong. No words, no percent sign, no explanation.';

function parseScore(text: string): number | null {
  const m = text?.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const idle: CardResult[] = [{ status: 'idle' }, { status: 'idle' }, { status: 'idle' }];

export const PromptTesterView: React.FC = () => {
  const { provider } = useProvider();
  const [model, setModel] = useState('');
  const [prompts, setPrompts] = useState<Prompts>(['', '', '']);
  const [activePrompt, setActivePrompt] = useState(0);
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [thinkingBudget, setThinkingBudget] = useState(0);
  const [expected, setExpected] = useState('');
  const [results, setResults] = useState<CardResult[]>(idle);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [modelList, setModelList] = useState<OrModel[]>([]);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const expectedFileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModel(getStored('or.prompttester.model', ''));
    setPrompts(getStored<Prompts>('or.prompttester.prompts', ['', '', '']));
    setThinkingBudget(getStored('or.prompttester.budget', 0));
    setExpected(getStored('or.prompttester.expected', ''));
  }, []);
  useEffect(() => setStored('or.prompttester.model', model), [model]);
  useEffect(() => setStored('or.prompttester.prompts', prompts), [prompts]);
  useEffect(() => setStored('or.prompttester.budget', thinkingBudget), [thinkingBudget]);
  useEffect(() => setStored('or.prompttester.expected', expected), [expected]);
  useEffect(() => {
    fetchProviderModels(provider).then(setModelList);
  }, [provider]);

  const setPrompt = (i: number, v: string) => setPrompts((p) => { const n = [...p] as Prompts; n[i] = v; return n; });
  const patch = (i: number, p: Partial<CardResult>) => setResults((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...p } : c)));

  const runAll = async () => {
    setError('');
    const notReady = providerNotReady(provider);
    if (notReady) return setError(notReady);
    const apiKey = activeKey(provider);
    const baseUrl = activeBaseUrl(provider);
    if (!model.trim()) return setError('Pick a model first.');
    const hasQuery = !!query.trim() || images.length > 0 || !!audio;
    if (!hasQuery) return setError('Enter a query — text, image, or voice.');

    // Build the shared multimodal user message once (identical across all 3 runs).
    const imageDataUrls = await Promise.all(images.map(fileToDataURL));
    const audioPart = audio ? await fileToAudio(audio) : undefined;
    const userMsg = userMessage(query, imageDataUrls, audioPart);

    stopRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResults([{ status: 'running' }, { status: 'running' }, { status: 'running' }]);
    const pricing = pricingFor(modelList, model);
    const wantJudge = !!expected.trim();

    await runPool([0, 1, 2], 3, async (i) => {
      if (stopRef.current) return;
      const sys = prompts[i].trim();
      const messages: ChatMessage[] = sys ? [{ role: 'system', content: sys }, userMsg] : [userMsg];

      const r = await chat({
        model,
        apiKey,
        provider,
        baseUrl,
        temperature: 0.7,
        thinkingBudget,
        timeoutMs: 120_000,
        signal: controller.signal,
        messages,
      });
      const answerCost = pricing ? usdCost(r.usage, pricing) : undefined;
      patch(i, {
        status: r.error ? 'error' : wantJudge ? 'judging' : 'done',
        text: r.text,
        error: r.error,
        latencyMs: r.latencyMs,
        totalTokens: r.usage?.total_tokens,
        reasoningTokens: r.usage?.reasoning_tokens,
        cost: answerCost,
      });
      if (r.error || !wantJudge || stopRef.current) return;

      // Judge this answer against the expected answer (same model, cheap call).
      const jr = await chat({
        model,
        apiKey,
        provider,
        baseUrl,
        temperature: 0,
        maxTokens: 16,
        timeoutMs: 60_000,
        signal: controller.signal,
        messages: [
          { role: 'system', content: JUDGE_SYSTEM },
          userMessage(`EXPECTED:\n${expected}\n\nANSWER:\n${r.text}\n\nScore (0-100):`),
        ],
      });
      const judgeCost = pricing ? usdCost(jr.usage, pricing) : undefined;
      patch(i, {
        status: 'done',
        accuracy: jr.error ? null : parseScore(jr.text),
        cost: answerCost != null || judgeCost != null ? (answerCost ?? 0) + (judgeCost ?? 0) : undefined,
      });
    });
    setRunning(false);
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-studio-canvas">
      <header className="flex items-center justify-between border-b border-studio-line px-6 py-[13px]">
        <div className="font-display text-[15px] font-medium">Prompt tester</div>
        {running ? (
          <button onClick={() => { stopRef.current = true; abortRef.current?.abort(); }} className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700">
            <Square className="h-3.5 w-3.5" /> Stop
          </button>
        ) : (
          <button onClick={runAll} className="flex items-center gap-1.5 rounded-full bg-studio-blue px-4 py-1.5 text-xs font-medium text-white hover:bg-studio-bluehover">
            <Play className="h-3.5 w-3.5" /> Run
          </button>
        )}
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <p className="mb-4 text-xs text-studio-faint">
          One model, one query, <strong>three system prompts</strong> — see how each shapes the answer, with latency, tokens, cost, and accuracy vs your answer key.
        </p>

        <div className="mb-4 rounded-xl border border-studio-border bg-studio-surface p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-studio-muted">Model (used for all 3 prompts)</label>
              <ModelInput value={model} onChange={setModel} showVisionToggle />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-studio-muted">Thinking budget (0 = model default)</label>
              <input
                type="number"
                min={0}
                step={128}
                value={thinkingBudget}
                onChange={(e) => setThinkingBudget(Math.max(0, Number(e.target.value)))}
                title="Reasoning token budget. Anthropic accepts 1024–128000; Gemini caps vary by model; ignored by models without reasoning."
                className="w-full rounded-lg border border-studio-border bg-white px-3 py-2.5 text-sm text-studio-text focus:border-studio-blue focus:outline-none"
              />
            </div>
          </div>

          {/* 3 system-prompt tabs */}
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5">
              {LABELS.map((lbl, i) => (
                <button
                  key={i}
                  onClick={() => setActivePrompt(i)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${activePrompt === i ? 'bg-studio-bluesoft font-medium text-studio-bluetext' : 'text-studio-muted hover:bg-studio-hover'}`}
                >
                  Prompt {lbl}
                  {prompts[i].trim() && <Check className="h-3 w-3 text-emerald-600" />}
                </button>
              ))}
            </div>
            <textarea
              value={prompts[activePrompt]}
              onChange={(e) => setPrompt(activePrompt, e.target.value)}
              rows={5}
              placeholder={`System prompt ${LABELS[activePrompt]} (leave blank to test with no system prompt)`}
              className="w-full resize-none rounded-lg border border-studio-border bg-white px-3 py-2 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none"
            />
          </div>

          {/* expected answer */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-studio-muted">Expected answer (optional — drives accuracy %)</label>
              <button onClick={() => expectedFileInput.current?.click()} className="flex items-center gap-1 rounded-full border border-studio-border px-2.5 py-1 text-[11px] text-studio-text hover:bg-studio-hover">
                <Upload className="h-3 w-3" /> Upload .txt/.md
              </button>
            </div>
            <textarea
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              rows={2}
              placeholder="Paste the correct answer, or upload a file. Leave blank to skip accuracy scoring."
              className="w-full resize-none rounded-lg border border-studio-border bg-white px-3 py-2 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none"
            />
          </div>
        </div>

        {/* query composer */}
        <div className="mb-6 rounded-xl border border-studio-border bg-white p-4">
          <label className="mb-1.5 block text-xs font-medium text-studio-muted">Query (same for all 3)</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!running) runAll(); } }}
            rows={2}
            placeholder="Type the question, or leave blank and attach an image / voice…"
            className="w-full resize-none rounded-lg border border-studio-border bg-white px-3 py-2 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none"
          />
          {(images.length > 0 || audio) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((img, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-surface px-2.5 py-1 text-xs">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span className="max-w-[140px] truncate">{img.name}</span>
                  <button onClick={() => setImages(images.filter((_, x) => x !== i))} className="text-studio-muted hover:text-studio-text">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {audio && (
                <span className="flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-surface px-2.5 py-1 text-xs">
                  <Mic className="h-3.5 w-3.5" />
                  <span className="max-w-[140px] truncate">{audio.name}</span>
                  <button onClick={() => setAudio(null)} className="text-studio-muted hover:text-studio-text">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => imageInput.current?.click()} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <ImageIcon className="h-3.5 w-3.5" /> Images
            </button>
            <button onClick={() => audioInput.current?.click()} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <Mic className="h-3.5 w-3.5" /> Voice
            </button>
            <span className="text-[11px] text-studio-faint">Ctrl/Cmd+Enter to run</span>
          </div>
        </div>

        {/* results */}
        <div className="grid gap-3 md:grid-cols-3">
          {results.map((c, i) => (
            <div key={i} className="rounded-lg border border-studio-border bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-studio-muted">Prompt {LABELS[i]}</span>
                <StatusDot status={c.status} />
              </div>
              <div className="max-h-72 min-h-[3rem] overflow-y-auto whitespace-pre-wrap text-[13px] leading-6 text-studio-text">
                {c.status === 'idle' && <span className="text-studio-faint">Not run yet</span>}
                {c.status === 'running' && <span className="flex items-center gap-2 text-studio-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</span>}
                {c.status === 'error' && <span className="text-red-600">{c.error}</span>}
                {(c.status === 'judging' || c.status === 'done') && (c.text || <span className="text-studio-faint">(no answer)</span>)}
              </div>
              {(c.status === 'judging' || c.status === 'done') && (
                <div className="mt-2 font-mono text-[11px] text-studio-faint">
                  {c.totalTokens != null ? `${c.totalTokens} tok · ` : ''}{c.latencyMs} ms
                  {c.reasoningTokens ? ` · ${c.reasoningTokens} think` : ''}
                  {c.cost != null ? ` · ${fmtUsd(c.cost)}` : ''}
                </div>
              )}
              {expected.trim() && (c.status === 'judging' || c.status === 'done') && (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-studio-muted">
                    <span>Accuracy</span>
                    <span>{c.status === 'judging' ? '…' : c.accuracy == null ? '—' : `${c.accuracy}%`}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-studio-hover">
                    <div className="h-full bg-emerald-500" style={{ width: `${c.accuracy ?? 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) setImages((prev) => [...prev, ...Array.from(e.target.files!)]); e.currentTarget.value = ''; }} />
      <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => { setAudio(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
      <input ref={expectedFileInput} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setExpected(await f.text()); e.currentTarget.value = ''; }} />
    </section>
  );
};

const StatusDot: React.FC<{ status: CardResult['status'] }> = ({ status }) => {
  if (status === 'idle') return <span className="h-2 w-2 rounded-full bg-[#c4c7c5]" />;
  if (status === 'running' || status === 'judging') return <Loader2 className="h-3.5 w-3.5 animate-spin text-studio-blue" />;
  if (status === 'error') return <X className="h-3.5 w-3.5 text-red-600" />;
  return <Check className="h-3.5 w-3.5 text-emerald-600" />;
};
