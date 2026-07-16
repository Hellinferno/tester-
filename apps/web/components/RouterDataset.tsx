'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Play, Plus, Square, Upload, X } from 'lucide-react';
import { fileToAudio, fileToDataURL, OrModel } from '../lib/openrouter';
import { fetchProviderModels, providerNotReady } from '../lib/providers';
import { useProvider } from '../lib/providerContext';
import { runRouter, RouterRun } from '../lib/router';
import { runPool } from '../lib/pool';
import { assembleConfig, download, fmtUsd, RouterRunCard, SlotsBar, useRouterConfig } from './RouterShared';

type Img = { name: string; dataUrl: string };
type Voice = { name: string; data: string; format: string };
type Item = { id: string; images: Img[]; voice: Voice | null; prompt: string };
type Cell = { status: 'idle' | 'running' | 'done' | 'error'; run?: RouterRun };

let idSeq = 0;

// Bulk mode: run the router (Auto) over a whole dataset — same functioning as
// Single mode, one full result card per item. Build items by hand or import a
// folder (pairs image i with voice i by sorted filename).
export const RouterDataset: React.FC<{ modeSwitch: React.ReactNode }> = ({ modeSwitch }) => {
  const { provider } = useProvider();
  const cfg = useRouterConfig();
  const [dataset, setDataset] = useState<Item[]>([]);
  const [results, setResults] = useState<Record<string, Cell>>({});
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

  useEffect(() => {
    fetchProviderModels(provider).then(setModelList);
  }, [provider]);
  useEffect(() => () => abortRef.current?.abort(), []);

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

  const setCell = (itemId: string, cell: Cell) => setResults((prev) => ({ ...prev, [itemId]: cell }));

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
    const total = dataset.length;
    let done = 0;
    await runPool(dataset, cfg.batchSize, async (it) => {
      if (stopRef.current) return;
      setCell(it.id, { status: 'running' });
      const media = { images: it.images.map((i) => i.dataUrl), audio: it.voice ? { data: it.voice.data, format: it.voice.format } : undefined };
      const r = await runRouter(base, media, it.prompt);
      const aborted = controller.signal.aborted;
      setCell(it.id, { status: r.error || aborted ? 'error' : 'done', run: r });
      done++;
      setProgress(`${done} / ${total}`);
    });
    setRunning(false);
    setProgress('');
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['item', 'model', 'subject', 'difficulty', 'final_value', 'tokens', 'ms', 'cost_usd', 'answer'];
    const rows = [header.map(esc).join(',')];
    dataset.forEach((it, i) => {
      const r = results[it.id]?.run;
      const model = r?.answeredModel || r?.decision?.model || '';
      rows.push([i + 1, model, r?.scout?.subject || '', r?.scout?.difficulty || '', r?.finalValue || '', r?.totalTokens ?? '', r?.totalTimeMs ?? '', r?.totalCost ?? '', r?.answer || ''].map(esc).join(','));
    });
    download('router-bulk.csv', rows.join('\n'), 'text/csv;charset=utf-8');
  };

  const totalCost = dataset.reduce((s, it) => s + (results[it.id]?.run?.totalCost || 0), 0);

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-studio-canvas">
      <header className="flex items-center justify-between border-b border-studio-line px-6 py-[13px]">
        <div className="flex items-center gap-3">
          <div className="font-display text-[15px] font-medium">Router</div>
          {modeSwitch}
        </div>
        <div className="flex items-center gap-2">
          {totalCost > 0 && <span className="font-mono text-xs text-studio-muted">est. {fmtUsd(totalCost)}</span>}
          {progress && <span className="text-xs text-studio-muted">{progress}</span>}
          {dataset.length > 0 && (
            <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              CSV
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

        {/* dataset toolbar */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium text-studio-muted">Items ({dataset.length})</h3>
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
            Add items (image / text / voice), or import a folder. Each item runs through the router (Auto) and shows its full result.
          </div>
        ) : (
          <div className="space-y-4">
            {dataset.map((it, idx) => {
              const cell = results[it.id];
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

                  {cell?.status === 'running' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-studio-muted">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running the router…
                    </div>
                  )}
                  {cell?.run && (
                    <div className="mt-3 border-t border-studio-line pt-3">
                      <RouterRunCard run={cell.run} budgetSec={cfg.budgetSec} />
                    </div>
                  )}
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
