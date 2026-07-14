'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, ImageIcon, Loader2, Mic, Play, Plus, Square, Trophy, X } from 'lucide-react';
import { ModelInput } from './ModelInput';
import { fileToAudio, fileToDataURL, OrModel } from '../lib/openrouter';
import { getStored, setStored } from '../lib/settings';
import { fetchProviderModels, providerNotReady } from '../lib/providers';
import { useProvider } from '../lib/providerContext';
import { Difficulty, RouterStep, ScoutResult, scoutClassify } from '../lib/router';
import { runPool } from '../lib/pool';
import { assembleConfig, Badge, download, fmtUsd, UseAsScoutBtn, useRouterConfig } from './RouterShared';

type Img = { name: string; dataUrl: string };
type Voice = { name: string; data: string; format: string };
type TestItem = { id: string; images: Img[]; voice: Voice | null; prompt: string; expectSubject: string; expectDifficulty: '' | Difficulty };
type Cell = { status: 'idle' | 'running' | 'done' | 'error'; scout?: ScoutResult | null; step?: RouterStep };
type Results = Record<string, Record<string, Cell>>;

let idSeq = 0;
const norm = (s: string) => s.trim().toLowerCase();

export const RouterTest: React.FC<{ modeSwitch: React.ReactNode }> = ({ modeSwitch }) => {
  const { provider } = useProvider();
  const cfg = useRouterConfig();
  const [dataset, setDataset] = useState<TestItem[]>([]);
  const [testModels, setTestModels] = useState<string[]>([]);
  const [modelDraft, setModelDraft] = useState('');
  const [results, setResults] = useState<Results>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [scoutMsg, setScoutMsg] = useState('');
  const [modelList, setModelList] = useState<OrModel[]>([]);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const bulkInput = useRef<HTMLInputElement>(null);
  const itemImageInput = useRef<HTMLInputElement>(null);
  const itemVoiceInput = useRef<HTMLInputElement>(null);
  const datasetInput = useRef<HTMLInputElement>(null);
  const targetItem = useRef<string>('');

  useEffect(() => {
    setTestModels(getStored('or.routertest.models', []));
    setDataset(getStored('or.routertest.dataset', []));
  }, []);
  useEffect(() => setStored('or.routertest.models', testModels), [testModels]);
  useEffect(() => setStored('or.routertest.dataset', dataset), [dataset]);
  useEffect(() => {
    fetchProviderModels(provider).then(setModelList);
  }, [provider]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateItem = (id: string, patch: Partial<TestItem>) => setDataset((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addBlank = () => setDataset((prev) => [...prev, { id: `t-${++idSeq}`, images: [], voice: null, prompt: '', expectSubject: '', expectDifficulty: '' }]);
  const addBulk = async (files: FileList | null) => {
    if (!files) return;
    const items: TestItem[] = [];
    for (const file of Array.from(files)) items.push({ id: `t-${++idSeq}`, images: [{ name: file.name, dataUrl: await fileToDataURL(file) }], voice: null, prompt: '', expectSubject: '', expectDifficulty: '' });
    setDataset((prev) => [...prev, ...items]);
  };
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
  const loadDataset = async (file: File | null) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (Array.isArray(data.models)) setTestModels(data.models);
      if (Array.isArray(data.items)) {
        setDataset(
          data.items.map((it: any) => ({
            id: `t-${++idSeq}`,
            images: it.images || [],
            voice: it.voice || null,
            prompt: it.prompt || '',
            expectSubject: it.expectSubject || '',
            expectDifficulty: it.expectDifficulty || '',
          })),
        );
        setResults({});
      }
    } catch {
      setError('Could not read that dataset file.');
    }
  };
  const addModel = () => {
    const m = modelDraft.trim();
    if (m && !testModels.includes(m)) setTestModels([...testModels, m]);
    setModelDraft('');
  };
  const setCell = (itemId: string, model: string, cell: Cell) => setResults((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [model]: cell } }));

  const run = async () => {
    setError('');
    setScoutMsg('');
    const notReady = providerNotReady(provider);
    if (notReady) return setError(notReady);
    if (!testModels.length) return setError('Add at least one model to test.');
    if (!dataset.length) return setError('Add at least one item.');

    stopRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResults({});
    const base = assembleConfig(provider, cfg, modelList, controller.signal);
    const tasks = dataset.flatMap((it) => testModels.map((m) => ({ it, m })));
    const total = tasks.length;
    let done = 0;
    await runPool(tasks, cfg.batchSize, async ({ it, m }) => {
      if (stopRef.current) return; // leave not-yet-started cells blank after Stop
      setCell(it.id, m, { status: 'running' });
      const media = { images: it.images.map((i) => i.dataUrl), audio: it.voice ? { data: it.voice.data, format: it.voice.format } : undefined };
      const { scout, step } = await scoutClassify(base, m, media, it.prompt);
      setCell(it.id, m, { status: step.status === 'error' ? 'error' : 'done', scout, step });
      done++;
      setProgress(`${done} / ${total}`);
    });
    setRunning(false);
    setProgress('');
  };

  const useAsScout = (model: string) => {
    cfg.setSlots({ ...cfg.slots, scout: model });
    setScoutMsg(`Set Scout slot to ${model} (used in Run mode).`);
  };

  // Scoreboard
  const board = testModels.map((m) => {
    let subT = 0, subC = 0, difT = 0, difC = 0, msSum = 0, costSum = 0, n = 0, costN = 0;
    for (const it of dataset) {
      const cell = results[it.id]?.[m];
      if (!cell || cell.status !== 'done' || !cell.scout) continue;
      n++;
      msSum += cell.step?.latencyMs || 0;
      if (cell.step?.cost != null) { costSum += cell.step.cost; costN++; }
      if (it.expectSubject.trim()) { subT++; if (norm(cell.scout.subject) === norm(it.expectSubject)) subC++; }
      if (it.expectDifficulty) { difT++; if (cell.scout.difficulty === it.expectDifficulty) difC++; }
    }
    const subjectAcc = subT ? subC / subT : null;
    const difficultyAcc = difT ? difC / difT : null;
    const accParts = [subjectAcc, difficultyAcc].filter((x): x is number => x != null);
    const overall = accParts.length ? accParts.reduce((a, b) => a + b, 0) / accParts.length : null;
    return { model: m, n, subjectAcc, difficultyAcc, overall, avgMs: n ? msSum / n : null, avgCost: costN ? costSum / costN : null };
  });
  const scored = board.filter((b) => b.n > 0);
  const bestAccKey = scored.filter((b) => b.overall != null).sort((a, b) => (b.overall! - a.overall!))[0]?.model || '';
  const fastKey = scored.filter((b) => b.avgMs != null).sort((a, b) => a.avgMs! - b.avgMs!)[0]?.model || '';
  const cheapKey = scored.filter((b) => b.avgCost != null).sort((a, b) => a.avgCost! - b.avgCost!)[0]?.model || '';

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['item', 'prompt', 'expect_subject', 'expect_difficulty', 'model', 'pred_subject', 'pred_difficulty', 'logic', 'type', 'subject_ok', 'difficulty_ok', 'ms', 'cost_usd'];
    const rows = [header.map(esc).join(',')];
    dataset.forEach((it, i) => {
      testModels.forEach((m) => {
        const cell = results[it.id]?.[m];
        const sc = cell?.scout;
        const subOk = it.expectSubject.trim() && sc ? (norm(sc.subject) === norm(it.expectSubject) ? 'yes' : 'no') : '';
        const difOk = it.expectDifficulty && sc ? (sc.difficulty === it.expectDifficulty ? 'yes' : 'no') : '';
        rows.push([i + 1, it.prompt, it.expectSubject, it.expectDifficulty, m, sc?.subject || '', sc?.difficulty || '', sc?.logicDepth ?? '', sc?.type || '', subOk, difOk, cell?.step?.latencyMs ?? '', cell?.step?.cost ?? ''].map(esc).join(','));
      });
    });
    download('router-test.csv', rows.join('\n'), 'text/csv;charset=utf-8');
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
              <Play className="h-3.5 w-3.5" /> Run test
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <p className="mb-4 text-xs text-studio-faint">
          Tests which model is the best <strong>router</strong>: each model reads the image/question and classifies its subject + difficulty. Set the expected labels to score accuracy. Winner → <strong>Use as Scout</strong>.
        </p>

        {/* models to test */}
        <div className="mb-4 rounded-xl border border-studio-border bg-studio-surface p-4">
          <label className="mb-1.5 block text-xs font-medium text-studio-muted">Models to test (as router / scout)</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {testModels.map((m) => (
              <span key={m} className="flex items-center gap-1.5 rounded-full bg-studio-bluesoft px-3 py-1 text-xs text-studio-bluetext">
                {m}
                <button onClick={() => setTestModels(testModels.filter((x) => x !== m))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <ModelInput value={modelDraft} onChange={setModelDraft} onEnter={addModel} placeholder="Add a model to test…" />
            </div>
            <button onClick={addModel} className="flex items-center gap-1 rounded-lg bg-studio-blue px-3 py-2.5 text-sm text-white hover:bg-studio-bluehover">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-studio-muted">
              Batch size
              <input type="number" min={1} max={10} value={cfg.batchSize} onChange={(e) => cfg.setBatchSize(Math.max(1, Math.min(10, Number(e.target.value))))} className="w-16 rounded-lg border border-studio-border bg-white px-2 py-1.5 text-sm text-studio-text focus:border-studio-blue focus:outline-none" />
            </label>
            <span className="text-[11px] text-studio-faint">How many classify calls run at once.</span>
          </div>
        </div>

        {/* scoreboard */}
        {scored.length > 0 && (
          <div className="mb-6 overflow-x-auto rounded-xl border border-studio-border bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-studio-line text-left text-studio-muted">
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Subject acc</th>
                  <th className="px-3 py-2 font-medium">Difficulty acc</th>
                  <th className="px-3 py-2 font-medium">Avg time</th>
                  <th className="px-3 py-2 font-medium">Avg cost</th>
                  <th className="px-3 py-2 font-medium"></th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {board.map((b) => (
                  <tr key={b.model} className="border-b border-studio-line last:border-0">
                    <td className="px-3 py-2 font-mono text-studio-text">{b.model}</td>
                    <td className="px-3 py-2">{b.subjectAcc != null ? `${Math.round(b.subjectAcc * 100)}%` : '—'}</td>
                    <td className="px-3 py-2">{b.difficultyAcc != null ? `${Math.round(b.difficultyAcc * 100)}%` : '—'}</td>
                    <td className="px-3 py-2 font-mono text-studio-faint">{b.avgMs != null ? `${Math.round(b.avgMs)} ms` : '—'}</td>
                    <td className="px-3 py-2 font-mono text-studio-faint">{b.avgCost != null ? fmtUsd(b.avgCost) : '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {b.model === bestAccKey && <Badge cls="bg-amber-100 text-amber-700"><Trophy className="h-3 w-3" /> accurate</Badge>}
                        {b.model === fastKey && <Badge cls="bg-sky-100 text-sky-700">⚡ fastest</Badge>}
                        {b.model === cheapKey && <Badge cls="bg-emerald-100 text-emerald-700">🏆 cheapest</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{b.n > 0 && <UseAsScoutBtn onClick={() => useAsScout(b.model)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {scoutMsg && <div className="mb-4 text-[11px] text-emerald-600">{scoutMsg}</div>}

        {/* dataset */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium text-studio-muted">Dataset — items ({dataset.length})</h3>
          <div className="flex gap-2">
            <button onClick={() => datasetInput.current?.click()} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <FolderOpen className="h-3.5 w-3.5" /> Load
            </button>
            <button onClick={addBlank} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
            <button onClick={() => bulkInput.current?.click()} className="flex items-center gap-1.5 rounded-full border border-studio-border px-3 py-1.5 text-xs text-studio-text hover:bg-studio-hover">
              <ImageIcon className="h-3.5 w-3.5" /> Bulk images
            </button>
          </div>
        </div>

        {dataset.length === 0 ? (
          <div className="rounded-xl border border-dashed border-studio-border py-12 text-center text-sm text-studio-faint">
            Add items (image / text / voice). Optionally set the expected subject + difficulty to score accuracy.
          </div>
        ) : (
          <div className="space-y-4">
            {dataset.map((it, idx) => (
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
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-studio-muted">
                    Expect subject
                    <input value={it.expectSubject} onChange={(e) => updateItem(it.id, { expectSubject: e.target.value })} placeholder="e.g. Physics" className="w-32 rounded-lg border border-studio-border bg-white px-2 py-1.5 text-sm text-studio-text focus:border-studio-blue focus:outline-none" />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-studio-muted">
                    Expect difficulty
                    <select value={it.expectDifficulty} onChange={(e) => updateItem(it.id, { expectDifficulty: e.target.value as TestItem['expectDifficulty'] })} className="rounded-lg border border-studio-border bg-white px-2 py-1.5 text-sm text-studio-text focus:border-studio-blue focus:outline-none">
                      <option value="">—</option>
                      <option value="easy">easy</option>
                      <option value="medium">medium</option>
                      <option value="hard">hard</option>
                      <option value="extreme">extreme</option>
                    </select>
                  </label>
                </div>

                {testModels.length > 0 && (
                  <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(testModels.length, 4)}, minmax(0, 1fr))` }}>
                    {testModels.map((m) => {
                      const cell = results[it.id]?.[m];
                      const sc = cell?.scout;
                      const subOk = it.expectSubject.trim() && sc ? norm(sc.subject) === norm(it.expectSubject) : null;
                      const difOk = it.expectDifficulty && sc ? sc.difficulty === it.expectDifficulty : null;
                      return (
                        <div key={m} className="rounded-lg border border-studio-line bg-studio-surface p-2 text-[11px]">
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className="min-w-0 flex-1 truncate font-mono text-studio-muted">{m}</span>
                            {cell?.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-studio-blue" />}
                          </div>
                          {cell?.status === 'error' && <span className="text-red-600">{cell.step?.note || 'error'}</span>}
                          {sc && (
                            <div className="space-y-0.5">
                              <div className={subOk === null ? 'text-studio-text' : subOk ? 'text-emerald-700' : 'text-red-600'}>
                                {sc.subject} {subOk === true ? '✓' : subOk === false ? '✗' : ''}
                              </div>
                              <div className={difOk === null ? 'text-studio-text' : difOk ? 'text-emerald-700' : 'text-red-600'}>
                                {sc.difficulty} {difOk === true ? '✓' : difOk === false ? '✗' : ''}
                              </div>
                              <div className="font-mono text-studio-faint">{cell?.step?.latencyMs} ms{cell?.step?.cost != null ? ` · ${fmtUsd(cell.step.cost)}` : ''}</div>
                            </div>
                          )}
                          {cell?.status === 'done' && !sc && <span className="text-studio-faint">unparseable</span>}
                          {!cell && <span className="text-studio-faint">—</span>}
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

      <input ref={bulkInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addBulk(e.target.files); e.currentTarget.value = ''; }} />
      <input ref={itemImageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addImagesToTarget(e.target.files); e.currentTarget.value = ''; }} />
      <input ref={itemVoiceInput} type="file" accept="audio/*" hidden onChange={(e) => { setVoiceForTarget(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
      <input ref={datasetInput} type="file" accept="application/json,.json" hidden onChange={(e) => { loadDataset(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
    </section>
  );
};
