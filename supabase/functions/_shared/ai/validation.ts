import { AIEvaluationResultDTO, CEFRLevel } from './types.ts';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedResult?: AIEvaluationResultDTO;
}

export function validateAIEvaluationResult(rawJson: unknown): ValidationResult {
  const errors: string[] = [];
  if (!rawJson || typeof rawJson !== 'object') {
    return { isValid: false, errors: ['Evaluation output must be a non-null JSON object'] };
  }

  const obj = rawJson as Record<string, unknown>;

  if (typeof obj.normalizedScore === 'number') {
    if (obj.normalizedScore < 0 || obj.normalizedScore > 100) {
      errors.push(`normalizedScore (${obj.normalizedScore}) out of range [0, 100]`);
    }
  }

  if (obj.cefrLevel !== null && obj.cefrLevel !== undefined) {
    const cefrStr = String(obj.cefrLevel).toUpperCase();
    if (cefrStr === 'C2') {
      errors.push('[SECURITY_VIOLATION] C2 level is strictly prohibited for Aptis tests.');
    } else if (!['A0', 'A1', 'A2', 'B1', 'B2', 'C1'].includes(cefrStr)) {
      errors.push(`Invalid CEFR level '${obj.cefrLevel}'`);
    }
  }

  if (obj.overallLabel && obj.overallLabel !== 'AI practice estimate') {
    errors.push(`Mandatory evaluation label must be 'AI practice estimate'`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedResult: rawJson as AIEvaluationResultDTO
  };
}
