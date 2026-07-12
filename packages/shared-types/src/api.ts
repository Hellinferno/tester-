/** API request/response contracts. Mirrors 06-api-contracts.md. */
import type {
  ComplexityLevel,
  EstimatedLength,
  Modality,
  OutputFormat,
  ReasoningType,
} from './models.js';

// ── POST /queries ───────────────────────────────────────────────────
export interface QuerySubmitOptions {
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  returnAnalysis?: boolean;
  returnRoutingInfo?: boolean;
  /** routing priority: cost | latency | quality | balanced */
  priority?: 'cost' | 'latency' | 'quality' | 'balanced';
  maxLatencyMs?: number;
  budgetUsd?: number;
}

export interface QuerySubmitRequest {
  modality: Modality;
  text?: string;
  /** base64 data-url when submitted as JSON; multipart binary also supported */
  imageDataUrl?: string;
  voiceDataUrl?: string;
  systemInstructionProfileId?: string;
  options?: QuerySubmitOptions;
}

export interface QueryAcceptedResponse {
  requestId: string;
  status: 'accepted';
  modality: Modality;
  estimatedProcessingTimeMs: number;
  statusUrl: string;
  resultUrl: string;
  sseUrl: string;
  expiresAt: string;
}

// ── GET /queries/{id}/status ───────────────────────────────────────
export interface QueryProgress {
  inputValidated: boolean;
  ocrCompleted: boolean;
  sttCompleted: boolean;
  analysisCompleted: boolean;
  routingCompleted: boolean;
  responseGenerated: boolean;
}

export interface QueryStatusResponse {
  requestId: string;
  status: string;
  modality: Modality;
  progress: QueryProgress;
  currentStage:
    | 'queued'
    | 'input_validation'
    | 'ocr_processing'
    | 'stt_processing'
    | 'slm_analysis'
    | 'routing'
    | 'response_generation'
    | 'completed'
    | 'failed';
  estimatedRemainingMs: number | null;
  startedAt: string;
  updatedAt: string;
}

// ── GET /queries/{id}/result ───────────────────────────────────────
export interface QueryResultResponse {
  requestId: string;
  status: 'completed' | 'failed';
  modality: Modality;
  input: {
    text?: string;
    imageId?: string;
    voiceId?: string;
  };
  processing?: {
    ocr?: { extractedText: string; confidence: number; engine: string };
    stt?: { transcript: string; confidence: number; engine: string };
    analysis?: {
      complexity: ComplexityLevel;
      subject: string;
      reasoning: ReasoningType;
      intent: string;
    };
    routing?: {
      selectedModel: string;
      fallbackUsed: boolean;
      latencyMs: number;
    };
  };
  response?: {
    content: string;
    contentType: string;
    tokensUsed: number;
    tokensInput: number;
    tokensOutput: number;
    finishReason: string;
    generatedAt: string;
  };
  cost?: {
    totalUsd: number;
    modelCost: number;
    processingCost: number;
  };
  error?: { code: string; message: string };
}

// ── SSE events (replaces WebSocket in the spec) ─────────────────────
export type SseEvent =
  | { event: 'status'; data: { stage: string; progress: number } }
  | { event: 'analysis'; data: { complexity: ComplexityLevel; subject: string } }
  | { event: 'routing'; data: { model: string; confidence: number } }
  | { event: 'chunk'; data: { content: string; index: number } }
  | { event: 'complete'; data: { tokensUsed: number; finishReason: string } }
  | { event: 'error'; data: { code: string; message: string } };

// ── System instruction profile CRUD ─────────────────────────────────
export interface SystemInstructionProfileInput {
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
  applicableModalities: Modality[];
  applicableSubjects: string[];
  applicableComplexityLevels: ComplexityLevel[];
}

// ── Analytics ───────────────────────────────────────────────────────
export interface AnalyticsSummary {
  totalRequests: number;
  averageLatencyMs: number;
  totalCostUsd: number;
  routingAccuracy: number;
}

export interface AnalyticsResponse {
  period: { start: string; end: string };
  summary: AnalyticsSummary;
  byModality: Record<Modality, { requests: number; avgLatencyMs: number }>;
  byModel: Record<string, { requests: number; avgCost: number }>;
  byComplexity: Record<ComplexityLevel, { requests: number; avgLatencyMs: number }>;
}

// ── Error envelope (RFC 7807-ish, see rules.md §2.2) ────────────────
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
    timestamp: string;
  };
}

export const ERROR_CODES = {
  INVALID_MODALITY: { status: 400, message: 'Invalid modality specified' },
  MISSING_MEDIA: { status: 400, message: 'Required media not provided' },
  MISSING_TEXT: { status: 400, message: 'Required text input not provided' },
  FILE_TOO_LARGE: { status: 413, message: 'File exceeds maximum size' },
  UNSUPPORTED_FORMAT: { status: 415, message: 'Unsupported file format' },
  RATE_LIMIT_EXCEEDED: { status: 429, message: 'Rate limit exceeded' },
  UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  FORBIDDEN: { status: 403, message: 'Insufficient permissions' },
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  MODEL_UNAVAILABLE: { status: 503, message: 'Selected model unavailable' },
  OCR_FAILED: { status: 422, message: 'OCR processing failed' },
  STT_FAILED: { status: 422, message: 'STT processing failed' },
  ROUTING_ERROR: { status: 500, message: 'Model routing failed' },
  OPENROUTER_ERROR: { status: 502, message: 'Upstream provider error' },
  ANALYSIS_FAILED: { status: 500, message: 'Query analysis failed' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// ── OCR / STT testing endpoints ─────────────────────────────────────
export type OcrEngine = 'tesseract' | 'easyocr' | 'paddleocr';
export type SttEngine = 'whisper' | 'deepgram';

export interface OcrTestRequest {
  imageDataUrl: string;
  groundTruth: string;
  options?: {
    engines?: OcrEngine[];
    language?: string;
    returnBoundingBoxes?: boolean;
    preprocessing?: { denoise?: boolean; deskew?: boolean; contrastEnhance?: boolean };
  };
}

export interface OcrTestResultItem {
  engine: OcrEngine;
  extractedText: string;
  confidence: number;
  metrics: { characterAccuracy: number; wordAccuracy: number; cer: number; wer: number };
  boundingBoxes?: Array<{ text: string; bbox: number[]; conf: number }>;
  processingTimeMs: number;
}

export interface SttTestRequest {
  audioDataUrl: string;
  groundTruth: string;
  options?: { engines?: SttEngine[]; language?: string; returnWordTimestamps?: boolean };
}

export interface SttTestResultItem {
  engine: SttEngine;
  transcript: string;
  confidence: number;
  metrics: { wer: number; mer: number; wil: number; rtf: number };
  words?: Array<{ word: string; start: number; end: number; conf: number }>;
  processingTimeMs: number;
}

// Re-export commonly used model types for API consumers
export type { ComplexityLevel, OutputFormat, EstimatedLength, ReasoningType };
