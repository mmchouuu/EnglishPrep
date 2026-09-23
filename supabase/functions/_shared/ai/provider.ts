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
export function detectSpellingErrors(text: string): Array<{ original: string; suggestion: string }> {
  if (!text || typeof text !== 'string') return [];
  const words = text.trim().split(/\s+/);
  const issues: Array<{ original: string; suggestion: string }> = [];

  const commonTypoMap: Record<string, string> = {
    'drawwing': 'drawing',
    'playying': 'playing',
    'goinng': 'going',
    'singging': 'singing',
    'walkking': 'walking',
    'lookking': 'looking',
    'paintting': 'painting',
    'beatifull': 'beautiful',
    'beutiful': 'beautiful',
    'diffrent': 'different',
    'intersting': 'interesting',
    'recieve': 'receive',
    'tomorow': 'tomorrow',
    'favorit': 'favorite',
    'phgraphy': 'photography',
    'likking': 'liking',
    'writting': 'writing',
    'swiming': 'swimming',
    'runing': 'running'
  };

  words.forEach(rawW => {
    const cleanW = rawW.replace(/[^\w']/g, '').toLowerCase();
    if (!cleanW) return;

    if (commonTypoMap[cleanW]) {
      issues.push({ original: rawW.replace(/[^\w']/g, ''), suggestion: commonTypoMap[cleanW] });
      return;
    }

    if (/(\w)wwing$/i.test(cleanW)) {
      issues.push({ original: rawW.replace(/[^\w']/g, ''), suggestion: cleanW.replace(/wwing$/i, 'wing') });
    } else if (/(\w)gging$/i.test(cleanW) && !['tagging', 'bagging', 'nagging', 'sagging'].includes(cleanW)) {
      issues.push({ original: rawW.replace(/[^\w']/g, ''), suggestion: cleanW.replace(/gging$/i, 'ging') });
    } else if (/(\w)kking$/i.test(cleanW)) {
      issues.push({ original: rawW.replace(/[^\w']/g, ''), suggestion: cleanW.replace(/kking$/i, 'king') });
    } else if (/(\w)tting$/i.test(cleanW) && ['paintting', 'starring'].includes(cleanW)) {
      issues.push({ original: rawW.replace(/[^\w']/g, ''), suggestion: cleanW.replace(/tting$/i, 'ting') });
    }
  });

  return issues;
}

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
    const userText = (request.userResponseText || '').trim();
    const wordCount = userText ? userText.split(/\s+/).filter(Boolean).length : 0;
    const spellingIssues = detectSpellingErrors(userText);
    const partNum = request.partNumber || 1;

    let calculatedScore = 70;
    let feedbackText = '';

    if (!userText) {
      calculatedScore = 0;
      feedbackText = 'Bạn chưa nhập câu trả lời. Hãy điền câu trả lời hoàn chỉnh để AI đánh giá nhé!';
    } else if (partNum === 1) {
      if (spellingIssues.length > 0) {
        calculatedScore = 45;
        const errDetails = spellingIssues.map(i => `'${i.original}' ➔ '${i.suggestion}'`).join(', ');
        feedbackText = `Bài làm đáp ứng dung lượng Part 1 (${wordCount}/5 từ). Tuy nhiên, câu trả lời còn mắc lỗi chính tả (${errDetails}). Hãy sửa lỗi và viết thành câu đầy đủ để đạt band B1-B2.`;
      } else if (wordCount > 5) {
        calculatedScore = 55;
        feedbackText = `Bài làm (${wordCount} từ) dài hơn quy định của Part 1 (1–5 từ). Nên viết ngắn gọn đúng trọng tâm câu hỏi.`;
      } else {
        calculatedScore = 80;
        feedbackText = `Bài làm Part 1 tốt (${wordCount} từ): Trả lời đúng trọng tâm câu hỏi, từ vựng chính xác và không mắc lỗi chính tả.`;
      }
    } else if (partNum === 2) {
      if (wordCount < 20) {
        calculatedScore = 50;
        feedbackText = `Bài làm Part 2 hơi ngắn (${wordCount}/20 từ tối thiểu). Bạn nên viết mở rộng thêm lý do hoặc ví dụ để đạt band B2.`;
      } else {
        calculatedScore = 82;
        feedbackText = `Bài làm Part 2 đạt chuẩn B2 (${wordCount} từ): Trình bày ý mạch lạc, cấu trúc câu tự nhiên và diễn đạt tốt.`;
      }
    } else if (partNum === 3) {
      if (wordCount < 30) {
        calculatedScore = 55;
        feedbackText = `Bài trả lời Part 3 (${wordCount}/30 từ) chưa đạt dung lượng yêu cầu. Hãy bổ sung thêm chi tiết phản hồi các thành viên trong club.`;
      } else {
        calculatedScore = 85;
        feedbackText = `Bài làm Part 3 tốt (${wordCount} từ): Sử dụng câu tương tác tự nhiên, vốn từ phong phú và liên kết vế câu chặt chẽ.`;
      }
    } else {
      if (wordCount < 40) {
        calculatedScore = 60;
        feedbackText = `Email Part 4 (${wordCount} từ) cần phát triển thêm ý. Hãy chú ý cấu trúc chào hỏi, thân bài và kết bài chuẩn mực.`;
      } else {
        calculatedScore = 90;
        feedbackText = `Bài viết Part 4 xuất sắc (${wordCount} từ): Sử dụng văn phong chuẩn mực (informal/formal), từ nối mượt mà và vốn từ vựng nâng cao đạt chuẩn C1.`;
      }
    }

    const cefr = mapScoreToCEFR(calculatedScore, 'writing', partNum);

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
      rawScore: Math.round((calculatedScore / 100) * 6),
      maxScore: 6,
      normalizedScore: calculatedScore,
      cefrLevel: cefr,
      rubricResult: {
        overallLabel: MANDATORY_EVALUATION_LABEL,
        criteria: [
          { criterionName: 'Task Fulfilment', score: Math.round((calculatedScore / 100) * 6), maxScore: 6, bandLevel: cefr, feedback: feedbackText }
        ],
        spelling: {
          issueCount: spellingIssues.length,
          issues: spellingIssues
        }
      },
      strengths: spellingIssues.length === 0 ? ['Đáp ứng dung lượng yêu cầu', 'Từ vựng đúng ngữ cảnh'] : ['Bài làm cố gắng thể hiện ý tưởng'],
      improvements: spellingIssues.length > 0 ? spellingIssues.map(i => `Lỗi chính tả: ${i.original} -> ${i.suggestion}`) : ['Mở rộng vốn từ nâng cao'],
      feedback: feedbackText,
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
  private baseUrl: string;

  constructor(apiKey: string, modelName = 'gpt-4o-mini', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.modelName = (modelName || 'gpt-4o-mini').replace(/^models\//, '');
    this.baseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  }

  public async transcribeAudio(audioBlob: Blob, language = 'en'): Promise<string> {
    if (!this.apiKey) throw new Error('OpenAI API key missing.');

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', language);

    const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
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

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName.replace(/^models\//, ''),
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

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName.replace(/^models\//, ''),
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
  const baseUrl = env.AI_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  const provider = new OpenAIProvider(apiKey, modelName, baseUrl);
  return {
    writingEvaluator: provider,
    speakingEvaluator: provider,
    transcriptionProvider: provider
  };
}
