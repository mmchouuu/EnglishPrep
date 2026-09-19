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
  // Numbers, dates, times, currency, codes, email, proper names
  if (/^\d+$/.test(clean)) return true; // Pure number
  if (/^\$?\d+([\.,]\d+)?\s*(dollars|USD|VND|EUR|GBP|£|€)?$/i.test(clean)) return true; // Money
  if (/^\d{1,2}:\d{2}(\s*(am|pm))?$/i.test(clean)) return true; // Time
  if (/^\d{1,4}[\/\.-]\d{1,2}[\/\.-]\d{1,4}$/.test(clean)) return true; // Date
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(clean)) return true; // Email
  if (/^[A-Z0-9]{3,10}$/.test(clean)) return true; // Code / Serial
  return false;
}

/**
 * Match a short user answer against correct and acceptable answers.
 */
export function matchShortAnswer(
  userAnswer: unknown,
  correctAnswer: unknown,
  acceptableAnswers: string[] = [],
  config: AnswerMatchingGradingConfig = {}
): AnswerMatchingResultDTO {
  const caseSensitive = config.case_sensitive ?? false;
  const punctuationSensitive = config.punctuation_sensitive ?? false;
  const toleranceConfig = config.spelling_tolerance ?? {
    enabled: true,
    max_edit_distance: 1,
    max_token_length_for_tolerance: 12
  };

  const unwrapValue = (val: unknown): string | string[] | null => {
    if (val === null || val === undefined) return null;
    let curr = val;
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
      const c = curr as Record<string, unknown>;
      if (c.correct_option !== undefined) return unwrapValue(c.correct_option);
      if (c.correct_answer !== undefined) return unwrapValue(c.correct_answer);
      if (c.correct_person !== undefined) return unwrapValue(c.correct_person);
      if (c.correct_heading !== undefined) return unwrapValue(c.correct_heading);
      if (c.answer !== undefined) return unwrapValue(c.answer);
      if (c.option_key !== undefined) return unwrapValue(c.option_key);
      if (c.match !== undefined) return unwrapValue(c.match);
      if (Array.isArray(c.ordered_keys)) return (c.ordered_keys as unknown[]).map(k => String(k));
      if (Array.isArray(curr)) return (curr as unknown[]).map(k => String(k));
    }
    return String(curr);
  };

  const unwrappedUser = unwrapValue(userAnswer);
  const unwrappedCorrect = unwrapValue(correctAnswer);

  if (Array.isArray(unwrappedUser) || Array.isArray(unwrappedCorrect)) {
    const userArr = Array.isArray(unwrappedUser) ? unwrappedUser : String(unwrappedUser || '').split(',').map(s => s.trim()).filter(Boolean);
    const targetArr = Array.isArray(unwrappedCorrect) ? unwrappedCorrect : String(unwrappedCorrect || '').split(',').map(s => s.trim()).filter(Boolean);
    const isMatch = userArr.length > 0 && userArr.length === targetArr.length && userArr.every((v, i) => v === targetArr[i]);
    return {
      isCorrect: isMatch,
      matchType: isMatch ? 'exact' : 'incorrect',
      score: isMatch ? 1.0 : 0.0,
      spellingIssues: []
    };
  }

  const strUser = typeof unwrappedUser === 'string' ? unwrappedUser : null;
  const strCorrect = typeof unwrappedCorrect === 'string' ? unwrappedCorrect : null;

  const normUser = normalizeText(strUser, caseSensitive, punctuationSensitive);
  const normCorrect = normalizeText(strCorrect, caseSensitive, punctuationSensitive);
  const normAcceptable = (acceptableAnswers || []).map(a => normalizeText(a, caseSensitive, punctuationSensitive));

  const spellingIssues: SpellingIssue[] = [];

  if (!normUser) {
    return {
      isCorrect: false,
      matchType: 'incorrect',
      score: 0,
      spellingIssues: []
    };
  }

  // 1. Exact normalized match with correct_answer
  if (normCorrect && normUser === normCorrect) {
    return {
      isCorrect: true,
      matchType: 'exact',
      score: 1.0,
      spellingIssues: []
    };
  }

  // 2. Exact match with acceptable_answers
  if (normAcceptable.includes(normUser)) {
    return {
      isCorrect: true,
      matchType: 'acceptable_variant',
      score: 1.0,
      spellingIssues: []
    };
  }

  // Check if answer is numeric or excluded from fuzzy matching
  const excluded = isFuzzyExcluded(normUser) || isFuzzyExcluded(normCorrect);

  // 3. Spelling tolerance check (if enabled and not excluded)
  if (normCorrect && !excluded && toleranceConfig.enabled) {
    const dist = damerauLevenshteinDistance(normUser, normCorrect);
    if (dist <= toleranceConfig.max_edit_distance && normUser.length <= toleranceConfig.max_token_length_for_tolerance) {
      spellingIssues.push({
        original: String(userAnswer).trim(),
        suggestion: String(correctAnswer).trim(),
        reason: `Minor typo detected (edit distance: ${dist}).`
      });

      return {
        isCorrect: true,
        matchType: 'spelling_tolerance',
        score: 1.0,
        spellingIssues
      };
    }
  }

  // 4. Incorrect - record diagnostic spelling issue if typo exists
  if (normCorrect && !excluded) {
    const dist = damerauLevenshteinDistance(normUser, normCorrect);
    if (dist <= 3) {
      spellingIssues.push({
        original: String(userAnswer).trim(),
        suggestion: String(correctAnswer).trim(),
        reason: `Spelling error (edit distance: ${dist}).`
      });
    }
  }

  return {
    isCorrect: false,
    matchType: 'incorrect',
    score: 0.0,
    spellingIssues
  };
}
