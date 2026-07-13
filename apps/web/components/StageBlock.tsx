'use client';

import React from 'react';
import { Stage } from '../lib/openrouter';

/** Renders one pipeline step (OCR read / STT transcript / Answer) with its own
 *  output plus token usage and time taken. */
export const StageBlock: React.FC<{ stage: Stage; muted?: boolean }> = ({ stage, muted }) => (
  <div className={`rounded-lg border p-2.5 ${muted ? 'border-studio-line bg-studio-surface' : 'border-studio-border bg-white'}`}>
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-studio-muted">{stage.label}</span>
      <span className="shrink-0 font-mono text-[10px] text-studio-faint">
        {stage.usage?.total_tokens != null ? `${stage.usage.total_tokens} tok · ` : ''}
        {stage.latencyMs} ms
      </span>
    </div>
    <div className="max-h-56 overflow-y-auto whitespace-pre-wrap text-[13px] leading-6 text-studio-text">
      {stage.error ? (
        <span className="text-red-600">{stage.error}</span>
      ) : (
        stage.text || <span className="text-studio-faint">(empty)</span>
      )}
    </div>
  </div>
);
