'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2, Play, Plus, Square, X } from 'lucide-react';
import { ModelInput } from './ModelInput';
import { chat, fileToDataURL, userMessage } from '../lib/openrouter';
import { getOpenRouterKey, getStored, setStored } from '../lib/settings';

type EvalInput = { id: string; file: File; dataUrl: string; prompt: string };
type Cell = { status: 'idle' | 'running' | 'done' | 'error'; text?: string; error?: string; latencyMs?: number; tokens?: number };
type Results = Record<string, Record<string, Cell>>;

let idSeq = 0;

export const EvalsConsole: React.FC = () => {
  const [models, setModels] = useState<string[]>([]);
  const [modelDraft, setModelDraft] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [webSearch, setWebSearch] = useState(false);
  const [inputs, setInputs] = useState<EvalInput[]>([]);
  const [results, setResults] = useState<Results>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const stopRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setModels(getStored('or.eval.models', []));
    setTemperature(getStored('or.eval.temp', 0.2));
    setWebSearch(getStored('or.eval.web', false));
  }, []);
  useEffect(() => setStored('or.eval.models', models), [models]);
  useEffect(() => setStored('or.eval.temp', temperature), [temperature]);
  useEffect(() => setStored('or.eval.web', webSearch), [webSearch]);

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const added: EvalInput[] = [];
    for (const file of Array.from(files)) {
      added.push({ id: `in-${++idSeq}`, file, dataUrl: await fileToDataURL(file), prompt: '' });
    }
    setInputs((prev) => [...prev, ...added]);
  };

  const addModel = () => {
    const m = modelDraft.trim();
    if (m && !models.includes(m)) setModels([...models, m]);
    setModelDraft('');
  };

  const setCell = (inputId: string, model: string, cell: Cell) =>
    setResults((prev) => ({ ...prev, [inputId]: { ...prev[inputId], [model]: cell } }));

  const runAll = async () => {
    setError('');
    const apiKey = getOpenRouterKey();
    if (!apiKey) return setError('Add your OpenRouter key in the sidebar first.');
    if (!models.length) return setError('Add at least one model to compare.');
    if (!inputs.length) return setError('Add at least one image.');

    stopRef.current = false;
    setRunning(true);
    setResults({});
    const total = inputs.length * models.length;
    let done = 0;

    outer: for (const input of inputs) {
      for (const model of models) {
        if (stopRef.current) break outer;
        setCell(input.id, model, { status: 'running' });
        setProgress(`${done + 1} / ${total}`);
        const res = await chat({
          model,
          apiKey,
          temperature,
          webSearch,
          messages: [userMessage(input.prompt, input.dataUrl)],
        });
        setCell(
          input.id,
          model,
          res.error
            ? { status: 'error', error: res.error, latencyMs: res.latencyMs }
            : { status: 'done', text: res.text, latencyMs: res.latencyMs, tokens: res.usage?.total_tokens },
        );
        done++;
      }
    }
    setRunning(false);
    setProgress('');
  };

  const exportJson = () => {
    const payload = inputs.map((inp) => ({
      image: inp.file.name,
      prompt: inp.prompt,
      results: models.map((m) => ({ model: m, ...(results[inp.id]?.[m] || {}) })),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'evals.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-studio-canvas">
      <header className="flex items-center justify-between border-b border-studio-line px-6 py-[13px]">
        <div className="font-display text-[15px] font-medium">Evals</div>
        <div className="flex items-center gap-2">
          {progress && <span className="text-xs text-studio-muted">{progress}</span>}
          <button
            onClick={exportJson}
            disabled={!inputs.length}
            className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          {running ? (
            <button
              onClick={() => (stopRef.current = true)}
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
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        {/* config: models + temperature + web search */}
        <div className="mb-6 rounded-xl border border-studio-border bg-studio-surface p-4">
          <label className="mb-1.5 block text-xs font-medium text-studio-muted">Models to compare</label>
          <div className="flex flex-wrap items-center gap-2">
            {models.map((m) => (
              <span key={m} className="flex items-center gap-1.5 rounded-full bg-studio-bluesoft px-3 py-1 text-xs text-studio-bluetext">
                {m}
                <button onClick={() => setModels(models.filter((x) => x !== m))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <div className="flex-1">
              <ModelInput value={modelDraft} onChange={setModelDraft} onEnter={addModel} placeholder="Add a model to compare…" />
            </div>
            <button onClick={addModel} className="flex items-center gap-1 rounded-lg bg-studio-blue px-3 text-sm text-white hover:bg-studio-bluehover">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          <div className="mt-3 flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs text-studio-muted">
              Temperature
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Math.min(2, Math.max(0, Number(e.target.value))))}
                className="w-14 rounded-md border border-studio-border bg-white px-2 py-1 text-right text-sm text-studio-text focus:border-studio-blue focus:outline-none"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-studio-muted">
              <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} className="h-3.5 w-3.5 accent-studio-blue" />
              Web search
            </label>
          </div>
        </div>

        {/* inputs */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium text-studio-muted">Inputs ({inputs.length})</h3>
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover"
          >
            <Plus className="h-3.5 w-3.5" /> Add images
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
        </div>

        {inputs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-studio-border py-12 text-center text-sm text-studio-faint">
            Add images, give each its own prompt, pick models to compare, then Run all.
          </div>
        ) : (
          <div className="space-y-4">
            {inputs.map((inp) => (
              <div key={inp.id} className="rounded-xl border border-studio-border bg-white p-3">
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={inp.dataUrl} alt={inp.file.name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="truncate text-xs text-studio-muted">{inp.file.name}</span>
                      <button onClick={() => setInputs(inputs.filter((x) => x.id !== inp.id))} className="text-studio-muted hover:text-studio-text">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      value={inp.prompt}
                      onChange={(e) =>
                        setInputs(inputs.map((x) => (x.id === inp.id ? { ...x, prompt: e.target.value } : x)))
                      }
                      rows={2}
                      placeholder="Prompt for this image (e.g. Extract all text)"
                      className="w-full resize-none rounded-lg border border-studio-border bg-white px-3 py-2 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none"
                    />
                  </div>
                </div>

                {/* per-model results for this input */}
                {models.length > 0 && (
                  <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(models.length, 3)}, minmax(0, 1fr))` }}>
                    {models.map((m) => {
                      const cell = results[inp.id]?.[m];
                      return (
                        <div key={m} className="rounded-lg border border-studio-line bg-studio-surface p-2.5">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="truncate text-[11px] font-medium text-studio-muted">{m}</span>
                            <StatusDot cell={cell} />
                          </div>
                          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-studio-text">
                            {cell?.status === 'running' && <span className="text-studio-muted">running…</span>}
                            {cell?.status === 'error' && <span className="text-red-600">{cell.error}</span>}
                            {cell?.status === 'done' && (cell.text || '(empty)')}
                            {!cell && <span className="text-studio-faint">—</span>}
                          </div>
                          {cell?.status === 'done' && (
                            <div className="mt-1.5 flex gap-3 text-[10px] text-studio-faint">
                              <span>{cell.latencyMs} ms</span>
                              {cell.tokens != null && <span>{cell.tokens} tok</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const StatusDot: React.FC<{ cell?: Cell }> = ({ cell }) => {
  if (!cell || cell.status === 'idle') return <span className="h-2 w-2 rounded-full bg-[#c4c7c5]" />;
  if (cell.status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-studio-blue" />;
  if (cell.status === 'error') return <X className="h-3.5 w-3.5 text-red-600" />;
  return <Check className="h-3.5 w-3.5 text-emerald-600" />;
};
