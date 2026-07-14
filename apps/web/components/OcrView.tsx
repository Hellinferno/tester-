'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Play, Plus, Square, X } from 'lucide-react';
import { ModelInput } from './ModelInput';
import {
  OCR_INSTRUCTION,
  OrModel,
  chat,
  fetchModelsCached,
  fileToDataURL,
  pricingFor,
  usdCost,
  userMessage,
} from '../lib/openrouter';
import { fetchGeminiModels } from '../lib/gemini';
import { getGeminiKey, getOpenRouterKey, getStored, setStored } from '../lib/settings';
import { useProvider } from '../lib/providerContext';

type OcrItem = {
  id: string;
  file: File;
  dataUrl: string;
  status: 'idle' | 'running' | 'done' | 'error';
  text?: string;
  error?: string;
  tokens?: number;
  latencyMs?: number;
  cost?: number;
};

let idSeq = 0;
const fmtUsd = (c: number) => '$' + c.toFixed(c >= 0.01 ? 4 : 6);

export const OcrView: React.FC = () => {
  const { provider } = useProvider();
  const [model, setModel] = useState('');
  const [instruction, setInstruction] = useState(OCR_INSTRUCTION);
  const [maxTokens, setMaxTokens] = useState(0);
  const [items, setItems] = useState<OcrItem[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [modelList, setModelList] = useState<OrModel[]>([]);
  const [copiedId, setCopiedId] = useState('');
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModel(getStored('or.ocr.model', ''));
    setMaxTokens(getStored('or.ocr.maxtok', 0));
  }, []);
  useEffect(() => setStored('or.ocr.model', model), [model]);
  useEffect(() => setStored('or.ocr.maxtok', maxTokens), [maxTokens]);
  useEffect(() => {
    (provider === 'gemini' ? fetchGeminiModels(getGeminiKey()) : fetchModelsCached()).then(setModelList);
  }, [provider]);

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const added: OcrItem[] = [];
    for (const file of Array.from(files)) {
      added.push({ id: `ocr-${++idSeq}`, file, dataUrl: await fileToDataURL(file), status: 'idle' });
    }
    setItems((prev) => [...prev, ...added]);
  };

  const patch = (id: string, p: Partial<OcrItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const runAll = async () => {
    setError('');
    const apiKey = provider === 'gemini' ? getGeminiKey() : getOpenRouterKey();
    if (!apiKey) return setError(`Add your ${provider === 'gemini' ? 'Gemini' : 'OpenRouter'} key in the sidebar first.`);
    if (!model.trim()) return setError('Pick a vision model first.');
    if (!items.length) return setError('Add at least one image.');

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
        temperature: 0,
        maxTokens,
        timeoutMs: 90_000,
        signal: controller.signal,
        messages: [userMessage(instruction, item.dataUrl)],
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
        <div className="font-display text-[15px] font-medium">OCR — image to text</div>
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
              <label className="mb-1.5 block text-xs font-medium text-studio-muted">Model (vision)</label>
              <ModelInput value={model} onChange={setModel} showVisionToggle />
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
          <h3 className="text-xs font-medium text-studio-muted">Images ({items.length})</h3>
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover"
          >
            <Plus className="h-3.5 w-3.5" /> Add images
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.currentTarget.value = ''; }} />
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-studio-border py-12 text-center text-sm text-studio-faint">
            Add images, pick a vision model, then Run all to extract their text.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="flex gap-3 rounded-xl border border-studio-border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.dataUrl} alt={it.file.name} className="h-24 w-24 shrink-0 rounded-lg object-cover ring-1 ring-studio-border" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-studio-muted">{it.file.name}</span>
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
                          title="Copy extracted text"
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
                      <span className="flex items-center gap-2 text-studio-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading…</span>
                    )}
                    {it.status === 'error' && <span className="text-red-600">{it.error}</span>}
                    {it.status === 'done' && (it.text || '(no text found)')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
