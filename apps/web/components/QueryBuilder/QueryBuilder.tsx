import React, { useState } from 'react';
import { Camera, Cpu, FileAudio, Globe, MessageSquare, Play, RefreshCw, Sliders, Zap } from 'lucide-react';
import { MediaUploader } from '../MediaUploader/MediaUploader';
import { Modality } from '../../types';
import { MODEL_OPTIONS } from '../../lib/models';
import { DEFAULT_MODEL } from '../../lib/settings';

interface QueryBuilderProps {
  onSubmit: (data: {
    modality: Modality;
    text: string;
    image: File | null;
    voice: File | null;
    stream: boolean;
    priority: string;
    model: string;
    webSearch: boolean;
  }) => void;
  isLoading: boolean;
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({ onSubmit, isLoading }) => {
  const [modality, setModality] = useState<Modality>('image_text');
  const [text, setText] = useState('Analyze the architecture diagram and identify potential serverless cold-start bottlenecks.');
  const [image, setImage] = useState<File | null>(null);
  const [voice, setVoice] = useState<File | null>(null);
  const [stream, setStream] = useState(true);
  const [webSearch, setWebSearch] = useState(false);
  const [priority, setPriority] = useState<'quality' | 'cost' | 'latency'>('quality');
  // Model choice: an id from MODEL_OPTIONS, or 'custom' to type any OpenRouter id.
  const [modelChoice, setModelChoice] = useState<string>(DEFAULT_MODEL);
  const [customModel, setCustomModel] = useState('');

  const modalities: { id: Modality; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'image_text', label: 'Image + Text', icon: Camera },
    { id: 'image_voice', label: 'Image + Voice', icon: FileAudio },
    { id: 'text_only', label: 'Text Only', icon: MessageSquare },
    { id: 'image_only', label: 'Image Only', icon: Camera },
    { id: 'voice_only', label: 'Voice Only', icon: FileAudio },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 'custom' -> the free-text id; fall back to 'auto' if left empty.
    const model =
      modelChoice === 'custom' ? customModel.trim() || 'auto' : modelChoice;
    onSubmit({
      modality,
      text,
      image,
      voice,
      stream,
      priority,
      model,
      webSearch,
    });
  };

  const loadSamplePreset = () => {
    setModality('image_text');
    setText('Examine this technical schematic and summarize the multi-modal pipeline flow.');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col space-y-5 rounded-2xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center space-x-2">
          <Zap className="h-5 w-5 text-blue-400" />
          <h2 className="text-base font-bold text-white">Multi-Modal Query Builder</h2>
        </div>
        <button
          type="button"
          onClick={loadSamplePreset}
          className="flex items-center space-x-1.5 rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700"
        >
          <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
          <span>Load Preset</span>
        </button>
      </div>

      {/* Modality selector */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
          Input Modality
        </label>
        <div className="grid grid-cols-5 gap-2">
          {modalities.map((item) => {
            const Icon = item.icon;
            const selected = modality === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setModality(item.id)}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all duration-150 ${
                  selected
                    ? 'border-blue-500 bg-blue-500/15 text-white shadow-md shadow-blue-500/10'
                    : 'border-gray-800 bg-gray-950/60 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                }`}
              >
                <Icon className="mb-1.5 h-4 w-4" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Media Uploads depending on Modality */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {modality.includes('image') && (
          <MediaUploader
            label="Image Media Input (OCR Engine)"
            accept="image/*"
            type="image"
            file={image}
            onFileSelect={setImage}
          />
        )}
        {modality.includes('voice') && (
          <MediaUploader
            label="Voice / Audio Input (STT Engine)"
            accept="audio/*"
            type="voice"
            file={voice}
            onFileSelect={setVoice}
          />
        )}
      </div>

      {/* Text Prompt */}
      {modality !== 'image_only' && modality !== 'voice_only' && (
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
            Prompt / Question Context
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Type your instruction or prompt for the multi-modal SLM router..."
            className="w-full rounded-xl border border-gray-800 bg-gray-950/80 p-3.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Model selection (BYOK — user picks the generation model) */}
      <div>
        <label className="mb-2 flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <Cpu className="h-3.5 w-3.5 text-blue-400" />
          <span>Generation Model</span>
        </label>
        <select
          value={modelChoice}
          onChange={(e) => setModelChoice(e.target.value)}
          className="w-full rounded-xl border border-gray-800 bg-gray-950/80 p-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id} className="bg-gray-950">
              {m.label}
            </option>
          ))}
        </select>
        {modelChoice === 'custom' && (
          <input
            type="text"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="e.g. mistralai/mistral-large — any OpenRouter model id"
            className="mt-2 w-full rounded-xl border border-gray-800 bg-gray-950/80 p-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
        {modelChoice === 'auto' && (
          <p className="mt-1.5 text-xs text-gray-500">
            The router picks the best model for your query automatically.
          </p>
        )}
      </div>

      {/* Router preferences & Controls */}
      <div className="flex flex-wrap items-center justify-between rounded-xl border border-gray-800/80 bg-gray-950/60 p-3.5 gap-3">
        <div className="flex items-center space-x-3">
          <Sliders className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-300">Router Priority:</span>
          {(['quality', 'cost', 'latency'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-all ${
                priority === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer" title="Ground the answer with live Google results (SerpAPI). Works in non-streaming mode.">
            <input
              type="checkbox"
              checked={webSearch}
              onChange={(e) => setWebSearch(e.target.checked)}
              className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
            />
            <Globe className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-medium text-gray-300">Web Search</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={stream}
              onChange={(e) => setStream(e.target.checked)}
              className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-gray-300">Stream SSE</span>
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-blue-500/40 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Orchestrating Multi-Modal Pipeline...</span>
          </>
        ) : (
          <>
            <Play className="h-4 w-4 fill-current" />
            <span>Execute Query via Orchestrator</span>
          </>
        )}
      </button>
    </form>
  );
};
