import { AptisSkill, CEFRLevel } from './types.ts';

export const MANDATORY_EVALUATION_LABEL = 'AI practice estimate' as const;

export interface RubricBandDefinition {
  level: CEFRLevel;
  minScore: number;
  maxScore: number;
  description: string;
}

export interface SkillPartRubric {
  skill: AptisSkill;
  partNumber: number;
  maxPartScore: number;
  cefrCeiling: CEFRLevel;
  criteriaNames: string[];
}

export const APTIS_CEFR_CEILINGS: Record<AptisSkill, Record<number, CEFRLevel>> = {
  writing: {
    1: 'B1',
    2: 'B2',
    3: 'B2',
    4: 'C1'
  },
  speaking: {
    1: 'B1',
    2: 'B2',
    3: 'B2',
    4: 'C1'
  },
  reading: { 1: 'C1', 2: 'C1', 3: 'C1', 4: 'C1' },
  listening: { 1: 'C1', 2: 'C1', 3: 'C1', 4: 'C1' }
};

export const WRITING_RUBRICS: Record<number, SkillPartRubric> = {
  1: {
    skill: 'writing',
    partNumber: 1,
    maxPartScore: 5,
    cefrCeiling: 'B1',
    criteriaNames: ['Task Relevance', 'Grammatical Accuracy', 'Spelling']
  },
  2: {
    skill: 'writing',
    partNumber: 2,
    maxPartScore: 6,
    cefrCeiling: 'B2',
    criteriaNames: ['Task Fulfilment', 'Grammar', 'Vocabulary', 'Coherence', 'Spelling & Punctuation']
  },
  3: {
    skill: 'writing',
    partNumber: 3,
    maxPartScore: 6,
    cefrCeiling: 'B2',
    criteriaNames: ['Task Fulfilment', 'Interlocutor Interaction', 'Tone & Register', 'Coherence', 'Grammar & Vocabulary']
  },
  4: {
    skill: 'writing',
    partNumber: 4,
    maxPartScore: 6,
    cefrCeiling: 'C1',
    criteriaNames: ['Task Achievement', 'Register & Tone (Informal vs Formal)', 'Organization & Cohesion', 'Grammar', 'Vocabulary', 'Spelling & Punctuation']
  }
};

export const SPEAKING_RUBRICS: Record<number, SkillPartRubric> = {
  1: {
    skill: 'speaking',
    partNumber: 1,
    maxPartScore: 5,
    cefrCeiling: 'B1',
    criteriaNames: ['Task Fulfilment', 'Grammar', 'Vocabulary', 'Pronunciation', 'Fluency']
  },
  2: {
    skill: 'speaking',
    partNumber: 2,
    maxPartScore: 6,
    cefrCeiling: 'B2',
    criteriaNames: ['Task Fulfilment', 'Grammar', 'Vocabulary', 'Pronunciation', 'Fluency & Cohesion']
  },
  3: {
    skill: 'speaking',
    partNumber: 3,
    maxPartScore: 6,
    cefrCeiling: 'B2',
    criteriaNames: ['Task Fulfilment', 'Grammar', 'Vocabulary', 'Pronunciation', 'Fluency & Cohesion']
  },
  4: {
    skill: 'speaking',
    partNumber: 4,
    maxPartScore: 6,
    cefrCeiling: 'C1',
    criteriaNames: ['Task Fulfilment (3 Prompts Coverage)', 'Grammar', 'Vocabulary', 'Pronunciation', 'Fluency & Cohesion']
  }
};

/**
 * Maps a normalized 0-100 score to a CEFR level respecting part ceilings.
 */
export function mapScoreToCEFR(normalizedScore: number, skill: AptisSkill, partNumber: number): CEFRLevel {
  const ceiling = APTIS_CEFR_CEILINGS[skill]?.[partNumber] || 'C1';
  let level: CEFRLevel = 'A1';

  if (normalizedScore >= 85) {
    level = 'C1';
  } else if (normalizedScore >= 70) {
    level = 'B2';
  } else if (normalizedScore >= 50) {
    level = 'B1';
  } else if (normalizedScore >= 30) {
    level = 'A2';
  } else if (normalizedScore >= 15) {
    level = 'A1';
  } else {
    level = 'A0';
  }

  // Cap at part ceiling (C2 is strictly excluded)
  const cefrRanks: Record<CEFRLevel, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
  if (cefrRanks[level] > cefrRanks[ceiling]) {
    return ceiling;
  }

  return level;
}
