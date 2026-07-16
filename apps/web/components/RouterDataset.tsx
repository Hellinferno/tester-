'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Mic, Play, Plus, Square, Upload, X } from 'lucide-react';
import { ModelInput } from './ModelInput';
import { fileToAudio, fileToDataURL, OrModel } from '../lib/openrouter';
import { getStored, setStored } from '../lib/settings';
import { fetchProviderModels, providerNotReady } from '../lib/providers';
import { useProvider } from '../lib/providerContext';
import { runRouter, RouterRun } from '../lib/router';
import { runPool } from '../lib/pool';
import { assembleConfig, Badge, download, fmtUsd, SlotsBar, useRouterConfig } from './RouterShared';

type Img = { name: string; dataUrl: string };
type Voice = { name: string; data: string; format: string };
type Item = { id: string; images: Img[]; voice: Voice | null; prompt: string };
type Cell = { status: 'idle' | 'running' | 'done' | 'error'; run?: RouterRun };
type Results = Record<string, Record<string, Cell>>;

let idSeq = 0;
const AUTO = 'auto';

export const RouterDataset: React.FC<{ modeSwitch: React.ReactNode }> = ({ modeSwitch }) => {
  const { provider } = useProvider();
  const cfg = useRouterConfig();
  const [dataset, setDataset] = useState<Item[]>([]);
  const [compareModels, setCompareModels] = useState<string[]>([]);
  const [modelDraft, setModelDraft] = useState('');
  const [results, setResults] = useState<Results>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [modelList, setModelList] = useState<OrModel[]>([]);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const itemImageInput = useRef<HTMLInputElement>(null);
  const itemVoiceInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const targetItem = useRef<string>('');

  useEffect(() => setCompareModels(getStored('or.routerds.models', [])), []);
  useEffect(() => setStored('or.routerds.models', compareModels), [compareModels]);
  useEffect(() => {
    fetchProviderModels(provider).then(setModelList);
  }, [provider]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const cols = [AUTO, ...compareModels];

  const updateItem = (id: string, patch: Partial<Item>) => setDataset((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addBlank = () => setDataset((prev) => [...prev, { id: `rd-${++idSeq}`, images: [], voice: null, prompt: '' }]);
  const addImagesToTarget = async (files: FileList | null) => {
    const id = targetItem.current;
    if (!files || !id) return;
    const imgs: Img[] = [];
    for (const file of Array.from(files)) imgs.push({ name: file.name, dataUrl: await fileToDataURL(file) });
    setDataset((prev) => prev.map((it) => (it.id === id ? { ...it, images: [...it.images, ...imgs] } : it)));
  };
  const setVoiceForTarget = async (file: File | null) => {
    const id = targetItem.current;
    if (!id) return;
    updateItem(id, { voice: file ? { name: file.name, ...(await fileToAudio(file)) } : null });
  };

  // Folder import: pairs the i-th image with the i-th audio by sorted filename.
  const addFolder = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    const isImg = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(f.name);
    const isAud = (f: File) => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|opus|flac|aac|webm)$/i.test(f.name);
    const key = (f: File) => (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const byName = (a: File, b: File) => key(a).localeCompare(key(b), undefined, { numeric: true, sensitivity: 'base' });
    const imgs = arr.filter(isImg).sort(byName);
    const auds = arr.filter(isAud).sort(byName);
    if (!imgs.length && !auds.length) return setError('That folder had no images or audio files.');
    const n = Math.max(imgs.length, auds.length);
    const items: Item[] = [];
    for (let i = 0; i < n; i++) {
      const img = imgs[i];
      const aud = auds[i];
      items.push({
        id: `rd-${++idSeq}`,
        images: img ? [{ name: img.name, dataUrl: await fileToDataURL(img) }] : [],
        voice: aud ? { name: aud.name, ...(await fileToAudio(aud)) } : null,
        prompt: '',
      });
    }
    setDataset((prev) => [...prev, ...items]);
    setError('');
  };

  const addModel = () => {
    const m = modelDraft.trim();
    if (m && !compareModels.includes(m)) setCompareModels([...compareModels, m]);
    setModelDraft('');
  };
  const setCell = (itemId: string, col: string, cell: Cell) => setResults((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [col]: cell } }));

  const run = async () => {
    setError('');
    const notReady = providerNotReady(provider);
    if (notReady) return setError(notReady);
    const slotsReady = !!(cfg.slots.scout && cfg.slots.fast && cfg.slots.smart && cfg.slots.expert);
    if (!slotsReady) return setError('Fill in the Scout / Fast / Smart / Expert model slots first.');
    if (!dataset.length) return setError('Add at least one item (or import a folder).');

    stopRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResults({});
    const base = assembleConfig(provider, cfg, modelList, controller.signal);
    const tasks = dataset.flatMap((it) => cols.map((col) => ({ it, col })));
    const total = tasks.length;
    let done = 0;
    await runPool(tasks, cfg.batchSize, async ({ it, col }) => {
      if (stopRef.current) return;
      setCell(it.id, col, { status: 'running' });
      const media = { images: it.images.map((i) => i.dataUrl), audio: it.voice ? { data: it.voice.data, format: it.voice.format } : undefined };
      const rc = col === AUTO ? base : { ...base, forceModel: col };
      const r = await runRouter(rc, media, it.prompt);
      const aborted = controller.signal.aborted;
      setCell(it.id, col, { status: r.error || aborted ? 'error' : 'done', run: r });
      done++;
      setProgress(`${done} / ${total}`);
    });
    setRunning(false);
    setProgress('');
  };

  const badgesFor = (itemId: string) => {
    const doneCols = cols.filter((col) => {
      const c = results[itemId]?.[col];
      return c?.status === 'done' && c.run && !c.run.retake;
    });
    const cost = (col: string) => results[itemId][col].run!.totalCost;
    const ms = (col: string) => results[itemId][col].run!.totalTimeMs;
    const costed = doneCols.filter((col) => cost(col) != null);
    const cheapest = costed.length ? costed.reduce((a, b) => (cost(a)! <= cost(b)! ? a : b)) : '';
    const fastest = doneCols.length ? doneCols.reduce((a, b) => (ms(a) <= ms(b) ? a : b)) : '';
    return { cheapest, fastest };
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['item', 'column', 'model', 'subject', 'difficulty', 'final_value', 'tokens', 'ms', 'cost_usd', 'answer'];
    const rows = [header.map(esc).join(',')];
    dataset.forEach((it, i) => {
      cols.forEach((col) => {
        const r = results[it.id]?.[col]?.run;
        const model = col === AUTO ? r?.answeredModel || r?.decision?.model || 'auto' : col;
        rows.push([i + 1, col === AUTO ? 'auto' : 'model', model, r?.scout?.subject || '', r?.scout?.difficulty || '', r?.finalValue || '', r?.totalTokens ?? '', r?.totalTimeMs ?? '', r?.totalCost ?? '', r?.answer || ''].map(esc).join(','));
      });
    });
    download('router-dataset.csv', rows.join('\n'), 'text/csv;charset=utf-8');
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-studio-canvas">
      <header className="flex items-center justify-between border-b border-studio-line px-6 py-[13px]">
        <div className="flex items-center gap-3">
          <div className="font-display text-[15px] font-medium">Router</div>
          {modeSwitch}
        </div>
        <div className="flex items-center gap-2">
          {progress && <span className="text-xs text-studio-muted">{progress}</span>}
          {dataset.length > 0 && (
            <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          )}
          {running ? (
            <button onClick={() => { stopRef.current = true; abortRef.current?.abort(); }} className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700">
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button onClick={run} className="flex items-center gap-1.5 rounded-full bg-studio-blue px-4 py-1.5 text-xs font-medium text-white hover:bg-studio-bluehover">
              <Play className="h-3.5 w-3.5" /> Run all
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <SlotsBar cfg={cfg} showBatch />

        {/* compare models */}
        <div className="mb-4 rounded-xl border border-studio-border bg-studio-surface p-4">
          <label className="mb-1.5 block text-xs font-medium text-studio-muted">Also compare Auto against these models (optional)</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {compareModels.map((m) => (
              <span key={m} className="flex items-center gap-1.5 rounded-full bg-studio-bluesoft px-3 py-1 text-xs text-studio-bluetext">
                {m}
                <button onClick={() => setCompareModels(compareModels.filter((x) => x !== m))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <ModelInput value={modelDraft} onChange={setModelDraft} onEnter={addModel} placeholder="Add a model to compare…" />
            </div>
            <button onClick={addModel} className="flex items-center gap-1 rounded-lg bg-studio-blue px-3 py-2.5 text-sm text-white hover:bg-studio-bluehover">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        {/* dataset toolbar */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium text-studio-muted">Dataset — items ({dataset.length})</h3>
          <div className="flex gap-2">
            <button onClick={addBlank} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
            <button onClick={() => folderInput.current?.click()} title="Pick a folder (with images + voice subfolders). Pairs image 1 with voice 1, etc." className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <Upload className="h-3.5 w-3.5" /> Folder (img+voice)
            </button>
          </div>
        </div>

        {dataset.length === 0 ? (
          <div className="rounded-xl border border-dashed border-studio-border py-12 text-center text-sm text-studio-faint">
            Add items (image / text / voice), or import a folder. Each item runs through Auto (+ any models above), side by side.
          </div>
        ) : (
          <div className="space-y-4">
            {dataset.map((it, idx) => {
              const badges = badgesFor(it.id);
              return (
                <div key={it.id} className="rounded-xl border border-studio-border bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-studio-muted">Item {idx + 1}</span>
                    <button onClick={() => setDataset(dataset.filter((x) => x.id !== it.id))} className="text-studio-muted hover:text-studio-text">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {it.images.map((im, i) => (
                      <span key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={im.dataUrl} alt={im.name} className="h-16 w-16 rounded-lg object-cover ring-1 ring-studio-border" />
                        <button onClick={() => updateItem(it.id, { images: it.images.filter((_, x) => x !== i) })} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-studio-muted ring-1 ring-studio-border hover:text-studio-text">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <button onClick={() => { targetItem.current = it.id; itemImageInput.current?.click(); }} className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-studio-border text-studio-muted hover:bg-studio-hover">
                      <Plus className="h-4 w-4" />
                    </button>
                    {it.voice ? (
                      <span className="flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-surface px-2.5 py-1 text-xs">
                        <Mic className="h-3.5 w-3.5" />
                        <span className="max-w-[120px] truncate">{it.voice.name}</span>
                        <button onClick={() => updateItem(it.id, { voice: null })} className="text-studio-muted hover:text-studio-text">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => { targetItem.current = it.id; itemVoiceInput.current?.click(); }} className="flex items-center gap-1.5 rounded-full border border-dashed border-studio-border px-3 py-1.5 text-xs text-studio-muted hover:bg-studio-hover">
                        <Mic className="h-3.5 w-3.5" /> Voice
                      </button>
                    )}
                  </div>
                  <textarea
                    value={it.prompt}
                    onChange={(e) => updateItem(it.id, { prompt: e.target.value })}
                    rows={2}
                    placeholder="Question text (optional if the photo has it)…"
                    className="w-full resize-none rounded-lg border border-studio-border bg-white px-3 py-2 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none"
                  />

                  <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, minmax(0, 1fr))` }}>
                    {cols.map((col) => {
                      const cell = results[it.id]?.[col];
                      const r = cell?.run;
                      const isAuto = col === AUTO;
                      const modelShown = isAuto ? r?.answeredModel || r?.decision?.model : col;
                      return (
                        <div key={col} className="rounded-lg border border-studio-line bg-studio-surface p-2 text-[11px]">
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className="min-w-0 flex-1 truncate font-medium text-studio-text">{isAuto ? 'Auto (router)' : col}</span>
                            {cell?.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-studio-blue" />}
                          </div>
                          {!cell && <span className="text-studio-faint">—</span>}
                          {cell?.status === 'running' && <span className="text-studio-faint">running…</span>}
                          {r?.retake && <span className="text-amber-700">retake: {r.retake.reason}</span>}
                          {r && !r.retake && (
                            <div className="space-y-1">
                              {isAuto && modelShown && <div className="truncate font-mono text-studio-faint">→ {modelShown}</div>}
                              {r.scout && <div className="text-studio-faint">{r.scout.subject} · {r.scout.difficulty}</div>}
                              <div className="max-h-32 overflow-y-auto whitespace-pre-wrap leading-5 text-studio-text">{r.answer || <span className="text-studio-faint">(no answer)</span>}</div>
                              {r.finalValue && <div className="font-medium">→ {r.finalValue}</div>}
                              <div className="flex flex-wrap gap-1">
                                {col === badges.cheapest && <Badge cls="bg-emerald-100 text-emerald-700">🏆 cheapest</Badge>}
                                {col === badges.fastest && <Badge cls="bg-sky-100 text-sky-700">⚡ fastest</Badge>}
                              </div>
                              <div className="font-mono text-studio-faint">
                                {r.totalTokens} tok · {r.totalTimeMs} ms{r.totalCost != null ? ` · ${fmtUsd(r.totalCost)}` : ''}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <input ref={itemImageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addImagesToTarget(e.target.files); e.currentTarget.value = ''; }} />
      <input ref={itemVoiceInput} type="file" accept="audio/*" hidden onChange={(e) => { setVoiceForTarget(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
      <input ref={folderInput} type="file" multiple hidden {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} onChange={(e) => { addFolder(e.target.files); e.currentTarget.value = ''; }} />
    </section>
  );
};
