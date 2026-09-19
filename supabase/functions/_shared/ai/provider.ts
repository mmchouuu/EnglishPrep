import {
  AIEvaluationRequestDTO,
  AIEvaluationResultDTO,
  AptisSkill,
  CEFRLevel,
  ProviderCapabilities
} from './types.ts';
import { MANDATORY_EVALUATION_LABEL, mapScoreToCEFR } from './rubrics.ts';
import { validateAIEvaluationResult } from './validation.ts';
import { buildSpeakingEvaluationPrompt, buildWritingEvaluationPrompt, SYSTEM_EVALUATION_PROMPT } from './prompts.ts';

export interface ITranscriptionProvider {
  capabilities: ProviderCapabilities;
  transcribeAudio(audioBlob: Blob, language?: string): Promise<string>;
}

export interface IWritingEvaluator {
  capabilities: ProviderCapabilities;
  evaluateWriting(request: AIEvaluationRequestDTO): Promise<AIEvaluationResultDTO>;
}

export interface ISpeakingEvaluator {
  capabilities: ProviderCapabilities;
  evaluateSpeaking(request: AIEvaluationRequestDTO): Promise<AIEvaluationResultDTO>;
}

/**
 * Mock Provider - Strictly allowed ONLY in development when ENABLE_AI_MOCK=true
 */
export class MockProvider implements IWritingEvaluator, ISpeakingEvaluator, ITranscriptionProvider {
  public capabilities: ProviderCapabilities = {
    supportsTranscription: true,
    supportsTranscriptEvaluation: true,
    supportsDirectAudioAnalysis: false,
    supportsPronunciation: false,
    supportsAudioFluency: false
  };

  public async transcribeAudio(_audioBlob: Blob, _language = 'en'): Promise<string> {
    return 'This is a mock transcribed text for speaking practice testing.';
  }

  public async evaluateWriting(request: AIEvaluationRequestDTO): Promise<AIEvaluationResultDTO> {
    const textLen = (request.userResponseText || '').trim().length;
    const score = Math.min(90, Math.max(40, textLen > 20 ? 75 : 45));
    const cefr = mapScoreToCEFR(score, 'writing', request.partNumber);

    return {
      evaluationId: request.evaluationId,
      responseId: request.responseId,
      attemptId: request.attemptId,
      questionId: request.questionId,
      skill: 'writing',
      partNumber: request.partNumber,
      status: 'completed',
      evaluatorType: 'ai',
      provider: 'mock-provider',
      modelName: 'mock-model-v1',
      modelVersion: '1.0.0',
      promptVersion: '1.0.0',
      rubricVersion: '1.0.0',
      rawScore: Math.round((score / 100) * 6),
      maxScore: 6,
      normalizedScore: score,
      cefrLevel: cefr,
      rubricResult: {
        overallLabel: MANDATORY_EVALUATION_LABEL,
        criteria: [
          { criterionName: 'Task Fulfilment', score: 4, maxScore: 6, bandLevel: cefr, feedback: 'Mock task feedback.' }
        ],
        spelling: { issueCount: 0, issues: [] }
      },
      strengths: ['Mock test strength: Good attempt.'],
      improvements: ['Mock test improvement: Add more vocabulary.'],
      feedback: 'Mock AI Evaluation completed successfully.',
      confidence: 0.9,
      version: request.version || 1,
      supersedesEvaluationId: request.supersedesEvaluationId || null
    };
  }

  public async evaluateSpeaking(request: AIEvaluationRequestDTO): Promise<AIEvaluationResultDTO> {
    return {
      evaluationId: request.evaluationId,
      responseId: request.responseId,
      attemptId: request.attemptId,
      questionId: request.questionId,
      skill: 'speaking',
      partNumber: request.partNumber,
      status: 'needs_review', // Mock cannot issue full CEFR due to missing acoustic pronunciation
      evaluatorType: 'ai',
      provider: 'mock-provider',
      modelName: 'mock-model-v1',
      modelVersion: '1.0.0',
      promptVersion: '1.0.0',
      rubricVersion: '1.0.0',
      rawScore: null,
      maxScore: null,
      normalizedScore: null,
      cefrLevel: null,
      rubricResult: {
        overallLabel: MANDATORY_EVALUATION_LABEL,
        criteria: [
          { criterionName: 'Task Fulfilment', score: 4, maxScore: 6, bandLevel: 'B1', feedback: 'Mock speaking transcript feedback.' }
        ],
        pronunciation: null,
        audioFluencyBand: null,
        speakingCoverage: {
          answeredPromptCount: 3,
          requiredPromptCount: 3,
          promptCoverage: [
            { promptIndex: 1, covered: true, evidence: 'Mock evidence prompt 1' },
            { promptIndex: 2, covered: true, evidence: 'Mock evidence prompt 2' },
            { promptIndex: 3, covered: true, evidence: 'Mock evidence prompt 3' }
          ]
        }
      },
      strengths: ['Mock speaking strength: Clear transcript.'],
      improvements: ['Mock speaking improvement: Practice pronunciation.'],
      feedback: 'Transcript evaluated. Acoustic pronunciation analysis pending human review.',
      confidence: 0.85,
      version: request.version || 1,
      supersedesEvaluationId: request.supersedesEvaluationId || null
    };
  }
}

/**
 * OpenAI Provider implementation using OpenAI API (Whisper + Chat Completions).
 */
