'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, FolderOpen, ImageIcon, Loader2, Mic, Play, Plus, Square, X } from 'lucide-react';
import { ModelInput } from './ModelInput';
import { StageBlock } from './StageBlock';
import { fileToAudio, fileToDataURL, modelInputs, OrModel, PipelineResult, pricingFor, runPipeline } from '../lib/openrouter';
import { getStored, setStored } from '../lib/settings';
import { activeBaseUrl, activeKey, fetchProviderModels, providerNotReady } from '../lib/providers';
import { useProvider } from '../lib/providerContext';

type EvalImage = { name: string; dataUrl: string };
type EvalVoice = { name: string; data: string; format: string };
type EvalInput = { id: string; images: EvalImage[]; voice: EvalVoice | null; prompt: string };
type Cell = { status: 'idle' | 'running' | 'done' | 'error'; result?: PipelineResult };
type Results = Record<string, Record<string, Cell>>;

let idSeq = 0;

const fmtUsd = (c: number) => '$' + c.toFixed(c >= 0.01 ? 4 : 6);

export const EvalsConsole: React.FC = () => {
  const { provider } = useProvider();
  const [models, setModels] = useState<string[]>([]);
  const [modelDraft, setModelDraft] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [timeoutSec, setTimeoutSec] = useState(90);
  const [maxTokens, setMaxTokens] = useState(0);
  const [webSearch, setWebSearch] = useState(false);
  const [inputs, setInputs] = useState<EvalInput[]>([]);
  const [results, setResults] = useState<Results>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [totalCost, setTotalCost] = useState(0);
  const [error, setError] = useState('');
  const [modelList, setModelList] = useState<OrModel[]>([]);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const bulkInput = useRef<HTMLInputElement>(null);
  const itemImageInput = useRef<HTMLInputElement>(null);
  const itemVoiceInput = useRef<HTMLInputElement>(null);
  const datasetInput = useRef<HTMLInputElement>(null);
  const targetItem = useRef<string>('');

  useEffect(() => {
    setModels(getStored('or.eval.models', []));
    setTemperature(getStored('or.eval.temp', 0.2));
    setTimeoutSec(getStored('or.eval.timeout', 90));
    setMaxTokens(getStored('or.eval.maxtok', 0));
    setWebSearch(getStored('or.eval.web', false));
  }, []);
  useEffect(() => {
    fetchProviderModels(provider).then(setModelList);
  }, [provider]);
  useEffect(() => setStored('or.eval.models', models), [models]);
  useEffect(() => setStored('or.eval.temp', temperature), [temperature]);
  useEffect(() => setStored('or.eval.timeout', timeoutSec), [timeoutSec]);
  useEffect(() => setStored('or.eval.maxtok', maxTokens), [maxTokens]);
  useEffect(() => setStored('or.eval.web', webSearch), [webSearch]);

  const updateItem = (id: string, patch: Partial<EvalInput>) =>
    setInputs((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addBlankInput = () => setInputs((prev) => [...prev, { id: `in-${++idSeq}`, images: [], voice: null, prompt: '' }]);

  const addBulkImages = async (files: FileList | null) => {
    if (!files) return;
    const items: EvalInput[] = [];
    for (const file of Array.from(files)) {
      items.push({ id: `in-${++idSeq}`, images: [{ name: file.name, dataUrl: await fileToDataURL(file) }], voice: null, prompt: '' });
    }
    setInputs((prev) => [...prev, ...items]);
  };

  const addImagesToTarget = async (files: FileList | null) => {
    const id = targetItem.current;
    if (!files || !id) return;
    const imgs: EvalImage[] = [];
    for (const file of Array.from(files)) imgs.push({ name: file.name, dataUrl: await fileToDataURL(file) });
    setInputs((prev) => prev.map((it) => (it.id === id ? { ...it, images: [...it.images, ...imgs] } : it)));
  };

  const setVoiceForTarget = async (file: File | null) => {
    const id = targetItem.current;
    if (!id) return;
    updateItem(id, { voice: file ? { name: file.name, ...(await fileToAudio(file)) } : null });
  };

  const addModel = () => {
    const m = modelDraft.trim();
    if (m && !models.includes(m)) setModels([...models, m]);
    setModelDraft('');
  };

  const setCell = (inputId: string, model: string, cell: Cell) =>
    setResults((prev) => ({ ...prev, [inputId]: { ...prev[inputId], [model]: cell } }));

  const hasImageInputs = inputs.some((i) => i.images.length > 0);
  const hasVoiceInputs = inputs.some((i) => i.voice);

  const runAll = async () => {
    setError('');
    const notReady = providerNotReady(provider);
    if (notReady) return setError(notReady);
    const apiKey = activeKey(provider);
    const baseUrl = activeBaseUrl(provider);
    if (!models.length) return setError('Add at least one model to compare.');
    if (!inputs.length) return setError('Add at least one input.');

    stopRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResults({});
    setTotalCost(0);
    const total = inputs.length * models.length;
    const timeoutMs = timeoutSec > 0 ? timeoutSec * 1000 : undefined;
    let done = 0;
    let cost = 0;

    outer: for (const input of inputs) {
      const audioPart = input.voice ? { data: input.voice.data, format: input.voice.format } : undefined;
      const imageUrls = input.images.map((i) => i.dataUrl);
      for (const model of models) {
        if (stopRef.current) break outer;
        setCell(input.id, model, { status: 'running' });
        setProgress(`${done + 1} / ${total}`);
        const result = await runPipeline({
          model,
          apiKey,
          provider,
          baseUrl,
          temperature,
          webSearch,
          prompt: input.prompt,
          images: imageUrls,
          audio: audioPart,
          pricing: pricingFor(modelList, model),
          maxTokens,
          signal: controller.signal,
          timeoutMs,
        });
        setCell(input.id, model, { status: result.error ? 'error' : 'done', result });
        cost += result.totalCost || 0;
        setTotalCost(cost);
        done++;
      }
    }
    setRunning(false);
    setProgress('');
  };

  const download = (name: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadDataset = async (file: File | null) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (Array.isArray(data.models)) setModels(data.models);
      if (typeof data.temperature === 'number') setTemperature(data.temperature);
      if (typeof data.timeoutSec === 'number') setTimeoutSec(data.timeoutSec);
      if (typeof data.webSearch === 'boolean') setWebSearch(data.webSearch);
      if (Array.isArray(data.inputs)) {
        setInputs(
          data.inputs.map((it: EvalInput) => ({
            id: `in-${++idSeq}`,
            images: it.images || [],
            voice: it.voice || null,
            prompt: it.prompt || '',
          })),
        );
        setResults({});
      }
    } catch (e) {
      setError('Could not read that dataset file.');
    }
  };

  const exportJson = () => {
    const payload = inputs.map((inp) => ({
      images: inp.images.map((i) => i.name),
      voice: inp.voice?.name || null,
      prompt: inp.prompt,
      results: models.map((m) => {
        const cell = results[inp.id]?.[m];
        return {
          model: m,
          status: cell?.status,
          stages: cell?.result?.stages,
          totalTokens: cell?.result?.totalTokens,
          totalLatencyMs: cell?.result?.totalLatencyMs,
          totalCostUsd: cell?.result?.totalCost,
        };
      }),
    }));
    download('evals.json', JSON.stringify(payload, null, 2), 'application/json');
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['input', 'images', 'voice', 'prompt', 'model', 'status', 'ocr_read', 'stt_transcript', 'answer', 'total_tokens', 'total_ms', 'cost_usd'];
    const rows = [header.map(esc).join(',')];
    inputs.forEach((inp, i) => {
      models.forEach((m) => {
        const cell = results[inp.id]?.[m];
        const stages = cell?.result?.stages || [];
        const ocr = stages.filter((s) => s.name === 'ocr').map((s) => s.text).join('\n---\n');
        const stt = stages.filter((s) => s.name === 'stt').map((s) => s.text).join('\n');
        const answer = stages.find((s) => s.name === 'answer')?.text || '';
        rows.push(
          [i + 1, inp.images.map((x) => x.name).join('; '), inp.voice?.name || '', inp.prompt, m, cell?.status || '', ocr, stt, answer, cell?.result?.totalTokens ?? '', cell?.result?.totalLatencyMs ?? '', cell?.result?.totalCost ?? '']
            .map(esc)
            .join(','),
        );
      });
    });
    download('evals.csv', rows.join('\n'), 'text/csv;charset=utf-8');
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-studio-canvas">
      <header className="flex items-center justify-between border-b border-studio-line px-6 py-[13px]">
        <div className="font-display text-[15px] font-medium">Evals</div>
        <div className="flex items-center gap-2">
          {totalCost > 0 && <span className="font-mono text-xs text-studio-muted">est. {fmtUsd(totalCost)}</span>}
          {progress && <span className="text-xs text-studio-muted">{progress}</span>}
          <button onClick={exportCsv} disabled={!inputs.length} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={exportJson} disabled={!inputs.length} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> JSON
          </button>
          {running ? (
            <button onClick={() => { stopRef.current = true; abortRef.current?.abort(); }} className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700">
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button onClick={runAll} className="flex items-center gap-1.5 rounded-full bg-studio-blue px-4 py-1.5 text-xs font-medium text-white hover:bg-studio-bluehover">
              <Play className="h-3.5 w-3.5" /> Run all
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        {/* config */}
        <div className="mb-6 rounded-xl border border-studio-border bg-studio-surface p-4">
          <label className="mb-1.5 block text-xs font-medium text-studio-muted">Models to compare</label>
          <div className="flex flex-wrap items-center gap-2">
            {models.map((m) => {
              const caps = modelInputs(modelList, m);
              const missing: string[] = [];
              if (hasImageInputs && caps && !caps.includes('image')) missing.push('image');
              if (hasVoiceInputs && caps && !caps.includes('audio')) missing.push('audio');
              return (
                <span key={m} className="flex items-center gap-1.5 rounded-full bg-studio-bluesoft px-3 py-1 text-xs text-studio-bluetext">
                  {m}
                  {missing.length > 0 && (
                    <span title={`No ${missing.join(' / ')} input — pick a ${missing.join('/')}-capable model`} className="flex">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    </span>
                  )}
                  <button onClick={() => setModels(models.filter((x) => x !== m))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
          <div className="mt-2 flex items-start gap-2">
            <div className="flex-1">
              <ModelInput value={modelDraft} onChange={setModelDraft} onEnter={addModel} placeholder="Add a model to compare…" showVisionToggle />
            </div>
            <button onClick={addModel} className="flex items-center gap-1 rounded-lg bg-studio-blue px-3 py-2.5 text-sm text-white hover:bg-studio-bluehover">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-xs text-studio-muted">
              Temperature
              <input type="number" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(Math.min(2, Math.max(0, Number(e.target.value))))} className="w-14 rounded-md border border-studio-border bg-white px-2 py-1 text-right text-sm text-studio-text focus:border-studio-blue focus:outline-none" />
            </label>
            <label className="flex items-center gap-2 text-xs text-studio-muted">
              Timeout (s)
              <input type="number" min={0} step={5} value={timeoutSec} onChange={(e) => setTimeoutSec(Math.max(0, Number(e.target.value)))} className="w-16 rounded-md border border-studio-border bg-white px-2 py-1 text-right text-sm text-studio-text focus:border-studio-blue focus:outline-none" />
            </label>
            <label className="flex items-center gap-2 text-xs text-studio-muted" title="Caps output tokens. 0 = model default. Lower it if you hit a credits limit.">
              Max tokens
              <input type="number" min={0} step={256} value={maxTokens} onChange={(e) => setMaxTokens(Math.max(0, Number(e.target.value)))} className="w-20 rounded-md border border-studio-border bg-white px-2 py-1 text-right text-sm text-studio-text focus:border-studio-blue focus:outline-none" />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-studio-muted">
              <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} className="h-3.5 w-3.5 accent-studio-blue" />
              Web search
            </label>
          </div>
        </div>

        {/* inputs toolbar */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium text-studio-muted">Dataset — inputs ({inputs.length})</h3>
          <div className="flex gap-2">
            <button onClick={() => datasetInput.current?.click()} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <FolderOpen className="h-3.5 w-3.5" /> Load
            </button>
            <button onClick={addBlankInput} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <Plus className="h-3.5 w-3.5" /> Add input
            </button>
            <button onClick={() => bulkInput.current?.click()} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <ImageIcon className="h-3.5 w-3.5" /> Bulk images
            </button>
          </div>
        </div>

        {inputs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-studio-border py-12 text-center text-sm text-studio-faint">
            Each input can be image(s), text, voice, or all. Add inputs (or Load a saved dataset), pick models, then Run all.
          </div>
        ) : (
          <div className="space-y-4">
            {inputs.map((inp, idx) => (
              <div key={inp.id} className="rounded-xl border border-studio-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-studio-muted">Input {idx + 1}</span>
                  <button onClick={() => setInputs(inputs.filter((x) => x.id !== inp.id))} className="text-studio-muted hover:text-studio-text">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {inp.images.map((im, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.dataUrl} alt={im.name} className="h-16 w-16 rounded-lg object-cover" />
                      <button
                        onClick={() => updateItem(inp.id, { images: inp.images.filter((_, x) => x !== i) })}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-studio-muted shadow ring-1 ring-studio-border hover:text-studio-text"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => { targetItem.current = inp.id; itemImageInput.current?.click(); }}
                    className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-studio-border text-studio-muted hover:bg-studio-hover"
                    title="Add image(s)"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-2 flex items-center gap-2">
                  {inp.voice ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-surface px-3 py-1 text-xs">
                      <Mic className="h-3.5 w-3.5" /> {inp.voice.name}
                      <button onClick={() => updateItem(inp.id, { voice: null })} className="text-studio-muted hover:text-studio-text">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => { targetItem.current = inp.id; itemVoiceInput.current?.click(); }}
                      className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover"
                    >
                      <Mic className="h-3.5 w-3.5" /> Add voice
                    </button>
                  )}
                </div>
                <textarea
                  value={inp.prompt}
                  onChange={(e) => updateItem(inp.id, { prompt: e.target.value })}
                  rows={2}
                  placeholder="Prompt / text for this input (e.g. Extract all text, or a question)"
                  className="w-full resize-none rounded-lg border border-studio-border bg-white px-3 py-2 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none"
                />

                {models.length > 0 && (
                  <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(models.length, 3)}, minmax(0, 1fr))` }}>
                    {models.map((m) => {
                      const cell = results[inp.id]?.[m];
                      return (
                        <div key={m} className="rounded-lg border border-studio-line bg-white p-2.5">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="truncate text-[11px] font-medium text-studio-muted">{m}</span>
                            <StatusDot cell={cell} />
                          </div>
                          {!cell && <span className="text-xs text-studio-faint">—</span>}
                          {cell?.status === 'running' && <span className="text-xs text-studio-muted">running…</span>}
                          {cell?.result && (
                            <div className="space-y-2">
                              {(() => {
                                let oi = 0;
                                return cell.result.stages.map((s, si) => {
                                  const thumb = s.name === 'ocr' ? inp.images[oi++]?.dataUrl : undefined;
                                  return <StageBlock key={si} stage={s} muted={s.name !== 'answer'} thumb={thumb} />;
                                });
                              })()}
                              <div className="font-mono text-[10px] text-studio-faint">
                                total {cell.result.totalTokens} tok · {cell.result.totalLatencyMs} ms
                                {cell.result.totalCost != null ? ` · ${fmtUsd(cell.result.totalCost)}` : ''}
                              </div>
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

      {/* hidden inputs */}
      <input ref={bulkInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addBulkImages(e.target.files); e.currentTarget.value = ''; }} />
      <input ref={itemImageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addImagesToTarget(e.target.files); e.currentTarget.value = ''; }} />
      <input ref={itemVoiceInput} type="file" accept="audio/*" hidden onChange={(e) => { setVoiceForTarget(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
      <input ref={datasetInput} type="file" accept="application/json,.json" hidden onChange={(e) => { loadDataset(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
    </section>
  );
};

const StatusDot: React.FC<{ cell?: Cell }> = ({ cell }) => {
  if (!cell || cell.status === 'idle') return <span className="h-2 w-2 rounded-full bg-[#c4c7c5]" />;
  if (cell.status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-studio-blue" />;
  if (cell.status === 'error') return <X className="h-3.5 w-3.5 text-red-600" />;
  return <Check className="h-3.5 w-3.5 text-emerald-600" />;
};
