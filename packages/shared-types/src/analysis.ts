/** SLM analysis output shapes (produced by analysis-engine, consumed by router). */
import type { ComplexityLevel, EstimatedLength, OutputFormat, ReasoningType } from './models.js';

export interface ComplexityAnalysis {
  level: ComplexityLevel;
  score: number; // 0..1
  reasoning: string;
  estimatedSteps: number;
  requiresChainOfThought: boolean;
}

export interface SubjectClassification {
  primary: string;
  confidence: number;
  subcategories: string[];
  domainTags: string[];
}

export interface ReasoningAssessment {
  type: ReasoningType;
  estimatedSteps: number;
  requiresChainOfThought: boolean;
  keySkills: string[];
}

export interface Entity {
  type: string;
  value: string;
}

export interface IntentExtraction {
  primaryIntent: string;
  secondaryIntents: string[];
  entities: Entity[];
  queryReformulation: string;
}

export interface OutputRequirements {
  format: OutputFormat;
  lengthEstimate: EstimatedLength;
  specialRequirements: string[];
}

/** Full analysis bundle passed to the router. */
export interface AnalysisBundle {
  complexity: ComplexityAnalysis;
  subject: SubjectClassification;
  reasoning: ReasoningAssessment;
  intent: IntentExtraction;
  outputRequirements: OutputRequirements;
  systemInstructionProfileId: string | null;
  analysisTimeMs: number;
}