export class OpenAIProvider implements IWritingEvaluator, ISpeakingEvaluator, ITranscriptionProvider {
  public capabilities: ProviderCapabilities = {
    supportsTranscription: true,
    supportsTranscriptEvaluation: true,
    supportsDirectAudioAnalysis: false,
    supportsPronunciation: false,
    supportsAudioFluency: false
  };

  private apiKey: string;
  private modelName: string;

  constructor(apiKey: string, modelName = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  public async transcribeAudio(audioBlob: Blob, language = 'en'): Promise<string> {
    if (!this.apiKey) throw new Error('OpenAI API key missing.');

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', language);

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Whisper transcription API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.text || '';
  }

  public async evaluateWriting(request: AIEvaluationRequestDTO): Promise<AIEvaluationResultDTO> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key missing.');
    }

    const prompt = buildWritingEvaluationPrompt(
      request.partNumber,
      request.userResponseText || ''
    );

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_EVALUATION_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API request failed (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    const contentStr = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(contentStr || '{}');

    const valResult = validateAIEvaluationResult(parsed);
    if (!valResult.isValid) {
      throw new Error(`AI output validation failed: ${valResult.errors.join('; ')}`);
    }

    const normalized = parsed.normalizedScore ?? 50;
    const cefr = mapScoreToCEFR(normalized, 'writing', request.partNumber);

    return {
      evaluationId: request.evaluationId,
      responseId: request.responseId,
      attemptId: request.attemptId,
      questionId: request.questionId,
      skill: 'writing',
      partNumber: request.partNumber,
      status: 'completed',
      evaluatorType: 'ai',
      provider: 'openai',
      modelName: this.modelName,
      modelVersion: '1.0.0',
      promptVersion: '1.0.0',
      rubricVersion: '1.0.0',
      rawScore: Math.round((normalized / 100) * 6),
      maxScore: 6,
      normalizedScore: normalized,
      cefrLevel: cefr,
      rubricResult: {
        overallLabel: MANDATORY_EVALUATION_LABEL,
        criteria: parsed.criteria || [],
        spelling: parsed.spelling || { issueCount: 0, issues: [] }
      },
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      feedback: parsed.feedback || null,
      confidence: parsed.confidence || 0.9,
      version: request.version || 1,
      supersedesEvaluationId: request.supersedesEvaluationId || null
    };
  }

  public async evaluateSpeaking(request: AIEvaluationRequestDTO): Promise<AIEvaluationResultDTO> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key missing.');
    }

    const transcriptText = request.userResponseText || '';
    const prompt = buildSpeakingEvaluationPrompt(request.partNumber, transcriptText);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_EVALUATION_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API request failed (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    const contentStr = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(contentStr || '{}');

    const valResult = validateAIEvaluationResult(parsed);
    if (!valResult.isValid) {
      throw new Error(`AI output validation failed: ${valResult.errors.join('; ')}`);
    }

    // Because direct audio analysis is false, set pronunciation/fluency to null & status to needs_review
    return {
      evaluationId: request.evaluationId,
      responseId: request.responseId,
      attemptId: request.attemptId,
      questionId: request.questionId,
      skill: 'speaking',
      partNumber: request.partNumber,
      status: 'needs_review',
      evaluatorType: 'ai',
      provider: 'openai',
      modelName: this.modelName,
      modelVersion: '1.0.0',
      promptVersion: '1.0.0',
      rubricVersion: '1.0.0',
      rawScore: null,
      maxScore: null,
      normalizedScore: null,
      cefrLevel: null, // Null CEFR level for transcript-only speaking evaluation
      rubricResult: {
        overallLabel: MANDATORY_EVALUATION_LABEL,
        criteria: parsed.criteria || [],
        pronunciation: null,
        audioFluencyBand: null,
        speakingCoverage: parsed.speakingCoverage || {
          answeredPromptCount: 3,
          requiredPromptCount: 3,
          promptCoverage: []
        }
      },
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      feedback: parsed.feedback || 'Transcript evaluated. Acoustic pronunciation analysis pending human review.',
      confidence: parsed.confidence || 0.85,
      version: request.version || 1,
      supersedesEvaluationId: request.supersedesEvaluationId || null
    };
  }
}

/**
 * Factory for creating AI Provider with Production protections.
 */
export function getAIProvider(env: Record<string, string>): {
  writingEvaluator: IWritingEvaluator;
  speakingEvaluator: ISpeakingEvaluator;
  transcriptionProvider: ITranscriptionProvider;
} {
  const isMockEnabled = env.ENABLE_AI_MOCK === 'true';
  const isDevEnv = env.DENO_ENV === 'development' || env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

  // Production check: Reject Mock strictly if not in dev
  if (isMockEnabled) {
    if (!isDevEnv) {
      throw new Error('[SECURITY_VIOLATION] Mock AI Provider is strictly forbidden in Production environment.');
    }
    const mock = new MockProvider();
    return {
      writingEvaluator: mock,
      speakingEvaluator: mock,
      transcriptionProvider: mock
    };
  }

  const apiKey = env.AI_API_KEY || env.OPENAI_API_KEY || '';
  const modelName = env.AI_MODEL || 'gpt-4o-mini';

  const provider = new OpenAIProvider(apiKey, modelName);
  return {
    writingEvaluator: provider,
    speakingEvaluator: provider,
    transcriptionProvider: provider
  };
}
