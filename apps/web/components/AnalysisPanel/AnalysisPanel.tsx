import React from 'react';
import { Brain, Compass, Cpu, Gauge, Sparkles } from 'lucide-react';
import { AnalysisResult } from '../../types';

interface AnalysisPanelProps {
  analysis?: AnalysisResult;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis }) => {
  if (!analysis) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-gray-800 bg-gray-900/30 p-8 text-center">
        <Sparkles className="mb-3 h-10 w-10 text-gray-600 animate-pulse" />
        <p className="text-sm font-medium text-gray-400">Awaiting Query Analysis</p>
        <p className="mt-1 text-xs text-gray-600">
          Submit a query to inspect real-time SLM complexity & subject scoring
        </p>
      </div>
    );
  }

  const complexityColor = {
    low: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    medium: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    high: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    critical: 'text-red-400 border-red-500/30 bg-red-500/10',
  }[analysis.complexity.level] || 'text-blue-400 border-blue-500/30 bg-blue-500/10';

  return (
    <div className="flex flex-col space-y-4 rounded-2xl border border-gray-800 bg-gray-900/50 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center space-x-2">
          <Brain className="h-5 w-5 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">SLM Query Analysis</h3>
        </div>
        <span className="text-xs text-gray-400">Analysis Engine (:8004)</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Complexity Level</span>
            <Gauge className="h-4 w-4 text-gray-500" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${complexityColor}`}>
              {analysis.complexity.level}
            </span>
            <span className="text-xs font-medium text-gray-300">
              Score: {analysis.complexity.score.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Domain Subject</span>
            <Compass className="h-4 w-4 text-gray-500" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-purple-300">
              {analysis.subject.primary.replace('_', ' ')}
            </span>
            <span className="text-xs font-medium text-gray-300">
              {(analysis.subject.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Reasoning Profile</span>
          <span className="text-xs text-gray-400">Est. Steps: {analysis.reasoning.estimated_steps}</span>
        </div>
        <p className="mt-1.5 text-sm font-semibold capitalize text-gray-200">
          {analysis.reasoning.type} Reasoning
        </p>
        <div className="mt-2 flex items-center space-x-2 text-xs text-gray-400">
          <Cpu className="h-3.5 w-3.5 text-blue-400" />
          <span>Profile: {analysis.instruction_profile?.title || 'General Assistant'}</span>
        </div>
      </div>
    </div>
  );
};
