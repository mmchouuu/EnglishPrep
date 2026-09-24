/**
 * Supabase Edge Functions Shared AI Types & DTOs
 * Target: Immutable contract baseline before ASP.NET Core C# Backend Refactor
 */

export type AptisSkill = 'reading' | 'listening' | 'writing' | 'speaking';

export type CEFRLevel = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1'; // C2 strictly excluded per requirements

export type EvaluationStatus = 'pending' | 'processing' | 'needs_review' | 'completed' | 'failed';

export type EvaluatorType = 'ai' | 'human';

export interface ProviderCapabilities {
  supportsTranscription: boolean;
  supportsTranscriptEvaluation: boolean;
  supportsDirectAudioAnalysis: boolean;
  supportsPronunciation: boolean;
  supportsAudioFluency: boolean;
}

export interface SpellingIssue {
  original: string;
  suggestion: string;
  reason?: string;
  position?: number;
}

export interface StructuredSpellingFeedback {
  issueCount: number;
  issues: SpellingIssue[];
}

export interface PromptCoverageItem {
  promptIndex: number;
  covered: boolean;
  evidence: string;
}

export interface SpeakingPart4Coverage {
  answeredPromptCount: number;
  requiredPromptCount: number;
  promptCoverage: PromptCoverageItem[];
}

export interface RubricCriterionResult {
  criterionName: string;
  score: number;
  maxScore: number;
  bandLevel: CEFRLevel | string;
  feedback: string;
}

export interface RubricResultDTO {
  overallLabel: 'AI practice estimate';
  criteria: RubricCriterionResult[];
  spelling?: StructuredSpellingFeedback;
  speakingCoverage?: SpeakingPart4Coverage;
  pronunciation?: number | null;
  audioFluencyBand?: string | null;
}

export interface AIEvaluationRequestDTO {
  evaluationId: string;
  attemptId: string;
  responseId: string;
  questionId: string;
  skill: AptisSkill;
  partNumber: number;
  userResponseText?: string;
  recordingPath?: string;
  audioDurationSeconds?: number;
  version: number;
  supersedesEvaluationId?: string | null;
}

export interface AIEvaluationResultDTO {
  evaluationId: string;
  responseId: string;
  attemptId: string;
  questionId: string;
  skill: AptisSkill;
  partNumber: number;
  status: EvaluationStatus;
  evaluatorType: EvaluatorType;
  provider: string;
  modelName: string;
  modelVersion: string;
  promptVersion: string;
  rubricVersion: string;
  rawScore: number | null;
  maxScore: number | null;
  normalizedScore: number | null;
  cefrLevel: CEFRLevel | null;
  rubricResult: RubricResultDTO;
  strengths: string[];
  improvements: string[];
  feedback: string | null;
  confidence: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  usageMetadata?: Record<string, unknown>;
  version: number;
  supersedesEvaluationId?: string | null;
}

export interface AnswerMatchingGradingConfig {
  case_sensitive?: boolean;
  punctuation_sensitive?: boolean;
  spelling_tolerance?: {
    enabled: boolean;
    max_edit_distance: number;
    max_token_length_for_tolerance: number;
  };
}

export interface AnswerMatchingResultDTO {
  isCorrect: boolean;
  matchType: 'exact' | 'acceptable_variant' | 'spelling_tolerance' | 'incorrect';
  score: number;
  spellingIssues: SpellingIssue[];
}
