/** Database row shapes (Postgres → TS). Mirrors supabase/migrations/*. */

export type Modality =
  | 'image_text'
  | 'image_voice'
  | 'image_only'
  | 'voice_only'
  | 'text_only';

export type RequestStatus =
  | 'pending'
  | 'processing'
  | 'analyzing'
  | 'routing'
  | 'generating'
  | 'completed'
  | 'failed';

export type UserRole = 'user' | 'admin' | 'developer';
export type UserTier = 'free' | 'pro' | 'enterprise';

export type ComplexityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ReasoningType =
  | 'factual'
  | 'analytical'
  | 'creative'
  | 'multi_step'
  | 'comparative'
  | 'synthetic';
export type OutputFormat = 'text' | 'json' | 'markdown' | 'code' | 'image';
export type EstimatedLength = 'short' | 'medium' | 'long';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  tier: UserTier;
  apiKey: string | null;
  rateLimitPerMinute: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface MediaFile {
  id: string;
  requestId: string | null;
  userId: string | null;
  mediaType: 'image' | 'voice';
  originalFilename: string | null;
  storageKey: string;
  storageBucket: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  sampleRate: number | null;
  checksum: string | null;
  createdAt: string;
}

export interface QueryRequest {
  id: string;
  sessionId: string | null;
  userId: string | null;
  modality: Modality;
  status: RequestStatus;
  inputText: string | null;
  inputTextHash: string | null;
  hasImage: boolean;
  hasVoice: boolean;
  imageId: string | null;
  voiceId: string | null;
  estimatedComplexity: ComplexityLevel | null;
  selectedModel: string | null;
  responseId: string | null;
  latencyMs: number | null;
  costUsd: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

export interface BoundingBox {
  text: string;
  bbox: [number, number, number, number]; // x1,y1,x2,y2
  conf: number;
}

export interface OcrResult {
  id: string;
  requestId: string;
  mediaId: string;
  extractedText: string | null;
  confidenceScore: number | null;
  languageDetected: string | null;
  processingTimeMs: number | null;
  engineUsed: string | null;
  wordCount: number | null;
  boundingBoxes: BoundingBox[] | null;
  rawResult: Record<string, unknown> | null;
  createdAt: string;
}

export interface SttWord {
  word: string;
  start: number;
  end: number;
  conf: number;
  speaker?: string;
}

export interface SttResult {
  id: string;
  requestId: string;
  mediaId: string;
  transcript: string | null;
  confidenceScore: number | null;
  languageDetected: string | null;
  processingTimeMs: number | null;
  engineUsed: string | null;
  wordCount: number | null;
  words: SttWord[] | null;
  speakerLabels: Record<string, unknown> | null;
  rawResult: Record<string, unknown> | null;
  createdAt: string;
}

export interface AnalysisResult {
  id: string;
  requestId: string;
  complexityLevel: ComplexityLevel | null;
  complexityScore: number | null;
  complexityReasoning: string | null;
  reasoningType: ReasoningType | null;
  estimatedSteps: number | null;
  requiresChainOfThought: boolean;
  primarySubject: string | null;
  subjectConfidence: number | null;
  subjectSubcategories: string[] | null;
  domainTags: string[] | null;
  primaryIntent: string | null;
  secondaryIntents: string[] | null;
  entities: Record<string, unknown> | null;
  queryReformulation: string | null;
  outputFormat: OutputFormat | null;
  estimatedLength: EstimatedLength | null;
  specialRequirements: string[] | null;
  systemInstructionProfileId: string | null;
  analysisTimeMs: number | null;
  rawAnalysis: Record<string, unknown> | null;
  createdAt: string;
}

export interface ModelConfig {
  id: string;
  modelId: string;
  provider: string;
  displayName: string | null;
  description: string | null;
  capabilities: string[];
  maxTokens: number | null;
  contextWindow: number | null;
  costPer1kInput: number;
  costPer1kOutput: number;
  averageLatencyMs: number | null;
  isActive: boolean;
  isFallback: boolean;
  priority: number;
  metadata: Record<string, unknown>;
}

export interface RoutingDecision {
  id: string;
  requestId: string;
  analysisId: string | null;
  selectedModelId: string;
  provider: string;
  confidence: number | null;
  estimatedCost: number | null;
  estimatedLatencyMs: number | null;
  actualCost: number | null;
  actualLatencyMs: number | null;
  fallbackUsed: boolean;
  fallbackChain: string[] | null;
  routingReason: string | null;
  systemInstructionProfileId: string | null;
  createdAt: string;
}

export interface Response {
  id: string;
  requestId: string;
  routingId: string | null;
  content: string | null;
  contentType: string;
  tokensUsed: number | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  finishReason: string | null;
  generationTimeMs: number | null;
  rawResponse: Record<string, unknown> | null;
  createdAt: string;
}

export interface SystemInstructionProfile {
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
  applicableModalities: Modality[] | null;
  applicableSubjects: string[] | null;
  applicableComplexityLevels: ComplexityLevel[] | null;
  isDefault: boolean;
  isActive: boolean;
  priority: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
