export type Modality =
  | 'image_text'
  | 'image_voice'
  | 'image_only'
  | 'voice_only'
  | 'text_only';

export interface ComplexityResult {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

export interface SubjectResult {
  primary: string;
  confidence: number;
}

export interface ReasoningResult {
  type: string;
  estimated_steps: number;
}

export interface InstructionProfile {
  id?: string;
  title: string;
  instructions?: string;
}

export interface AnalysisResult {
  complexity: ComplexityResult;
  subject: SubjectResult;
  reasoning: ReasoningResult;
  intent: {
    primary: string;
    reformulated_query: string;
  };
  output_requirements: {
    format: string;
    estimated_tokens: number;
  };
  instruction_profile?: InstructionProfile;
}

export interface RoutingDecision {
  selected_model: string;
  display_name: string;
  confidence: number;
  estimated_cost_usd: number;
  estimated_latency_ms?: number;
  fallback_chain: string[];
  reasoning?: string;
}

export interface OCRResult {
  text?: string;
  extracted_text?: string;
  confidence: number;
  engine: string;
  metrics?: {
    cer: number;
    wer: number;
    character_accuracy: number;
    word_accuracy: number;
  };
}

export interface STTResult {
  transcript?: string;
  confidence: number;
  engine: string;
  duration?: number;
  metrics?: {
    wer: number;
    mer: number;
    wil: number;
  };
}

export interface QueryProcessingInfo {
  ocr?: OCRResult;
  stt?: STTResult;
  analysis?: AnalysisResult;
  routing?: RoutingDecision;
}

export interface QueryResponse {
  request_id: string;
  status: 'processing' | 'completed' | 'error';
  modality: Modality;
  input: {
    text?: string;
  };
  processing?: QueryProcessingInfo;
  response?: {
    content: string;
    content_type: string;
    tokens_used: number;
    tokens_input: number;
    tokens_output: number;
    generated_at: string;
  };
  cost?: {
    total_usd: number;
    model_cost: number;
    processing_cost: number;
  };
}
