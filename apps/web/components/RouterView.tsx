'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, ImageIcon, Loader2, Mic, Play, Plus, Sparkles, Square, X } from 'lucide-react';
import { ModelInput } from './ModelInput';
import { RouterDataset } from './RouterDataset';
import { fileToAudio, fileToDataURL, OrModel } from '../lib/openrouter';
import { getStored, setStored } from '../lib/settings';
import { fetchProviderModels, providerNotReady } from '../lib/providers';
import { useProvider } from '../lib/providerContext';
import { runRouter, RouterRun } from '../lib/router';
import { recordRun } from '../lib/routerStats';
import { runPool } from '../lib/pool';
import { assembleConfig, Badge, download, fmtUsd, RouterRunCard, SlotsBar, useRouterConfig } from './RouterShared';

type Img = { name: string; dataUrl: string };
type Voice = { name: string; data: string; format: string };
type ColRun = { key: string; label: string; status: 'idle' | 'running' | 'done' | 'error'; run?: RouterRun };

export const RouterView: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'dataset'>('single');
  useEffect(() => setMode(getStored('or.router.mode2', 'single')), []);
  const switchMode = (m: 'single' | 'dataset') => {
    setMode(m);
    setStored('or.router.mode2', m);
  };
  const modeSwitch = (
    <div className="flex gap-1 rounded-lg border border-studio-border p-0.5">
      {(['single', 'dataset'] as const).map((m) => (
        <button
          key={m}
          onClick={() => switchMode(m)}
          className={`rounded-md px-3 py-1 text-xs transition-colors ${mode === m ? 'bg-studio-bluesoft font-medium text-studio-bluetext' : 'text-studio-muted hover:bg-studio-hover'}`}
        >
          {m === 'single' ? 'Single' : 'Bulk'}
        </button>
      ))}
    </div>
  );
  return mode === 'single' ? <RunPanel modeSwitch={modeSwitch} /> : <RouterDataset modeSwitch={modeSwitch} />;
};

