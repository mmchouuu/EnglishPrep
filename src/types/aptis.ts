/**
 * TypeScript Data Models & UI Payloads for APTIS System (Phase 5)
 * Scope: 4 Skills (Reading, Listening, Speaking, Writing)
 */

export type AptisSkill = 'reading' | 'listening' | 'speaking' | 'writing';

export type AptisGroupType = 'club' | 'topic' | 'practice_set';

export type AptisBlockType = 'passage' | 'audio' | 'image' | 'instructions' | 'conversation';

export type AptisQuestionType =
  | 'multiple_choice'
  | 'dropdown'
  | 'sentence_ordering'
  | 'heading_matching'
  | 'opinion_matching'
  | 'text_input'
  | 'email_writing'
  | 'photo_description'
  | 'photo_comparison'
  | 'speaking_recording'
  | 'listening_multiple_choice'
  | 'listening_matching';

export type AttemptStatus = 'in_progress' | 'submitted' | 'evaluating' | 'completed' | 'abandoned';

export type EvaluationStatus = 'pending' | 'evaluated' | 'failed';

export interface AptisGroup {
  id: string;
  skill: AptisSkill;
  group_type: AptisGroupType;
  group_key: string;
  name: string;
  description: string | null;
  display_order: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AptisContentBlock {
  id: string;
  skill: AptisSkill;
  block_type: AptisBlockType;
  source_key: string;
  title: string | null;
  content: string | null;
  media_url: string | null;
  metadata: Record<string, any>;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export interface AptisQuestion {
  id: string;
  skill: AptisSkill;
  part_number: number;
  question_type: AptisQuestionType;
  source_key: string;
  source_file: string;
  content: string;
  display_order: number;
  ui_config: Record<string, any>;
  metadata: Record<string, any>;
  content_hash: string;
  import_status: 'imported' | 'updated';
  created_at: string;
  updated_at: string;
}

export interface AptisQuestionOption {
  id: string;
  question_id: string;
  option_key: string;
  content: string;
  display_order: number;
  metadata: Record<string, any>;
}

/**
 * PRIVATE Solution / Answer model (Accessible ONLY via backend / secure evaluation boundary after submission)
 */
export interface AptisQuestionAnswer {
  question_id: string;
  correct_answer: any;
  explanation: string | null;
  model_answer: string | null;
  rubric: Record<string, any> | null;
  solution_data: Record<string, any> | null;
  updated_at: string;
}

export interface PracticeAttempt {
  id: string;
  user_id: string;
  skill: AptisSkill;
  practice_mode: 'full_skill' | 'by_part' | 'by_club' | 'by_topic';
  part_number: number | null;
  group_id: string | null;
  status: AttemptStatus;
  total_score: number | null;
  started_at: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PracticeResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  response: any;
  word_count: number | null;
  recording_path: string | null;
  speech_transcript: string | null;
  answered_at: string;
  created_at: string;
  updated_at: string;
}

export interface PracticeResponseEvaluation {
  response_id: string;
  is_correct: boolean | null;
  score: number | null;
  ai_feedback: Record<string, any> | null;
  evaluation_status: EvaluationStatus;
  evaluated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionBookmark {
  user_id: string;
  question_id: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ----------------------------------------------------------------------------
// PUBLIC UI PAYLOADS (Stripped of correct_answer, model_answer, solutions)
// ----------------------------------------------------------------------------

export interface PublicContentBlockPayload {
  id: string;
  block_type: AptisBlockType;
  title: string | null;
  content: string | null;
  media_url: string | null;
  metadata: Record<string, any>;
  missing_media: boolean;
}

export interface PublicQuestionPayload {
  id: string;
  skill: AptisSkill;
  part_number: number;
  question_type: AptisQuestionType;
  source_key: string;
  content: string;
  display_order: number;
  ui_config: Record<string, any>;
  metadata: Record<string, any>;
  options: AptisQuestionOption[];
  content_blocks: PublicContentBlockPayload[];
}

export interface ReadingQuestionPayload extends PublicQuestionPayload {
  passage: PublicContentBlockPayload | null;
  ordering_metadata?: Record<string, any>;
  matching_metadata?: Record<string, any>;
}

export interface ListeningQuestionPayload extends PublicQuestionPayload {
  audio: PublicContentBlockPayload | null;
  missing_audio: boolean;
}

export interface SpeakingQuestionPayload extends PublicQuestionPayload {
  prompt: string;
  prep_time: number;
  speak_time: number;
  image: PublicContentBlockPayload | null;
  recording_required: boolean;
}

export interface WritingQuestionPayload extends PublicQuestionPayload {
  prompt: string;
  min_words: number | null;
  max_words: number | null;
  tone: 'formal' | 'informal' | null;
  recipient: string | null;
  word_counter_enabled: boolean;
}

export interface PracticeSetPayload {
  group: AptisGroup;
  questions: PublicQuestionPayload[];
  total_questions: number;
}
