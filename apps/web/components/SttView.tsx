'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Mic, Play, Plus, Square, X } from 'lucide-react';
import { ModelInput } from './ModelInput';
import { STT_INSTRUCTION, OrModel, chat, fileToAudio, pricingFor, usdCost, userMessage } from '../lib/openrouter';
import { getStored, setStored } from '../lib/settings';
import { activeBaseUrl, activeKey, fetchProviderModels, providerNotReady } from '../lib/providers';
import { useProvider } from '../lib/providerContext';

type SttItem = {
  id: string;
  file: File;
  audio: { data: string; format: string };
  status: 'idle' | 'running' | 'done' | 'error';
  text?: string;
  error?: string;
  tokens?: number;
  latencyMs?: number;
  cost?: number;
};

let idSeq = 0;
const fmtUsd = (c: number) => '$' + c.toFixed(c >= 0.01 ? 4 : 6);

export const SttView: React.FC = () => {
  const { provider } = useProvider();
  const [model, setModel] = useState('');
  const [instruction, setInstruction] = useState(STT_INSTRUCTION);
  const [maxTokens, setMaxTokens] = useState(0);
  const [items, setItems] = useState<SttItem[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [modelList, setModelList] = useState<OrModel[]>([]);
  const [copiedId, setCopiedId] = useState('');
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModel(getStored('or.stt.model', ''));
    setMaxTokens(getStored('or.stt.maxtok', 0));
  }, []);
  useEffect(() => setStored('or.stt.model', model), [model]);
  useEffect(() => setStored('or.stt.maxtok', maxTokens), [maxTokens]);
  useEffect(() => {
    fetchProviderModels(provider).then(setModelList);
  }, [provider]);

  const addAudio = async (files: FileList | null) => {
    if (!files) return;
    const added: SttItem[] = [];
    for (const file of Array.from(files)) {
      added.push({ id: `stt-${++idSeq}`, file, audio: await fileToAudio(file), status: 'idle' });
    }
    setItems((prev) => [...prev, ...added]);
  };

  const patch = (id: string, p: Partial<SttItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const runAll = async () => {
    setError('');
    const notReady = providerNotReady(provider);
    if (notReady) return setError(notReady);
    const apiKey = activeKey(provider);
    const baseUrl = activeBaseUrl(provider);
    if (!model.trim()) return setError('Pick an audio-capable model first.');
    if (!items.length) return setError('Add at least one audio file.');

    stopRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    const pricing = pricingFor(modelList, model);

    for (const item of items) {
      if (stopRef.current) break;
      patch(item.id, { status: 'running', text: undefined, error: undefined });
      const r = await chat({
        model,
        apiKey,
        provider,
        baseUrl,
        temperature: 0,
        maxTokens,
        timeoutMs: 120_000,
        signal: controller.signal,
        messages: [userMessage(instruction, undefined, item.audio)],
      });
      patch(item.id, {
        status: r.error ? 'error' : 'done',
        text: r.text,
        error: r.error,
        tokens: r.usage?.total_tokens,
        latencyMs: r.latencyMs,
        cost: pricing ? usdCost(r.usage, pricing) : undefined,
      });
    }
    setRunning(false);
  };

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-studio-canvas">
      <header className="flex items-center justify-between border-b border-studio-line px-6 py-[13px]">
        <div className="font-display text-[15px] font-medium">STT — audio to text</div>
        {running ? (
          <button
            onClick={() => { stopRef.current = true; abortRef.current?.abort(); }}
            className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            <Square className="h-3.5 w-3.5" /> Stop
          </button>
        ) : (
          <button
            onClick={runAll}
            className="flex items-center gap-1.5 rounded-full bg-studio-blue px-4 py-1.5 text-xs font-medium text-white hover:bg-studio-bluehover"
          >
            <Play className="h-3.5 w-3.5" /> Run all
          </button>
        )}
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <div className="mb-6 rounded-xl border border-studio-border bg-studio-surface p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-studio-muted">Model (audio-capable)</label>
              <ModelInput value={model} onChange={setModel} />
              <p className="mt-1.5 text-xs text-studio-faint">Needs an audio-input model — Gemini models work best.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-studio-muted">Max tokens (0 = default)</label>
              <input
                type="number"
                min={0}
                step={256}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border border-studio-border bg-white px-3 py-2.5 text-sm text-studio-text focus:border-studio-blue focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium text-studio-muted">Instruction</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-studio-border bg-white px-3 py-2 text-sm text-studio-text focus:border-studio-blue focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium text-studio-muted">Audio files ({items.length})</h3>
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover"
          >
            <Plus className="h-3.5 w-3.5" /> Add audio
          </button>
          <input ref={fileInput} type="file" accept="audio/*" multiple hidden onChange={(e) => { addAudio(e.target.files); e.currentTarget.value = ''; }} />
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-studio-border py-12 text-center text-sm text-studio-faint">
            Add audio files, pick an audio-capable model, then Run all to transcribe them.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="rounded-xl border border-studio-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 truncate text-xs text-studio-muted">
                    <Mic className="h-3.5 w-3.5" /> {it.file.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {it.status === 'done' && (
                      <span className="font-mono text-[10px] text-studio-faint">
                        {it.tokens != null ? `${it.tokens} tok · ` : ''}{it.latencyMs} ms
                        {it.cost != null ? ` · ${fmtUsd(it.cost)}` : ''}
                      </span>
                    )}
                    {it.status === 'done' && it.text && (
                      <button
                        onClick={() => copyText(it.id, it.text!)}
                        title="Copy transcript"
                        className="grid h-7 w-7 place-items-center rounded-full text-studio-muted hover:bg-studio-hover"
                      >
                        {copiedId === it.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button onClick={() => setItems(items.filter((x) => x.id !== it.id))} className="text-studio-muted hover:text-studio-text">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-studio-surface p-2.5 text-[13px] leading-6 text-studio-text">
                  {it.status === 'idle' && <span className="text-studio-faint">Not run yet</span>}
                  {it.status === 'running' && (
                    <span className="flex items-center gap-2 text-studio-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribing…</span>
                  )}
                  {it.status === 'error' && <span className="text-red-600">{it.error}</span>}
                  {it.status === 'done' && (it.text || '(no transcript)')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
