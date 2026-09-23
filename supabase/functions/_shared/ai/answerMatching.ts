import { AnswerMatchingGradingConfig, AnswerMatchingResultDTO, SpellingIssue } from './types.ts';

/**
 * Normalizes text input for string comparison.
 */
export function normalizeText(
  text: string | null | undefined,
  caseSensitive = false,
  punctuationSensitive = false
): string {
  if (!text) return '';
  let norm = String(text).normalize('NFC').trim();

  // Normalize apostrophes
  norm = norm.replace(/[’`‘]/g, "'");

  if (!punctuationSensitive) {
    // Strip surrounding punctuation except intra-word apostrophes/hyphens
    norm = norm.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ');
  }

  // Collapse multiple spaces
  norm = norm.replace(/\s+/g, ' ').trim();

  if (!caseSensitive) {
    norm = norm.toLowerCase();
  }

  return norm;
}

/**
 * Damerau-Levenshtein distance computation.
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const matrix: number[][] = [];
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Deletion
        matrix[i][j - 1] + 1,      // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost); // Transposition
      }
    }
  }

  return matrix[lenA][lenB];
}

/**
 * Detects tokens that MUST NOT undergo fuzzy matching.
 */
export function isFuzzyExcluded(text: string): boolean {
  const clean = text.trim();
  if (clean.length <= 2) return true; // Single or 2-char keys (A, B, C, D, 1, 2, A1, etc.)
  if (/^[A-Za-z0-9_-]{1,4}$/.test(clean)) return true; // Short option codes/keys
  if (/^\d+$/.test(clean)) return true; // Pure number
  if (/^\$?\d+([\.,]\d+)?\s*(dollars|USD|VND|EUR|GBP|£|€)?$/i.test(clean)) return true; // Money
  if (/^\d{1,2}:\d{2}(\s*(am|pm))?$/i.test(clean)) return true; // Time
  if (/^\d{1,4}[\/\.-]\d{1,2}[\/\.-]\d{1,4}$/.test(clean)) return true; // Date
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(clean)) return true; // Email
  if (/^[A-Z0-9]{3,10}$/.test(clean)) return true; // Code / Serial
  return false;
}

export function extractCorrectAnswer(raw: unknown): string | string[] | null {
  if (raw === null || raw === undefined) return null;
  let curr = raw;
  if (typeof curr === 'string') {
    const trimmed = curr.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        curr = JSON.parse(trimmed);
      } catch (_) {
        return trimmed;
      }
    } else {
      return trimmed;
    }
  }

  if (typeof curr === 'object' && curr !== null) {
    if (Array.isArray(curr)) {
      return curr.map(item => String(item).trim());
    }
    const c = curr as Record<string, unknown>;
    if (c.correct_option !== undefined) return extractCorrectAnswer(c.correct_option);
    if (c.correct_answer !== undefined) return extractCorrectAnswer(c.correct_answer);
    if (c.correct_person !== undefined) return extractCorrectAnswer(c.correct_person);
    if (c.correct_heading !== undefined) return extractCorrectAnswer(c.correct_heading);
    if (c.answer !== undefined) return extractCorrectAnswer(c.answer);
    if (c.option_key !== undefined) return extractCorrectAnswer(c.option_key);
    if (c.match !== undefined) return extractCorrectAnswer(c.match);
    if (Array.isArray(c.ordered_keys)) {
      return (c.ordered_keys as unknown[]).map(item => String(item).trim());
    }
  }

  return String(curr).trim();
}

/**
 * Evaluates short text answers with optional acceptable variants and spelling tolerance.
 */
export function matchShortAnswer(
  userResponse: string,
  correctAnswer: string,
  acceptableAnswers: string[] = [],
  config: AnswerMatchingGradingConfig = {}
): AnswerMatchingResultDTO {
  const caseSensitive = config.case_sensitive ?? false;
  const punctuationSensitive = config.punctuation_sensitive ?? false;

  const normUser = normalizeText(userResponse, caseSensitive, punctuationSensitive);
  const normCorrect = normalizeText(correctAnswer, caseSensitive, punctuationSensitive);

  // 1. Exact match
  if (normUser === normCorrect) {
    return {
      isCorrect: true,
      matchType: 'exact',
      score: 1.0,
      spellingIssues: []
    };
  }

  // 2. Acceptable variant match
  for (const alt of acceptableAnswers) {
    const normAlt = normalizeText(alt, caseSensitive, punctuationSensitive);
    if (normUser === normAlt) {
      return {
        isCorrect: true,
        matchType: 'acceptable_variant',
        score: 1.0,
        spellingIssues: []
      };
    }
  }

  // 3. Spelling tolerance check
  const toleranceConfig = config.spelling_tolerance ?? {
    enabled: true,
    max_edit_distance: 1,
    max_token_length_for_tolerance: 12
  };

  const toleranceEnabled = toleranceConfig.enabled ?? true;
  const maxEditDist = toleranceConfig.max_edit_distance ?? 1;
  const maxTokenLen = toleranceConfig.max_token_length_for_tolerance ?? 12;

  if (
    toleranceEnabled &&
    normUser.length > 0 &&
    normUser.length <= maxTokenLen &&
    !isFuzzyExcluded(userResponse) &&
    !isFuzzyExcluded(correctAnswer)
  ) {
    const dist = damerauLevenshteinDistance(normUser, normCorrect);
    if (dist <= maxEditDist && dist > 0) {
      const issue: SpellingIssue = {
        original: userResponse.trim(),
        suggestion: correctAnswer.trim(),
        reason: `Single edit distance typo (${dist})`
      };
      return {
        isCorrect: true,
        matchType: 'spelling_tolerance',
        score: 1.0,
        spellingIssues: [issue]
      };
    }
  }

  // 4. Incorrect
  return {
    isCorrect: false,
    matchType: 'incorrect',
    score: 0.0,
    spellingIssues: []
  };
}

export interface ObjectiveGradingResultDTO {
  isCorrect: boolean;
  rawScore: number;
  maxScore: number;
  normalizedScore: number;
  feedback: string;
  extractedCorrectAnswer: string | string[];
}

export function evaluateObjectiveAnswer(
  questionType: string,
  userResponse: unknown,
  rawCorrectAnswer: unknown,
  acceptableAnswers: string[] = [],
  config: AnswerMatchingGradingConfig = {}
): ObjectiveGradingResultDTO {
  const target = extractCorrectAnswer(rawCorrectAnswer);
  if (target === null) {
    throw new Error('UNSUPPORTED_ANSWER_SHAPE');
  }

  if (questionType === 'sentence_ordering') {
    const targetArr = Array.isArray(target) ? target : String(target).split(',').map(s => s.trim()).filter(Boolean);

    let userArr: string[] = [];
    if (Array.isArray(userResponse)) {
      userArr = userResponse.map(s => String(s).trim());
    } else if (typeof userResponse === 'string') {
      const trimmed = userResponse.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) userArr = parsed.map(s => String(s).trim());
        } catch (_) {
          userArr = [trimmed];
        }
      } else {
        userArr = [trimmed];
      }
    }

    if (targetArr.length === 0) {
      throw new Error('UNSUPPORTED_ANSWER_SHAPE');
    }

    let correctPositionCount = 0;
    const maxScore = targetArr.length;
    for (let i = 0; i < maxScore; i++) {
      if (i < userArr.length && userArr[i] === targetArr[i]) {
        correctPositionCount++;
      }
    }

    const rawScore = correctPositionCount;
    const normalizedScore = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
    const isCorrect = rawScore === maxScore && maxScore > 0;
    const feedback = isCorrect ? 'exact' : (rawScore > 0 ? 'partial' : 'incorrect');

    return {
      isCorrect,
      rawScore,
      maxScore,
      normalizedScore,
      feedback,
      extractedCorrectAnswer: targetArr
    };
  }

  // String question types (multiple_choice, opinion_matching, heading_matching, listening_multiple_choice, listening_matching)
  let userStr = '';
  if (typeof userResponse === 'string') {
    userStr = userResponse.trim();
  } else if (typeof userResponse === 'object' && userResponse !== null) {
    const uObj = userResponse as Record<string, unknown>;
    userStr = String(uObj.text || uObj.value || uObj.option || uObj.answer || '').trim();
  } else {
    userStr = String(userResponse || '').trim();
  }

  const targetStr = Array.isArray(target) ? target.join(',') : target;

  const isKeyBasedType = [
    'multiple_choice',
    'opinion_matching',
    'heading_matching',
    'listening_multiple_choice',
    'listening_matching'
  ].includes(questionType);

  const matchRes = matchShortAnswer(
    userStr,
    targetStr,
    acceptableAnswers,
    isKeyBasedType ? { ...config, spelling_tolerance: { enabled: false } } : config
  );
  const isCorrect = matchRes.isCorrect && matchRes.score === 1.0;

  return {
    isCorrect,
    rawScore: isCorrect ? 1.0 : 0.0,
    maxScore: 1.0,
    normalizedScore: isCorrect ? 100.0 : 0.0,
    feedback: matchRes.matchType,
    extractedCorrectAnswer: targetStr
  };
}

