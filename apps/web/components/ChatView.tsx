'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ImageIcon, Loader2, Mic, Sparkles, Trash2, X } from 'lucide-react';
import { RunSettings } from './RunSettings';
import {
  ChatMessage,
  chatStream,
  fileToAudio,
  fileToDataURL,
  userMessage,
} from '../lib/openrouter';
import { getOpenRouterKey, getStored, setStored } from '../lib/settings';

type Turn = { role: 'user' | 'assistant'; text: string; imageName?: string; audioName?: string };

export const ChatView: React.FC = () => {
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [webSearch, setWebSearch] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');

  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  // restore + persist settings
  useEffect(() => {
    setModel(getStored('or.chat.model', ''));
    setTemperature(getStored('or.chat.temp', 0.7));
    setWebSearch(getStored('or.chat.web', false));
    setSystemPrompt(getStored('or.chat.system', ''));
  }, []);
  useEffect(() => setStored('or.chat.model', model), [model]);
  useEffect(() => setStored('or.chat.temp', temperature), [temperature]);
  useEffect(() => setStored('or.chat.web', webSearch), [webSearch]);
  useEffect(() => setStored('or.chat.system', systemPrompt), [systemPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, streamText]);

  const canSend = !streaming && (!!text.trim() || !!image || !!audio);

  const handleSend = async () => {
    if (!canSend) return;
    setError('');
    const apiKey = getOpenRouterKey();
    if (!apiKey) return setError('Add your OpenRouter key in the sidebar first.');
    if (!model.trim()) return setError('Pick a model in Run settings.');

    const imageDataUrl = image ? await fileToDataURL(image) : undefined;
    const audioPart = audio ? await fileToAudio(audio) : undefined;

    const userTurn: Turn = { role: 'user', text: text.trim(), imageName: image?.name, audioName: audio?.name };
    const history = [...turns, userTurn];
    setTurns(history);

    const messages: ChatMessage[] = [];
    if (systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    for (const t of turns) messages.push({ role: t.role, content: t.text });
    messages.push(userMessage(text, imageDataUrl, audioPart));

    setText('');
    setImage(null);
    setAudio(null);
    setStreaming(true);
    setStreamText('');

    let acc = '';
    try {
      for await (const delta of chatStream({ model, messages, apiKey, temperature, webSearch })) {
        acc += delta;
        setStreamText(acc);
      }
      setTurns([...history, { role: 'assistant', text: acc }]);
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
                      {(t.imageName || t.audioName) && (
                        <div className="flex gap-2 text-xs text-studio-muted">
                          {t.imageName && <span>🖼 {t.imageName}</span>}
                          {t.audioName && <span>🎙 {t.audioName}</span>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3">
                      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-studio-blue text-white">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-7">{t.text}</div>
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
            {(image || audio) && (
              <div className="mb-2 flex flex-wrap gap-2">
                {image && <Chip label={image.name} icon={<ImageIcon className="h-3.5 w-3.5" />} onRemove={() => setImage(null)} />}
                {audio && <Chip label={audio.name} icon={<Mic className="h-3.5 w-3.5" />} onRemove={() => setAudio(null)} />}
              </div>
            )}
            <div className="flex items-end gap-1 rounded-[26px] border border-studio-border bg-white p-2 shadow-sm transition-colors focus-within:border-studio-blue">
              <button onClick={() => imageInput.current?.click()} title="Attach image" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-studio-muted hover:bg-studio-hover">
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
              <button
                onClick={handleSend}
                disabled={!canSend}
                title="Send (Ctrl+Enter)"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-studio-blue text-white transition-colors hover:bg-studio-bluehover disabled:bg-[#c4c7c5]"
              >
                {streaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
              </button>
            </div>
            <input ref={imageInput} type="file" accept="image/*" hidden onChange={(e) => setImage(e.target.files?.[0] || null)} />
            <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => setAudio(e.target.files?.[0] || null)} />
          </div>
        </div>
      </section>

      <RunSettings
        model={model}
        setModel={setModel}
        temperature={temperature}
        setTemperature={setTemperature}
        webSearch={webSearch}
        setWebSearch={setWebSearch}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        onReset={() => {
          setTemperature(0.7);
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
