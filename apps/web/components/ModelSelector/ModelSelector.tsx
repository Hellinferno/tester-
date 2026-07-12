import React from 'react';
import { ArrowRight, CheckCircle2, Cpu, Layers } from 'lucide-react';
import { RoutingDecision } from '../../types';

interface ModelSelectorProps {
  routing?: RoutingDecision;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ routing }) => {
  if (!routing) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-gray-800 bg-gray-900/30 p-8 text-center">
        <Cpu className="mb-3 h-10 w-10 text-gray-600 animate-pulse" />
        <p className="text-sm font-medium text-gray-400">Awaiting Model Routing</p>
        <p className="mt-1 text-xs text-gray-600">
          Intelligent router assigns the optimal model & fallback chain
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 rounded-2xl border border-gray-800 bg-gray-900/50 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center space-x-2">
          <Layers className="h-5 w-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Model Router Decision</h3>
        </div>
        <span className="text-xs text-gray-400">Router Service (:8005)</span>
      </div>

      <div className="rounded-xl border border-blue-500/40 bg-gradient-to-r from-blue-900/30 to-indigo-900/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-xs font-medium text-blue-300">Primary Selected Model</p>
              <h4 className="text-base font-bold text-white">{routing.display_name}</h4>
            </div>
          </div>
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-500/30">
            {(routing.confidence * 100).toFixed(0)}% Match
          </span>
        </div>
        {routing.reasoning && (
          <p className="mt-2.5 text-xs text-gray-300 border-t border-blue-500/20 pt-2">
            {routing.reasoning}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3">
          <span className="text-xs text-gray-400">Estimated Latency</span>
          <p className="mt-1 text-sm font-semibold text-gray-200">
            {routing.estimated_latency_ms || 1800} ms
          </p>
        </div>
        <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3">
          <span className="text-xs text-gray-400">Estimated Cost</span>
          <p className="mt-1 text-sm font-semibold text-emerald-400">
            ${routing.estimated_cost_usd.toFixed(4)} USD
          </p>
        </div>
      </div>

      {routing.fallback_chain && routing.fallback_chain.length > 0 && (
        <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3">
          <p className="text-xs font-medium text-gray-400 mb-2">Automated Fallback Chain</p>
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-300">
              {routing.display_name}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-gray-500" />
            {routing.fallback_chain.map((fb, i) => (
              <React.Fragment key={fb}>
                <span className="rounded-md bg-gray-800/60 px-2.5 py-1 text-xs text-gray-400">
                  {fb.split('/').pop()}
                </span>
                {i < routing.fallback_chain.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-gray-500" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
