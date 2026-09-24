import { AptisSkill } from './types.ts';

export const SYSTEM_EVALUATION_PROMPT = `You are an expert British Council Aptis English Examiner.
Evaluate candidate responses strictly using official Aptis assessment criteria.
IMPORTANT RULES:
1. Be realistic and rigorous in your scoring. Do NOT give 100/100 or maximum bands unless the response demonstrates flawless grammar, accurate word choice, appropriate register, and full task fulfilment.
2. Strictly enforce word count requirements:
   - Part 1: 1–5 words per question (cap at 10 words).
   - Part 2: 20–30 words. Deduct points if under 20 or over 35 words.
   - Part 3: 30–40 words per prompt.
   - Part 4: Task A (40–50 words), Task B (120–150 words).
3. CEFR level caps per Aptis part: Part 1 ceiling is B1; Part 2 ceiling is B2; Part 3 ceiling is B2; Part 4 ceiling is C1. CEFR level C2 is NEVER permitted.
4. Do NOT penalize candidate responses simply because they differ in phrasing from sample or model answers. Sample answers are for reference only.
5. You MUST return your evaluation in strict JSON format.
6. Always label the evaluation overall as "AI practice estimate".
`;

export function buildWritingEvaluationPrompt(
  partNumber: number,
  userResponseText: string,
  questionPrompt?: string,
  wordLimit?: number
): string {
  return `EVALUATION TASK: Aptis Writing Part ${partNumber}

Question / Task Prompt:
${questionPrompt || 'Complete the writing task as instructed.'}
Word Limit: ${wordLimit || 'Standard Aptis word count'}

Candidate Response:
"${userResponseText}"

Instructions:
Evaluate the candidate response across relevant criteria (Task Fulfilment, Grammar, Vocabulary, Coherence/Organisation, Spelling & Punctuation).
Identify spelling errors without altering the user's response.
Provide feedback, strengths, improvements, normalized score (0-100), and CEFR level (A0-C1).

Return JSON matching this exact structure:
{
  "overallLabel": "AI practice estimate",
  "normalizedScore": 75,
  "cefrLevel": "B2",
  "confidence": 0.95,
  "feedback": "Clear and coherent response...",
  "strengths": ["Good vocabulary", "Well structured"],
  "improvements": ["Fix minor punctuation", "Expand connector usage"],
  "criteria": [
    { "criterionName": "Task Fulfilment", "score": 5, "maxScore": 6, "bandLevel": "B2", "feedback": "Addressed all points." },
    { "criterionName": "Grammar", "score": 5, "maxScore": 6, "bandLevel": "B2", "feedback": "Good variety of structures." }
  ],
  "spelling": {
    "issueCount": 1,
    "issues": [
      { "original": "becouse", "suggestion": "because", "reason": "Spelling typo" }
    ]
  }
}`;
}

export function buildSpeakingEvaluationPrompt(
  partNumber: number,
  transcriptText: string,
  questionPrompt?: string,
  answeredPromptCount = 3
): string {
  return `EVALUATION TASK: Aptis Speaking Part ${partNumber} (Transcript-Based Evaluation)

Question / Task Prompt:
${questionPrompt || 'Answer the speaking prompts.'}

Candidate Audio Transcript:
"${transcriptText}"

Candidate Answered Prompt Count: ${answeredPromptCount}/3

Instructions:
Evaluate the candidate transcript across Task Fulfilment, Grammar, Vocabulary, and Cohesion.
NOTE: Because this is a text transcript evaluation:
- Set pronunciation score to null.
- Set audioFluencyBand to null.
- If prompt coverage is incomplete (< 3 prompts for Part 4), cap CEFR level at B2 and flag missing prompts.

Return JSON matching this exact structure:
{
  "overallLabel": "AI practice estimate",
  "normalizedScore": 70,
  "cefrLevel": "B2",
  "confidence": 0.9,
  "feedback": "Good response covering the prompts.",
  "strengths": ["Clear ideas", "Relevant vocabulary"],
  "improvements": ["Use more complex sentences"],
  "criteria": [
    { "criterionName": "Task Fulfilment", "score": 4, "maxScore": 6, "bandLevel": "B2", "feedback": "Answered 3 prompts." }
  ],
  "speakingCoverage": {
    "answeredPromptCount": ${answeredPromptCount},
    "requiredPromptCount": 3,
    "promptCoverage": [
      { "promptIndex": 1, "covered": true, "evidence": "Mentions topic 1" }
    ]
  },
  "pronunciation": null,
  "audioFluencyBand": null
}`;
}
