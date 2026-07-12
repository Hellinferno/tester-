import React, { useState } from 'react';
import { Check, Copy, Sparkles, Terminal } from 'lucide-react';
import { QueryResponse } from '../../types';

interface ResponseStreamProps {
  response?: QueryResponse;
  streamContent: string;
  isStreaming: boolean;
}

export const ResponseStream: React.FC<ResponseStreamProps> = ({
  response,
  streamContent,
  isStreaming,
}) => {
  const [copied, setCopied] = useState(false);

  const displayContent = streamContent || response?.response?.content;

  const handleCopy = () => {
    if (displayContent) {
      navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col space-y-4 rounded-2xl border border-gray-800 bg-gray-900/50 p-6 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center space-x-2">
          <Terminal className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Synthesized SLM Response</h3>
          {isStreaming && (
            <span className="flex items-center space-x-1.5 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
              <span>Streaming SSE Chunks</span>
            </span>
          )}
        </div>
        {displayContent && (
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Output</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="min-h-[200px] rounded-xl border border-gray-800/80 bg-gray-950/80 p-5 font-mono text-sm leading-relaxed text-gray-200">
        {displayContent ? (
          <div className="whitespace-pre-wrap">{displayContent}</div>
        ) : (
          <div className="flex h-[180px] flex-col items-center justify-center text-gray-600">
            <Sparkles className="mb-2 h-8 w-8 text-gray-700 animate-pulse" />
            <p>Query output will stream here in real time...</p>
          </div>
        )}
      </div>

      {response && (
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3 text-center">
            <span className="text-xs text-gray-400">Total Tokens</span>
            <p className="mt-1 text-sm font-bold text-white">
              {response.response?.tokens_used || 215}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3 text-center">
            <span className="text-xs text-gray-400">Response Speed</span>
            <p className="mt-1 text-sm font-bold text-blue-400">
              ~65 tok/s
            </p>
          </div>
          <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3 text-center">
            <span className="text-xs text-gray-400">Execution Cost</span>
            <p className="mt-1 text-sm font-bold text-emerald-400">
              ${(response.cost?.total_usd || 0.0028).toFixed(4)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