const RunPanel: React.FC<{ modeSwitch: React.ReactNode }> = ({ modeSwitch }) => {
  const { provider } = useProvider();
  const cfg = useRouterConfig();
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<Img[]>([]);
  const [audio, setAudio] = useState<Voice | null>(null);
  const [compare, setCompare] = useState(false);
  const [compareModels, setCompareModels] = useState<string[]>([]);
  const [modelDraft, setModelDraft] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RouterRun | null>(null);
  const [cols, setCols] = useState<ColRun[]>([]);
  const [bestKey, setBestKey] = useState('');
  const [recorded, setRecorded] = useState(false);
  const [modelList, setModelList] = useState<OrModel[]>([]);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompare(getStored('or.router.compare', false));
    setCompareModels(getStored('or.router.comparemodels', []));
  }, []);
  useEffect(() => setStored('or.router.compare', compare), [compare]);
  useEffect(() => setStored('or.router.comparemodels', compareModels), [compareModels]);
  useEffect(() => {
    fetchProviderModels(provider).then(setModelList);
  }, [provider]);
  // Leaving the panel (mode/tab switch) cancels any in-flight run so it can't
  // keep billing or set state on an unmounted component.
  useEffect(() => () => abortRef.current?.abort(), []);

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const added: Img[] = [];
    for (const file of Array.from(files)) added.push({ name: file.name, dataUrl: await fileToDataURL(file) });
    setImages((prev) => [...prev, ...added]);
  };
  const setVoice = async (file: File | null) => setAudio(file ? { name: file.name, ...(await fileToAudio(file)) } : null);
  const addCompareModel = () => {
    const m = modelDraft.trim();
    if (m && !compareModels.includes(m)) setCompareModels([...compareModels, m]);
    setModelDraft('');
  };

  const media = () => ({ images: images.map((i) => i.dataUrl), audio: audio ? { data: audio.data, format: audio.format } : undefined });

  const run = async () => {
    setError('');
    const notReady = providerNotReady(provider);
    if (notReady) return setError(notReady);
    // The router always needs all four slots filled.
    const slotsReady = !!(cfg.slots.scout && cfg.slots.fast && cfg.slots.smart && cfg.slots.expert);
    if (!slotsReady) return setError('Fill in the Scout / Fast / Smart / Expert model slots first.');
    if (!prompt.trim() && !images.length && !audio) return setError('Add a question, image, or voice first.');

    stopRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResult(null);
    setCols([]);
    setBestKey('');
    setRecorded(false);
    const base = assembleConfig(provider, cfg, modelList, controller.signal);
    const m = media();

    try {
      if (!compare) {
        const r = await runRouter(base, m, prompt);
        setResult(r);
      } else {
        const columns: ColRun[] = [{ key: 'auto', label: 'Auto (router)', status: 'idle' }, ...compareModels.map((mm) => ({ key: mm, label: mm, status: 'idle' as const }))];
        setCols(columns);
        await runPool(columns, cfg.batchSize, async (col) => {
          if (stopRef.current) return null; // don't start queued columns after Stop
          setCols((prev) => prev.map((c) => (c.key === col.key ? { ...c, status: 'running' } : c)));
          const rc = col.key === 'auto' ? base : { ...base, forceModel: col.key };
          const r = await runRouter(rc, m, prompt);
          const aborted = controller.signal.aborted;
          // A run cut short by Stop is an error, not a $0 "done" — keep it out of
          // the cheapest/fastest badges, the Best-answer pick, and stats.
          setCols((prev) => prev.map((c) => (c.key === col.key ? { ...c, status: r.error || aborted ? 'error' : 'done', run: r } : c)));
          return r;
        });
      }
    } finally {
      setRunning(false);
    }
  };

  // User picks the best answer among compared columns → train the stats table once.
  const pickBest = (key: string) => {
    setBestKey(key);
    if (recorded) return;
    const scout = cols.find((c) => c.run?.scout)?.run?.scout;
    if (!scout) return;
    let any = false;
    for (const c of cols) {
      if (c.status !== 'done' || !c.run) continue;
      // Credit the model that actually produced the shipped answer (backup-race
      // winner), not the tier the router first picked.
      const model = c.key === 'auto' ? c.run.answeredModel || c.run.decision?.model : c.key;
      if (!model) continue;
      recordRun(model, scout.subject, scout.difficulty, { win: c.key === key, ms: c.run.totalTimeMs, cost: c.run.totalCost || 0 });
      any = true;
    }
    if (any) setRecorded(true);
  };

  const exportRows = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['column', 'model', 'subject', 'difficulty', 'final_value', 'tokens', 'ms', 'cost_usd', 'answer'];
    const rows = [header.map(esc).join(',')];
    const src = compare ? cols : result ? [{ key: 'single', label: 'result', status: 'done', run: result } as ColRun] : [];
    for (const c of src) {
      const r = c.run;
      rows.push(
        [c.label, c.key === 'auto' ? r?.decision?.model || 'auto' : c.key, r?.scout?.subject || '', r?.scout?.difficulty || '', r?.finalValue || '', r?.totalTokens ?? '', r?.totalTimeMs ?? '', r?.totalCost ?? '', r?.answer || '']
          .map(esc)
          .join(','),
      );
    }
    download('router-run.csv', rows.join('\n'), 'text/csv;charset=utf-8');
  };

  const doneCols = cols.filter((c) => c.status === 'done' && c.run && !c.run.retake);
  const costed = doneCols.filter((c) => c.run!.totalCost != null);
  const cheapestKey = costed.length ? costed.reduce((a, b) => (a.run!.totalCost! <= b.run!.totalCost! ? a : b)).key : '';
  const fastestKey = doneCols.length ? doneCols.reduce((a, b) => (a.run!.totalTimeMs <= b.run!.totalTimeMs ? a : b)).key : '';
  const hasResults = compare ? cols.length > 0 : !!result;

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-studio-canvas">
      <header className="flex items-center justify-between border-b border-studio-line px-6 py-[13px]">
        <div className="flex items-center gap-3">
          <div className="font-display text-[15px] font-medium">Router</div>
          {modeSwitch}
        </div>
        <div className="flex items-center gap-2">
          {hasResults && (
            <button onClick={exportRows} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          )}
          {running ? (
            <button onClick={() => { stopRef.current = true; abortRef.current?.abort(); }} className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700">
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button onClick={run} className="flex items-center gap-1.5 rounded-full bg-studio-blue px-4 py-1.5 text-xs font-medium text-white hover:bg-studio-bluehover">
              <Play className="h-3.5 w-3.5" /> Run
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <SlotsBar cfg={cfg} showBatch={compare} />

        {/* question input */}
        <div className="mb-4 rounded-xl border border-studio-border bg-white p-4">
          <label className="mb-1.5 block text-xs font-medium text-studio-muted">Question</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="Type the question, or leave blank and attach a photo of it…"
            className="w-full resize-none rounded-lg border border-studio-border bg-white px-3 py-2 text-sm text-studio-text placeholder-studio-faint focus:border-studio-blue focus:outline-none"
          />
          {(images.length > 0 || audio) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((im, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-surface px-2.5 py-1 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.dataUrl} alt="" className="h-5 w-5 rounded object-cover" />
                  <span className="max-w-[140px] truncate">{im.name}</span>
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
            <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.currentTarget.value = ''; }} />
            <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => { setVoice(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
          </div>
        </div>

        {/* mode row */}
        <div className="mb-6 flex items-center justify-between rounded-xl border border-studio-border bg-studio-surface p-4">
          <span className="text-sm text-studio-muted">The router picks the model automatically from your lineup.</span>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-studio-text">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4 accent-studio-blue" /> Compare models
          </label>
        </div>

        {compare && (
          <div className="mb-6 rounded-xl border border-studio-border bg-studio-surface p-4">
            <label className="mb-1.5 block text-xs font-medium text-studio-muted">Compare Auto against these models</label>
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
                <ModelInput value={modelDraft} onChange={setModelDraft} onEnter={addCompareModel} placeholder="Add a model to compare…" />
              </div>
              <button onClick={addCompareModel} className="flex items-center gap-1 rounded-lg bg-studio-blue px-3 py-2.5 text-sm text-white hover:bg-studio-bluehover">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        )}

        {/* results */}
        {!compare && result && <RouterRunCard run={result} budgetSec={cfg.budgetSec} />}

        {compare && cols.length > 0 && (
          <div className="overflow-x-auto">
            {recorded && <div className="mb-2 text-[11px] text-emerald-600">Best pick recorded — the router will favour it for this subject/difficulty.</div>}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, minmax(240px, 1fr))` }}>
              {cols.map((c) => {
                const r = c.run;
                return (
                  <div key={c.key} className={`rounded-xl border p-3 ${bestKey === c.key ? 'border-studio-blue ring-1 ring-studio-blue' : 'border-studio-border'} bg-white`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-studio-text">{c.label}</span>
                      {c.status === 'running' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-studio-blue" />}
                    </div>
                    {c.status === 'running' && <div className="text-xs text-studio-faint">running…</div>}
                    {r && (
                      <div className="space-y-2">
                        {r.retake ? (
                          <div className="text-xs text-amber-700">Retake: {r.retake.reason}</div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              {r.scout && <span className="rounded-full bg-studio-bluesoft px-1.5 py-0.5 text-studio-bluetext">{r.scout.subject}</span>}
                              {r.scout && <span className="rounded-full bg-studio-hover px-1.5 py-0.5 text-studio-muted">{r.scout.difficulty}</span>}
                            </div>
                            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[12px] leading-5 text-studio-text">{r.answer || <span className="text-studio-faint">(no answer)</span>}</div>
                            {r.finalValue && <div className="text-[12px] font-medium">→ {r.finalValue}</div>}
                            <div className="flex flex-wrap gap-1">
                              {c.key === cheapestKey && <Badge cls="bg-emerald-100 text-emerald-700">🏆 cheapest</Badge>}
                              {c.key === fastestKey && <Badge cls="bg-sky-100 text-sky-700">⚡ fastest</Badge>}
                            </div>
                            <div className="font-mono text-[10px] text-studio-faint">
                              {r.totalTokens} tok · {r.totalTimeMs} ms{r.totalCost != null ? ` · ${fmtUsd(r.totalCost)}` : ''}
                            </div>
                          </>
                        )}
                        {c.status === 'done' && !r.retake && (
                          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-studio-muted">
                            <input type="radio" name="best" checked={bestKey === c.key} onChange={() => pickBest(c.key)} className="accent-studio-blue" /> Best answer
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!hasResults && !running && (
          <div className="rounded-xl border border-dashed border-studio-border py-12 text-center text-sm text-studio-faint">
            <Sparkles className="mx-auto mb-2 h-5 w-5 text-studio-faint" />
            Add a question (text / image / voice), then Run. Auto lets the router pick the model; Compare pits models side by side to find the best, cheapest, and fastest.
          </div>
        )}
      </div>
    </section>
  );
};
