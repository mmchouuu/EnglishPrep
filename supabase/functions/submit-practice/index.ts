import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getAIProvider } from '../_shared/ai/provider.ts';
import { matchShortAnswer, evaluateObjectiveAnswer } from '../_shared/ai/answerMatching.ts';

// Setup CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Declare EdgeRuntime global for Deno Edge Runtime background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const OBJECTIVE_QUESTION_TYPES = [
  'multiple_choice',
  'sentence_ordering',
  'opinion_matching',
  'heading_matching',
  'listening_multiple_choice',
  'listening_matching'
];

const isValidUUID = (id: unknown): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function logDatabaseError(operationName: string, err: unknown): void {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    console.error(`[DATABASE_ERROR] ${operationName} failed:`, {
      code: e.code ?? 'UNKNOWN',
      message: e.message ?? String(err),
      details: e.details ?? null,
      hint: e.hint ?? null,
      operation: operationName
    });
  } else {
    console.error(`[DATABASE_ERROR] ${operationName} failed:`, String(err));
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('[EDGE_FUNCTION_CONFIG_ERROR] Server environment missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    }

    // Server-side admin client using service_role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Extract authorization header to verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized user session', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, attempt_id, question_id, evaluation_id, response } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: action', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION 0: Query Evaluation Record (Service Role Bypass RLS)
    if (action === 'get_evaluation') {
      if (!evaluation_id || !isValidUUID(evaluation_id)) {
        return new Response(
          JSON.stringify({ error: 'Valid evaluation_id UUID is required for get_evaluation', code: 'INVALID_UUID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: evalRecord, error: eErr } = await supabaseAdmin
        .from('practice_response_evaluations')
        .select('*')
        .eq('id', evaluation_id)
        .maybeSingle();

      if (eErr) throw eErr;

      return new Response(
        JSON.stringify({
          success: true,
          evaluation: evalRecord
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_attempt_evaluations') {
      if (!attempt_id || !isValidUUID(attempt_id)) {
        return new Response(
          JSON.stringify({ error: 'Valid attempt_id UUID is required for get_attempt_evaluations', code: 'INVALID_UUID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: evalRecords, error: eErr } = await supabaseAdmin
        .from('practice_response_evaluations')
        .select('id, response_id, question_id, status, normalized_score, cefr_level, rubric_result, feedback, updated_at, error_code, error_message')
        .eq('attempt_id', attempt_id);

      if (eErr) throw eErr;

      return new Response(
        JSON.stringify({
          success: true,
          evaluations: evalRecords || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!attempt_id || !isValidUUID(attempt_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing attempt_id UUID', code: 'INVALID_UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Attempt ownership & status
    const { data: attempt, error: aErr } = await supabaseAdmin
      .from('practice_attempts')
      .select('id, user_id, skill, practice_mode, part_number, group_id, status')
      .eq('id', attempt_id)
      .single();

    if (aErr) {
      console.error(`[DATABASE_ERROR] Querying practice_attempts for attempt ${attempt_id} failed:`, aErr.message);
      return new Response(
        JSON.stringify({ error: 'Failed to query practice attempt from database', code: 'ATTEMPT_QUERY_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!attempt) {
      return new Response(
        JSON.stringify({ error: 'Practice attempt not found', code: 'ATTEMPT_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (attempt.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: '[SECURITY_VIOLATION] Attempt does not belong to authenticated user.', code: 'UNAUTHORIZED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (attempt.status !== 'in_progress') {
      return new Response(
        JSON.stringify({ error: 'Practice attempt is not in_progress', code: 'INVALID_ATTEMPT_STATUS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION 1: Submit Single Question
    if (action === 'submit_question') {
      if (!question_id || !isValidUUID(question_id)) {
        return new Response(
          JSON.stringify({ error: 'Invalid or missing question_id UUID', code: 'INVALID_UUID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Read question master
      const { data: qData, error: qErr } = await supabaseAdmin
        .from('aptis_questions')
        .select('id, skill, part_number, question_type, content, metadata')
        .eq('id', question_id)
        .single();

      if (qErr) {
        console.error(`[DATABASE_ERROR] Querying aptis_questions for question ${question_id} failed:`, qErr.message);
        return new Response(
          JSON.stringify({ error: 'Failed to query question master from database', code: 'QUESTION_QUERY_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!qData) {
        return new Response(
          JSON.stringify({ error: 'Question not found', code: 'QUESTION_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Scope Authorization Check: Ensure question matches attempt contract
      let isScopeValid = false;
      if (qData.skill === attempt.skill) {
        if (attempt.practice_mode === 'full_skill') {
          if (attempt.part_number === null && attempt.group_id === null) {
            isScopeValid = true;
          }
        } else if (attempt.practice_mode === 'by_part') {
          if (qData.part_number === attempt.part_number && attempt.group_id === null) {
            isScopeValid = true;
          }
        } else if (attempt.practice_mode === 'by_topic' || attempt.practice_mode === 'by_club') {
          if (attempt.group_id !== null) {
            const { data: qgData } = await supabaseAdmin
              .from('aptis_question_groups')
              .select('group_id, aptis_groups!inner(skill)')
              .eq('question_id', qData.id)
              .eq('group_id', attempt.group_id)
              .maybeSingle();

            if (qgData) {
              const groupSkill = (qgData.aptis_groups as unknown as { skill: string })?.skill;
              if (groupSkill === attempt.skill) {
                if (attempt.part_number === null || qData.part_number === attempt.part_number) {
                  isScopeValid = true;
                }
              }
            }
          }
        }
      }

      if (!isScopeValid) {
        return new Response(
          JSON.stringify({ error: 'Question is out of scope for this attempt', code: 'QUESTION_OUT_OF_SCOPE' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate Audio Storage Recording Path for Speaking
      if (qData.skill === 'speaking' && typeof response === 'object' && response?.recording_path) {
        const rPath = String(response.recording_path);

        // Path Traversal Security check
        if (rPath.includes('..') || rPath.includes('\\') || rPath.startsWith('/')) {
          return new Response(
            JSON.stringify({ error: '[SECURITY_VIOLATION] Path traversal characters detected in recording_path.', code: 'INVALID_REQUEST' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Structure check: {userId}/{attemptId}/{responseId}/v{version}.{ext}
        if (!rPath.startsWith(`${user.id}/${attempt.id}/`)) {
          return new Response(
            JSON.stringify({ error: '[SECURITY_VIOLATION] Recording path must start with authenticated userId and attemptId.', code: 'UNAUTHORIZED' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Upsert User Response
      const userText = typeof response === 'string' ? response : (response?.text || response?.content || '');
      const recPath = typeof response === 'object' ? (response?.recording_path || null) : null;
      const wCount = typeof response === 'object' ? (response?.word_count || null) : null;

      const { data: respRecord, error: rErr } = await supabaseAdmin
        .from('practice_responses')
        .upsert(
          {
            attempt_id,
            question_id,
            response: response,
            recording_path: recPath,
            word_count: wCount,
            answered_at: new Date().toISOString()
          },
          { onConflict: 'attempt_id, question_id' }
        )
        .select()
        .single();

      if (rErr) throw rErr;

      // OBJECTIVE SCORING FOR READING / LISTENING
      if (qData.skill === 'reading' || qData.skill === 'listening') {
        if (!OBJECTIVE_QUESTION_TYPES.includes(qData.question_type)) {
          return new Response(
            JSON.stringify({ error: `Unsupported question type '${qData.question_type}' for objective evaluation`, code: 'UNSUPPORTED_QUESTION_TYPE' }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: ansData, error: ansErr } = await supabaseAdmin
          .from('aptis_question_answers')
          .select('correct_answer, explanation, solution_data')
          .eq('question_id', question_id)
          .maybeSingle();

        if (ansErr) {
          console.error(`[DATABASE_ERROR] Querying aptis_question_answers for question ${question_id} failed:`, ansErr.message);
          return new Response(
            JSON.stringify({ error: 'Failed to query question answers from database', code: 'ANSWER_QUERY_ERROR' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!ansData || ansData.correct_answer === undefined || ansData.correct_answer === null) {
          return new Response(
            JSON.stringify({ error: 'Correct answer not found in database for this question', code: 'ANSWER_NOT_FOUND' }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let evalDTO;
        try {
          evalDTO = evaluateObjectiveAnswer(
            qData.question_type,
            response,
            ansData.correct_answer,
            (ansData as unknown as { acceptable_answers?: string[] })?.acceptable_answers || [],
            (qData.metadata as Record<string, unknown>)?.grading || {}
          );
        } catch (evalErr: unknown) {
          const errMsg = evalErr instanceof Error ? evalErr.message : String(evalErr);

          if (errMsg === 'UNSUPPORTED_ANSWER_SHAPE') {
            return new Response(
              JSON.stringify({ error: 'Unsupported answer shape for objective evaluation', code: 'UNSUPPORTED_ANSWER_SHAPE' }),
              { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (errMsg === 'INVALID_RESPONSE_SHAPE') {
            return new Response(
              JSON.stringify({ error: 'Invalid user response shape for objective evaluation', code: 'INVALID_RESPONSE_SHAPE' }),
              { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (errMsg === 'UNSUPPORTED_QUESTION_TYPE') {
            return new Response(
              JSON.stringify({ error: `Unsupported question type '${qData.question_type}' for objective evaluation`, code: 'UNSUPPORTED_QUESTION_TYPE' }),
              { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.error(`[OBJECTIVE_EVALUATION_ERROR] Unexpected error evaluating question ${question_id}:`, evalErr);
          return new Response(
            JSON.stringify({ error: `Objective evaluation runtime error: ${errMsg}`, code: 'OBJECTIVE_EVALUATION_ERROR' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: evalRecord, error: eErr } = await supabaseAdmin
          .from('practice_response_evaluations')
          .upsert(
            {
              response_id: respRecord.id,
              attempt_id,
              question_id,
              skill: qData.skill,
              part_number: qData.part_number,
              status: 'completed',
              evaluation_status: 'evaluated',
              evaluator_type: 'objective',
              is_correct: evalDTO.isCorrect,
              raw_score: evalDTO.rawScore,
              max_score: evalDTO.maxScore,
              normalized_score: evalDTO.normalizedScore,
              feedback: evalDTO.feedback,
              version: 1,
              completed_at: new Date().toISOString(),
              evaluated_at: new Date().toISOString(),
              error_code: null,
              error_message: null
            },
            { onConflict: 'response_id,evaluator_type,version' }
          )
          .select()
          .single();

        if (eErr) {
          logDatabaseError('Upserting objective practice_response_evaluations', eErr);
          return new Response(
            JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            response: respRecord,
            evaluation: {
              id: evalRecord.id,
              status: evalRecord.status,
              is_correct: evalRecord.is_correct,
              raw_score: evalRecord.raw_score,
              max_score: evalRecord.max_score,
              normalized_score: evalRecord.normalized_score,
              feedback: evalRecord.feedback
            },
            solution: {
              correct_answer: evalDTO.extractedCorrectAnswer,
              explanation: ansData.explanation || null,
              solution_data: ansData.solution_data || null
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // SUBJECTIVE AI EVALUATION FOR WRITING / SPEAKING
      // 1. Commit Pending Evaluation Record first
      const { data: existingEval, error: existingEvalError } = await supabaseAdmin
        .from('practice_response_evaluations')
        .select('id, version')
        .eq('response_id', respRecord.id)
        .eq('evaluator_type', 'ai')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingEvalError) {
        logDatabaseError('Querying previous AI evaluation version', existingEvalError);
        return new Response(
          JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newVersion = (existingEval?.version ?? 0) + 1;
      const supersedesId = existingEval?.id ?? null;

      const { data: pendingEval, error: pErr } = await supabaseAdmin
        .from('practice_response_evaluations')
        .insert({
          response_id: respRecord.id,
          attempt_id,
          question_id,
          skill: qData.skill,
          part_number: qData.part_number,
          status: 'pending',
          evaluation_status: 'pending',
          evaluator_type: 'ai',
          version: newVersion,
          supersedes_evaluation_id: supersedesId
        })
        .select()
        .single();

      if (pErr) {
        logDatabaseError('Creating AI pending practice_response_evaluations', pErr);
        if (pErr.code === '23505') {
          return new Response(
            JSON.stringify({ error: 'An evaluation is already being created. Please retry.', code: 'EVALUATION_VERSION_CONFLICT' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Trigger Async Background AI Evaluation Job
      const backgroundTask = async () => {
        try {
          const apiKey = Deno.env.get('AI_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '';
          const enableMockEnv = Deno.env.get('ENABLE_AI_MOCK');
          const isDev = (Deno.env.get('DENO_ENV') || 'development') === 'development';
          const isMock = enableMockEnv !== undefined ? enableMockEnv : (!apiKey && isDev ? 'true' : 'false');

          const env = {
            ENABLE_AI_MOCK: isMock,
            AI_API_KEY: apiKey,
            AI_BASE_URL: Deno.env.get('AI_BASE_URL') || Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
            AI_MODEL: Deno.env.get('AI_MODEL') || 'gpt-4o-mini',
            DENO_ENV: Deno.env.get('DENO_ENV') || 'development'
          };

          const providerEngine = getAIProvider(env);
          const currentAttemptId = attempt.id;

          // Update status to processing
          await supabaseAdmin
            .from('practice_response_evaluations')
            .update({ status: 'processing', started_at: new Date().toISOString() })
            .eq('id', pendingEval.id);

          let evalResult;
          if (qData.skill === 'writing') {
            evalResult = await providerEngine.writingEvaluator.evaluateWriting({
              evaluationId: pendingEval.id,
              attemptId: currentAttemptId,
              responseId: respRecord.id,
              questionId: question_id,
              skill: 'writing',
              partNumber: qData.part_number,
              userResponseText: userText,
              version: newVersion,
              supersedesEvaluationId: supersedesId
            });
          } else {
            evalResult = await providerEngine.speakingEvaluator.evaluateSpeaking({
              evaluationId: pendingEval.id,
              attemptId: currentAttemptId,
              responseId: respRecord.id,
              questionId: question_id,
              skill: 'speaking',
              partNumber: qData.part_number,
              userResponseText: userText,
              recordingPath: recPath,
              version: newVersion,
              supersedesEvaluationId: supersedesId
            });
          }

          // Update terminal evaluation state in DB
          const evalStatus = evalResult.status;
          const legacyEvalStatus = evalStatus === 'completed' ? 'evaluated' : (evalStatus === 'failed' ? 'failed' : 'pending');

          await supabaseAdmin
            .from('practice_response_evaluations')
            .update({
              status: evalStatus,
              evaluation_status: legacyEvalStatus,
              provider: evalResult.provider,
              model_name: evalResult.modelName,
              model_version: evalResult.modelVersion,
              prompt_version: evalResult.promptVersion,
              rubric_version: evalResult.rubricVersion,
              raw_score: evalResult.rawScore,
              max_score: evalResult.maxScore,
              normalized_score: evalResult.normalizedScore,
              cefr_level: evalResult.cefrLevel,
              rubric_result: evalResult.rubricResult,
              strengths: evalResult.strengths,
              improvements: evalResult.improvements,
              feedback: evalResult.feedback,
              confidence: evalResult.confidence,
              completed_at: new Date().toISOString(),
              evaluated_at: new Date().toISOString(),
              error_code: null,
              error_message: null
            })
            .eq('id', pendingEval.id);

        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await supabaseAdmin
            .from('practice_response_evaluations')
            .update({
              status: 'failed',
              evaluation_status: 'failed',
              error_code: 'AI_PROVIDER_ERROR',
              error_message: errMsg,
              normalized_score: null,
              cefr_level: null,
              completed_at: new Date().toISOString()
            })
            .eq('id', pendingEval.id);
        }
      };

      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(backgroundTask());
      } else {
        backgroundTask(); // Fallback for local development
      }

      // Return HTTP 202 Pending Contract
      return new Response(
        JSON.stringify({
          success: true,
          attemptId: attempt_id,
          responseId: respRecord.id,
          evaluationId: pendingEval.id,
          evaluationStatus: 'pending',
          message: 'Response received and queued for AI evaluation.'
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION 2: Submit Attempt Session
    if (action === 'submit_attempt') {
      let totalScore: number | null = null;
      let finalStatus = 'completed';

      if (attempt.skill === 'reading' || attempt.skill === 'listening') {
        const { data: evals } = await supabaseAdmin
          .from('practice_response_evaluations')
          .select('raw_score, status')
          .eq('attempt_id', attempt_id)
          .eq('evaluator_type', 'objective')
          .eq('status', 'completed');

        if (evals && evals.length > 0) {
          totalScore = evals.reduce((sum, e) => sum + (Number(e.raw_score) || 0), 0);
        } else {
          // Fallback: sum directly via objective matcher for allowlisted question types
          const { data: responses } = await supabaseAdmin
            .from('practice_responses')
            .select('id, question_id, response')
            .eq('attempt_id', attempt_id);

          let sum = 0;
          let count = 0;
          for (const r of (responses || [])) {
            const { data: qData } = await supabaseAdmin
              .from('aptis_questions')
              .select('skill, question_type, metadata')
              .eq('id', r.question_id)
              .single();

            if (qData && OBJECTIVE_QUESTION_TYPES.includes(qData.question_type)) {
              const { data: ansData } = await supabaseAdmin
                .from('aptis_question_answers')
                .select('correct_answer')
                .eq('question_id', r.question_id)
                .maybeSingle();

              if (ansData && ansData.correct_answer !== undefined && ansData.correct_answer !== null) {
                try {
                  const evalDTO = evaluateObjectiveAnswer(
                    qData.question_type,
                    r.response,
                    ansData.correct_answer,
                    (ansData as unknown as { acceptable_answers?: string[] })?.acceptable_answers || [],
                    (qData.metadata as Record<string, unknown>)?.grading || {}
                  );
                  sum += evalDTO.rawScore;
                  count++;
                } catch (_) {
                  // Skip invalid answer shape
                }
              }
            }
          }
          if (count > 0) totalScore = sum;
        }
        finalStatus = 'completed';
      } else {
        // Writing / Speaking: Strictly query AI evaluations
        finalStatus = 'submitted';
        const { data: aiEvals } = await supabaseAdmin
          .from('practice_response_evaluations')
          .select('normalized_score, status')
          .eq('attempt_id', attempt_id)
          .eq('evaluator_type', 'ai');

        if (aiEvals && aiEvals.length > 0) {
          const completedEvals = aiEvals.filter(e => e.status === 'completed' && e.normalized_score !== null);
          const isAllCompleted = aiEvals.length === completedEvals.length;
          if (isAllCompleted && completedEvals.length > 0) {
            const avgScore = completedEvals.reduce((sum, e) => sum + (Number(e.normalized_score) || 0), 0) / completedEvals.length;
            totalScore = Math.round(avgScore * 100) / 100;
            finalStatus = 'completed';
          }
        }
      }

      const { data: updatedAttempt, error: uErr } = await supabaseAdmin
        .from('practice_attempts')
        .update({
          status: finalStatus,
          total_score: totalScore,
          submitted_at: new Date().toISOString()
        })
        .eq('id', attempt_id)
        .select()
        .single();

      if (uErr) throw uErr;

      return new Response(
        JSON.stringify({
          success: true,
          attempt: updatedAttempt,
          total_evaluated_score: totalScore
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported action '${action}'`, code: 'INVALID_REQUEST' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    logDatabaseError('Unhandled Edge Function request error', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


