'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ImageIcon, Loader2, Mic, Sparkles, Square, Trash2, X } from 'lucide-react';
import { RunSettings } from './RunSettings';
import { StageBlock } from './StageBlock';
import {
  ChatMessage,
  Stage,
  StreamMeta,
  chatStream,
  fileToAudio,
  fileToDataURL,
  runPipeline,
  userMessage,
} from '../lib/openrouter';
import { getOpenRouterKey, getStored, setStored } from '../lib/settings';

type Turn = {
  role: 'user' | 'assistant';
  text: string;
  imageThumbs?: string[];
  audioName?: string;
  stages?: Stage[];
  metrics?: { tokens?: number; latencyMs?: number };
};

export const ChatView: React.FC = () => {
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [timeoutSec, setTimeoutSec] = useState(90);
  const [webSearch, setWebSearch] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');

  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // restore + persist settings
  useEffect(() => {
    setModel(getStored('or.chat.model', ''));
    setTemperature(getStored('or.chat.temp', 0.7));
    setTimeoutSec(getStored('or.chat.timeout', 90));
    setWebSearch(getStored('or.chat.web', false));
    setSystemPrompt(getStored('or.chat.system', ''));
  }, []);
  useEffect(() => setStored('or.chat.model', model), [model]);
  useEffect(() => setStored('or.chat.temp', temperature), [temperature]);
  useEffect(() => setStored('or.chat.timeout', timeoutSec), [timeoutSec]);
  useEffect(() => setStored('or.chat.web', webSearch), [webSearch]);
  useEffect(() => setStored('or.chat.system', systemPrompt), [systemPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, streamText]);

  const canSend = !streaming && (!!text.trim() || images.length > 0 || !!audio);

  const handleSend = async () => {
    if (!canSend) return;
    setError('');
    const apiKey = getOpenRouterKey();
    if (!apiKey) return setError('Add your OpenRouter key in the sidebar first.');
    if (!model.trim()) return setError('Pick a model in Run settings.');

    const hasMedia = images.length > 0 || !!audio;
    const imageDataUrls = await Promise.all(images.map(fileToDataURL));
    const audioPart = audio ? await fileToAudio(audio) : undefined;

    const userTurn: Turn = {
      role: 'user',
      text: text.trim(),
      imageThumbs: imageDataUrls.length ? imageDataUrls : undefined,
      audioName: audio?.name,
    };
    const history = [...turns, userTurn];
    setTurns(history);

    const promptText = text;
    setText('');
    setImages([]);
    setAudio(null);
    setStreaming(true);
    setStreamText('');

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutMs = timeoutSec > 0 ? timeoutSec * 1000 : undefined;

    if (hasMedia) {
      // Staged pipeline: OCR (per image) / STT run as visible steps with metrics.
      const result = await runPipeline({
        model,
        apiKey,
        temperature,
        webSearch,
        prompt: promptText,
        images: imageDataUrls,
        audio: audioPart,
        signal: controller.signal,
        timeoutMs,
      });
      setTurns([
        ...history,
        {
          role: 'assistant',
          text: result.answer,
          stages: result.stages,
          metrics: { tokens: result.totalTokens, latencyMs: result.totalLatencyMs },
        },
      ]);
      setStreaming(false);
      return;
    }

    // Pure text chat: stream, and capture usage + latency from the final chunk.
    const messages: ChatMessage[] = [];
    if (systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    for (const t of turns) messages.push({ role: t.role, content: t.text });
    messages.push(userMessage(promptText));

    let acc = '';
    let meta: StreamMeta | undefined;
    try {
      for await (const delta of chatStream(
        { model, messages, apiKey, temperature, webSearch, signal: controller.signal, timeoutMs },
        (m) => {
          meta = m;
        },
      )) {
        acc += delta;
        setStreamText(acc);
      }
      setTurns([
        ...history,
        { role: 'assistant', text: acc, metrics: { tokens: meta?.usage?.total_tokens, latencyMs: meta?.latencyMs } },
      ]);
    } catch (e: any) {
      setTurns([...history, { role: 'assistant', text: acc || `⚠ ${String(e?.message || e)}` }]);
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const empty = turns.length === 0 && !streaming;

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col bg-studio-canvas">
        <header className="flex items-center justify-between border-b border-studio-line px-6 py-[13px]">
          <div className="font-display text-[15px] font-medium">Chat</div>
          {turns.length > 0 && (
            <button
              onClick={() => setTurns([])}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-studio-muted hover:bg-studio-hover"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            {empty ? (
              <div className="flex min-h-[52vh] flex-col items-center justify-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-studio-bluesoft text-studio-blue">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h1 className="mt-5 font-display text-2xl font-medium">What can I help you build?</h1>
                <p className="mt-2 max-w-md text-sm text-studio-muted">
                  Type a prompt, attach an image (OCR) or audio (STT), pick a model, and run — all via your
                  OpenRouter key.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {turns.map((t, i) =>
                  t.role === 'user' ? (
                    <div key={i} className="flex flex-col items-end gap-1">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-studio-bluesoft px-4 py-2.5 text-sm">
                        {t.text || <span className="text-studio-muted">(no text)</span>}
                      </div>
                      {t.imageThumbs && t.imageThumbs.length > 0 && (
                        <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
                          {t.imageThumbs.map((src, k) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={k} src={src} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-studio-border" />
                          ))}
                        </div>
                      )}
                      {t.audioName && <div className="text-xs text-studio-muted">🎙 {t.audioName}</div>}
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3">
                      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-studio-blue text-white">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {t.stages ? (
                          <div className="space-y-2">
                            {t.stages.map((s, si) => (
                              <StageBlock key={si} stage={s} muted={s.name !== 'answer'} />
                            ))}
                            {t.metrics?.latencyMs != null && (
                              <div className="px-1 text-[11px] text-studio-faint">
                                total {t.metrics.tokens ? `${t.metrics.tokens} tok · ` : ''}
                                {t.metrics.latencyMs} ms
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="whitespace-pre-wrap text-[15px] leading-7">{t.text}</div>
                            {t.metrics?.latencyMs != null && (
                              <div className="mt-1 text-[11px] text-studio-faint">
                                {t.metrics.tokens != null ? `${t.metrics.tokens} tok · ` : ''}
                                {t.metrics.latencyMs} ms
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ),
                )}
                {streaming && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-studio-blue text-white">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-7">
                      {streamText || <Loader2 className="h-4 w-4 animate-spin text-studio-muted" />}
                      {streamText && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-studio-blue align-middle" />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 pt-1">
          <div className="mx-auto max-w-3xl">
            {error && <div className="mb-2 text-center text-xs text-red-600">{error}</div>}
            {(images.length > 0 || audio) && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <Chip
                    key={i}
                    label={img.name}
                    icon={<ImageIcon className="h-3.5 w-3.5" />}
                    onRemove={() => setImages(images.filter((_, idx) => idx !== i))}
                  />
                ))}
                {audio && <Chip label={audio.name} icon={<Mic className="h-3.5 w-3.5" />} onRemove={() => setAudio(null)} />}
              </div>
            )}
            <div className="flex items-end gap-1 rounded-[26px] border border-studio-border bg-white p-2 shadow-sm transition-colors focus-within:border-studio-blue">
              <button onClick={() => imageInput.current?.click()} title="Attach images (multiple)" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-studio-muted hover:bg-studio-hover">
                <ImageIcon className="h-5 w-5" />
              </button>
              <button onClick={() => audioInput.current?.click()} title="Attach audio" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-studio-muted hover:bg-studio-hover">
                <Mic className="h-5 w-5" />
              </button>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Enter a prompt here"
                className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] placeholder-studio-faint focus:outline-none"
              />
              {streaming ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  title="Stop"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  title="Send (Ctrl+Enter)"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-studio-blue text-white transition-colors hover:bg-studio-bluehover disabled:bg-[#c4c7c5]"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              )}
            </div>
            <input
              ref={imageInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) setImages((prev) => [...prev, ...Array.from(e.target.files!)]);
                e.target.value = '';
              }}
            />
            <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => setAudio(e.target.files?.[0] || null)} />
          </div>
        </div>
      </section>

      <RunSettings
        model={model}
        setModel={setModel}
        temperature={temperature}
        setTemperature={setTemperature}
        timeoutSec={timeoutSec}
        setTimeoutSec={setTimeoutSec}
        webSearch={webSearch}
        setWebSearch={setWebSearch}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        onReset={() => {
          setTemperature(0.7);
          setTimeoutSec(90);
          setWebSearch(false);
          setSystemPrompt('');
        }}
      />
    </>
  );
};

const Chip: React.FC<{ label: string; icon: React.ReactNode; onRemove: () => void }> = ({ label, icon, onRemove }) => (
  <span className="flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-surface px-3 py-1 text-xs">
    {icon}
    <span className="max-w-[160px] truncate">{label}</span>
    <button onClick={onRemove} className="text-studio-muted hover:text-studio-text">
      <X className="h-3.5 w-3.5" />
    </button>
  </span>
);
