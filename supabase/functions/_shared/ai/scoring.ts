import { AptisSkill, CEFRLevel, EvaluationStatus, ProviderCapabilities } from './types.ts';
import { mapScoreToCEFR } from './rubrics.ts';

export interface RawScoreInput {
  skill: AptisSkill;
  partNumber: number;
  criteriaScores: { score: number; maxScore: number }[];
  providerCapabilities?: ProviderCapabilities;
  hasAudio?: boolean;
}

export interface CalculatedScoreResult {
  rawScore: number;
  maxScore: number;
  normalizedScore: number; // 0-100
  cefrLevel: CEFRLevel | null;
  status: EvaluationStatus;
}

export function calculateNormalizedScore(input: RawScoreInput): CalculatedScoreResult {
  const { skill, partNumber, criteriaScores, providerCapabilities, hasAudio } = input;

  let totalRaw = 0;
  let totalMax = 0;

  for (const c of criteriaScores) {
    totalRaw += c.score;
    totalMax += c.maxScore;
  }

  const normalized = totalMax > 0 ? Math.min(100, Math.max(0, Math.round((totalRaw / totalMax) * 100))) : 0;
  let cefr: CEFRLevel | null = mapScoreToCEFR(normalized, skill, partNumber);
  let status: EvaluationStatus = 'completed';

  // Audio capability & presence guard for Speaking
  if (skill === 'speaking') {
    const isDirectAudio = providerCapabilities?.supportsDirectAudioAnalysis ?? false;
    const isPronunciationSupported = providerCapabilities?.supportsPronunciation ?? false;

    // If audio is missing OR provider only does transcript evaluation without acoustic analysis
    if (!hasAudio || (!isDirectAudio && !isPronunciationSupported)) {
      cefr = null; // Cannot issue full CEFR without acoustic pronunciation/fluency analysis
      status = 'needs_review';
    }
  }

  return {
    rawScore: totalRaw,
    maxScore: totalMax,
    normalizedScore: normalized,
    cefrLevel: cefr,
    status
  };
}
