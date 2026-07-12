import React, { useState, useEffect } from 'react';
import { Plus, RotateCcw, Save, Settings, Trash2 } from 'lucide-react';
import { Toggle } from '../../../../packages/ui-components/src/components/Toggle';
import { Slider } from '../../../../packages/ui-components/src/components/Slider';

export interface InstructionProfileConfig {
  id: string;
  title: string;
  instructions: string;
  temperature: number;
  thinkingMode: boolean;
  thinkingBudget: number;
  structuredOutputs: boolean;
  codeExecution: boolean;
  functionCalling: boolean;
  groundingGoogleSearch: boolean;
  groundingGoogleMaps: boolean;
  urlContext: boolean;
  modalities: string[];
  subjects: string[];
  complexity: string[];
}

const DEFAULT_PROFILES: InstructionProfileConfig[] = [
  {
    id: 'prof-1',
    title: 'Technical Analysis',
    instructions:
      'You are a technical analyst. Provide detailed, structured explanations with code examples when relevant. Be precise and cite sources.',
    temperature: 0.3,
    thinkingMode: true,
    thinkingBudget: 4000,
    structuredOutputs: true,
    codeExecution: true,
    functionCalling: false,
    groundingGoogleSearch: true,
    groundingGoogleMaps: false,
    urlContext: true,
    modalities: ['image_text', 'text_only'],
    subjects: ['computer_science', 'mathematics'],
    complexity: ['high', 'critical'],
  },
  {
    id: 'prof-2',
    title: 'General Multi-Modal Assistant',
    instructions:
      'You are a helpful multi-modal assistant capable of inspecting visual and audio context accurately.',
    temperature: 0.7,
    thinkingMode: false,
    thinkingBudget: 0,
    structuredOutputs: false,
    codeExecution: false,
    functionCalling: false,
    groundingGoogleSearch: false,
    groundingGoogleMaps: false,
    urlContext: false,
    modalities: ['image_text', 'image_voice', 'image_only', 'voice_only', 'text_only'],
    subjects: ['general_knowledge', 'literature'],
    complexity: ['low', 'medium'],
  },
];

export const SystemInstructionEditor: React.FC = () => {
  const [profiles, setProfiles] = useState<InstructionProfileConfig[]>(DEFAULT_PROFILES);
  const [selectedId, setSelectedId] = useState<string>('prof-1');
  const [current, setCurrent] = useState<InstructionProfileConfig>(DEFAULT_PROFILES[0]);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    const loaded = profiles.find((p) => p.id === selectedId);
    if (loaded) setCurrent(loaded);
  }, [selectedId, profiles]);

  const handleFieldChange = (field: keyof InstructionProfileConfig, value: any) => {
    setCurrent((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === current.id ? current : p))
    );
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const handleCreateNew = () => {
    const newProfile: InstructionProfileConfig = {
      id: 'prof-' + Date.now(),
      title: 'New Instruction Profile',
      instructions: 'Enter instructions for Small Language Model behavior...',
      temperature: 0.7,
      thinkingMode: false,
      thinkingBudget: 2000,
      structuredOutputs: false,
      codeExecution: false,
      functionCalling: false,
      groundingGoogleSearch: false,
      groundingGoogleMaps: false,
      urlContext: false,
      modalities: ['image_text', 'text_only'],
      subjects: ['general_knowledge'],
      complexity: ['medium'],
    };
    setProfiles((prev) => [...prev, newProfile]);
    setSelectedId(newProfile.id);
  };

  const handleDelete = () => {
    if (profiles.length <= 1) return;
    const remaining = profiles.filter((p) => p.id !== current.id);
    setProfiles(remaining);
    setSelectedId(remaining[0].id);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Sidebar profile list */}
      <div className="flex flex-col space-y-4 rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-xl backdrop-blur-xl lg:col-span-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Instruction Profiles</h3>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center space-x-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>
        </div>

        <div className="space-y-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                p.id === selectedId
                  ? 'border-purple-500/50 bg-purple-500/15 text-white shadow-md'
                  : 'border-gray-800 bg-gray-950/50 text-gray-400 hover:border-gray-700 hover:text-gray-200'
              }`}
            >
              <h4 className="text-sm font-bold truncate">{p.title}</h4>
              <p className="mt-1 text-xs text-gray-400 line-clamp-1">{p.instructions}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Editor Details */}
      <div className="flex flex-col space-y-6 rounded-2xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl backdrop-blur-xl lg:col-span-8">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h2 className="text-base font-bold text-white">Edit Profile: {current.title}</h2>
          {savedMessage && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
              Saved successfully!
            </span>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
            Profile Title
          </label>
          <input
            type="text"
            value={current.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            className="w-full rounded-xl border border-gray-800 bg-gray-950/80 p-3 text-sm font-semibold text-white focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Instructions */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
            System Instructions
          </label>
          <textarea
            rows={4}
            value={current.instructions}
            onChange={(e) => handleFieldChange('instructions', e.target.value)}
            className="w-full rounded-xl border border-gray-800 bg-gray-950/80 p-3.5 text-sm text-white focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Configuration grid */}
        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-5 space-y-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-800 pb-2">
            SLM Generation & Grounding Configuration
          </h4>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Slider
                label="Temperature"
                min={0}
                max={2}
                step={0.1}
                value={current.temperature}
                onChange={(value) => handleFieldChange('temperature', value)}
                unit=""
              />
            </div>

            <div className="flex items-center justify-between">
              <Toggle
                label="Thinking Mode"
                description="Enable chain-of-thought internal reasoning"
                checked={current.thinkingMode}
                onChange={(checked) => handleFieldChange('thinkingMode', checked)}
              />
            </div>
          </div>

          {current.thinkingMode && (
            <div className="pl-4 border-l-2 border-purple-500/40">
              <Slider
                label="Thinking Budget (tokens)"
                min={1000}
                max={16000}
                step={1000}
                value={current.thinkingBudget}
                onChange={(value) => handleFieldChange('thinkingBudget', value)}
                unit=" tokens"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Toggle
              label="Structured Outputs"
              description="Enforce strict JSON Schema formatting"
              checked={current.structuredOutputs}
              onChange={(checked) => handleFieldChange('structuredOutputs', checked)}
            />
            <Toggle
              label="Code Execution"
              description="Allow SLM to run Python code interpreter"
              checked={current.codeExecution}
              onChange={(checked) => handleFieldChange('codeExecution', checked)}
            />
            <Toggle
              label="Grounding with Google Search"
              description="Real-time live web factual lookup"
              checked={current.groundingGoogleSearch}
              onChange={(checked) => handleFieldChange('groundingGoogleSearch', checked)}
            />
            <Toggle
              label="URL Context"
              description="Inspect cited external URLs automatically"
              checked={current.urlContext}
              onChange={(checked) => handleFieldChange('urlContext', checked)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/25 hover:bg-purple-500"
            >
              <Save className="h-4 w-4" />
              <span>Save Profile</span>
            </button>
            <button
              onClick={() => setCurrent(DEFAULT_PROFILES[0])}
              className="flex items-center space-x-1.5 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-gray-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
          </div>

          <button
            onClick={handleDelete}
            disabled={profiles.length <= 1}
            className="flex items-center space-x-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
