'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ImageIcon, Loader2, Mic, Sparkles, X } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { RunSettings } from '../components/RunSettings';
import { SystemInstructionEditor } from '../components/SystemInstructionEditor/SystemInstructionEditor';
import { AnalysisPanel } from '../components/AnalysisPanel/AnalysisPanel';
import { ModelSelector } from '../components/ModelSelector/ModelSelector';
import { Modality, QueryResponse } from '../types';
import { getOpenRouterKey, ORCHESTRATOR_URL, DEFAULT_MODEL } from '../lib/settings';

type Source = { title: string; link: string };

function deriveModality(text: string, image: File | null, voice: File | null): Modality {
  const hasText = !!text.trim();
  if (image && voice) return 'image_voice';
  if (image) return (hasText ? 'image_text' : 'image_only') as Modality;
  if (voice) return 'voice_only';
  return 'text_only';
}

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState('query');

  // run settings
  const [modelChoice, setModelChoice] = useState<string>(DEFAULT_MODEL);
  const [customModel, setCustomModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [webSearch, setWebSearch] = useState(false);
  const [stream, setStream] = useState(true);

  // prompt input
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [voice, setVoice] = useState<File | null>(null);

  // run output
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [queryResponse, setQueryResponse] = useState<QueryResponse | undefined>(undefined);
  const [sentPrompt, setSentPrompt] = useState<{ text: string; image?: string; voice?: string } | null>(null);
  const [sources, setSources] = useState<Source[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const voiceInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [streamContent, queryResponse]);

  const resolvedModel = modelChoice === 'custom' ? customModel.trim() || 'auto' : modelChoice;
  const answer = isStreaming ? streamContent : queryResponse?.response?.content || '';
  const canRun = !isLoading && (!!text.trim() || !!image || !!voice);

  const handleReset = () => {
    setModelChoice(DEFAULT_MODEL);
    setCustomModel('');
    setTemperature(0.7);
    setWebSearch(false);
  };

  const handleRun = async () => {
    if (!canRun) return;
    const modality = deriveModality(text, image, voice);

    setSentPrompt({ text: text.trim(), image: image?.name, voice: voice?.name });
    setIsLoading(true);
    setIsStreaming(false);
    setStreamContent('');
    setSources([]);
    setQueryResponse(undefined);

    const formData = new FormData();
    formData.append('modality', modality);
    formData.append('text', text);
    if (image) formData.append('image', image);
    if (voice) formData.append('voice', voice);
    formData.append(
      'options',
      JSON.stringify({
        stream,
        priority: 'quality',
        model: resolvedModel,
        web_search: webSearch,
        temperature,
      }),
    );

    const apiKey = getOpenRouterKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers['X-OpenRouter-Key'] = apiKey;

    setText('');

    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/v1/queries`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.ok && stream && response.body) {
        setIsLoading(false);
        setIsStreaming(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let full = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(line.slice(6).trim());
              if (parsed.event === 'analysis') {
                setQueryResponse((p: any) => ({ ...p, processing: { ...p?.processing, analysis: parsed.data } }));
              } else if (parsed.event === 'routing') {
                setQueryResponse((p: any) => ({ ...p, processing: { ...p?.processing, routing: parsed.data } }));
              } else if (parsed.event === 'grounding') {
                setSources(parsed.data?.sources || []);
              } else if (parsed.event === 'chunk') {
                full += parsed.data.content;
                setStreamContent(full);
              }
            } catch {
              /* ignore keepalive / partial lines */
            }
          }
        }
        setIsStreaming(false);
        return;
      }

      if (response.ok) {
        const json = await response.json();
        setQueryResponse(json);
        setSources(json?.processing?.grounding?.sources || []);
        setIsLoading(false);
        return;
      }
    } catch {
      /* fall through to offline notice */
    }

    setIsLoading(false);
    setStreamContent(
      'Could not reach the orchestrator. Check that the service is running and NEXT_PUBLIC_ORCHESTRATOR_URL is set.',
    );
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-studio-canvas text-studio-text">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex min-w-0 flex-1">
        {activeTab === 'query' ? (
          <>
            {/* Center: chat canvas */}
            <section className="flex min-w-0 flex-1 flex-col bg-studio-canvas">
              <header className="flex items-center justify-between border-b border-studio-line px-6 py-[13px]">
                <div className="font-display text-[15px] font-medium">Chat</div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-studio-muted">
                  <input
                    type="checkbox"
                    checked={stream}
                    onChange={(e) => setStream(e.target.checked)}
                    className="h-3.5 w-3.5 accent-studio-blue"
                  />
                  Stream response
                </label>
              </header>

              <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-6 py-8">
                  {!sentPrompt && !answer ? (
                    <div className="flex min-h-[52vh] flex-col items-center justify-center text-center">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-studio-bluesoft text-studio-blue">
                        <Sparkles className="h-7 w-7" />
                      </div>
                      <h1 className="mt-5 font-display text-2xl font-medium text-studio-text">
                        What can I help you build?
                      </h1>
                      <p className="mt-2 max-w-md text-sm text-studio-muted">
                        Type a prompt, attach an image or audio, choose a model in Run settings, and run.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {sentPrompt && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-studio-bluesoft px-4 py-2.5 text-sm text-studio-text">
                            {sentPrompt.text || <span className="text-studio-muted">(no text)</span>}
                          </div>
                          {(sentPrompt.image || sentPrompt.voice) && (
                            <div className="flex gap-1.5 text-xs text-studio-muted">
                              {sentPrompt.image && <span>🖼 {sentPrompt.image}</span>}
                              {sentPrompt.voice && <span>🎙 {sentPrompt.voice}</span>}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-studio-blue text-white">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {isLoading && !answer ? (
                            <div className="flex items-center gap-2 py-1 text-sm text-studio-muted">
                              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap text-[15px] leading-7 text-studio-text">
                              {answer}
                              {isStreaming && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-studio-blue align-middle" />}
                            </div>
                          )}

                          {sources.length > 0 && (
                            <div className="mt-4">
                              <div className="mb-1.5 text-xs font-medium text-studio-muted">Sources</div>
                              <div className="flex flex-wrap gap-2">
                                {sources.map((s, i) => (
                                  <a
                                    key={i}
                                    href={s.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="max-w-[240px] truncate rounded-full border border-studio-border bg-studio-surface px-3 py-1 text-xs text-studio-bluetext hover:bg-studio-hover"
                                  >
                                    {s.title || s.link}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Prompt bar */}
              <div className="px-6 pb-6 pt-1">
                <div className="mx-auto max-w-3xl">
                  {(image || voice) && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {image && (
                        <Chip label={image.name} onRemove={() => setImage(null)} icon={<ImageIcon className="h-3.5 w-3.5" />} />
                      )}
                      {voice && (
                        <Chip label={voice.name} onRemove={() => setVoice(null)} icon={<Mic className="h-3.5 w-3.5" />} />
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-1 rounded-[26px] border border-studio-border bg-white p-2 shadow-sm transition-colors focus-within:border-studio-blue">
                    <button
                      onClick={() => imageInput.current?.click()}
                      title="Attach image"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-studio-muted hover:bg-studio-hover"
                    >
                      <ImageIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => voiceInput.current?.click()}
                      title="Attach audio"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-studio-muted hover:bg-studio-hover"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={onKeyDown}
                      rows={1}
                      placeholder="Enter a prompt here"
                      className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] text-studio-text placeholder-studio-faint focus:outline-none"
                    />
                    <button
                      onClick={handleRun}
                      disabled={!canRun}
                      title="Run (Ctrl+Enter)"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-studio-blue text-white transition-colors hover:bg-studio-bluehover disabled:bg-[#c4c7c5]"
                    >
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="mt-2 text-center text-xs text-studio-faint">
                    Bring your own OpenRouter key in the sidebar. Ctrl/⌘ + Enter to run.
                  </p>
                </div>
                <input
                  ref={imageInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
                <input
                  ref={voiceInput}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => setVoice(e.target.files?.[0] || null)}
                />
              </div>
            </section>

            <RunSettings
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
              customModel={customModel}
              setCustomModel={setCustomModel}
              temperature={temperature}
              setTemperature={setTemperature}
              webSearch={webSearch}
              setWebSearch={setWebSearch}
              analysis={queryResponse?.processing?.analysis}
              routing={queryResponse?.processing?.routing}
              onReset={handleReset}
            />
          </>
        ) : (
          <section className="min-w-0 flex-1 overflow-y-auto bg-studio-canvas">
            <div className="mx-auto max-w-5xl px-6 py-8">
              {activeTab === 'system-instructions' && <SystemInstructionEditor />}
              {activeTab === 'analytics' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <AnalysisPanel analysis={queryResponse?.processing?.analysis} />
                  <ModelSelector routing={queryResponse?.processing?.routing} />
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const Chip: React.FC<{ label: string; onRemove: () => void; icon: React.ReactNode }> = ({ label, onRemove, icon }) => (
  <span className="flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-surface px-3 py-1 text-xs text-studio-text">
    {icon}
    <span className="max-w-[160px] truncate">{label}</span>
    <button onClick={onRemove} className="text-studio-muted hover:text-studio-text">
      <X className="h-3.5 w-3.5" />
    </button>
  </span>
);
