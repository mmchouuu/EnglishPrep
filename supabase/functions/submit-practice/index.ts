import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getAIProvider } from '../_shared/ai/provider.ts';
import { matchShortAnswer } from '../_shared/ai/answerMatching.ts';

// Setup CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Declare EdgeRuntime global for Deno Edge Runtime background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

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
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized user session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, attempt_id, question_id, response } = body;

    if (!action || !attempt_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: action, attempt_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Attempt ownership
    const { data: attempt, error: aErr } = await supabaseAdmin
      .from('practice_attempts')
      .select('id, user_id, skill, part_number, status')
      .eq('id', attempt_id)
      .single();

    if (aErr || !attempt) {
      return new Response(
        JSON.stringify({ error: 'Practice attempt not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (attempt.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: '[SECURITY_VIOLATION] Attempt does not belong to authenticated user.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION 1: Submit Single Question
    if (action === 'submit_question') {
      if (!question_id) {
        return new Response(
          JSON.stringify({ error: 'question_id is required for submit_question' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Read question master
      const { data: qData, error: qErr } = await supabaseAdmin
        .from('aptis_questions')
        .select('id, skill, part_number, question_type, content, metadata')
        .eq('id', question_id)
        .single();

      if (qErr || !qData) {
        return new Response(
          JSON.stringify({ error: 'Question not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate Audio Storage Recording Path for Speaking
      if (qData.skill === 'speaking' && typeof response === 'object' && response?.recording_path) {
        const rPath = String(response.recording_path);

        // Path Traversal Security check
        if (rPath.includes('..') || rPath.includes('\\') || rPath.startsWith('/')) {
          return new Response(
            JSON.stringify({ error: '[SECURITY_VIOLATION] Path traversal characters detected in recording_path.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Structure check: {userId}/{attemptId}/{responseId}/v{version}.{ext}
        if (!rPath.startsWith(`${user.id}/${attempt.id}/`)) {
          return new Response(
            JSON.stringify({ error: '[SECURITY_VIOLATION] Recording path must start with authenticated userId and attemptId.' }),
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

      // Read private answer solution (Server Admin ONLY)
      const { data: ansData } = await supabaseAdmin
        .from('aptis_question_answers')
        .select('correct_answer, acceptable_answers, explanation, model_answer, rubric, solution_data')
        .eq('question_id', question_id)
        .maybeSingle();

      // OBJECTIVE SCORING FOR READING / LISTENING
      if (qData.skill === 'reading' || qData.skill === 'listening') {
        const matchResult = matchShortAnswer(
          userText,
          ansData?.correct_answer,
          ansData?.acceptable_answers || [],
          (qData.metadata as Record<string, unknown>)?.grading || {}
        );

        const { data: evalRecord, error: eErr } = await supabaseAdmin
          .from('practice_response_evaluations')
          .upsert({
            response_id: respRecord.id,
            attempt_id,
            question_id,
            skill: qData.skill,
            part_number: qData.part_number,
            status: 'completed',
            evaluator_type: 'ai',
            normalized_score: matchResult.score * 100,
            raw_score: matchResult.score,
            max_score: 1.0,
            feedback: matchResult.matchType,
            completed_at: new Date().toISOString()
          })
          .select()
          .single();

        if (eErr) throw eErr;

        return new Response(
          JSON.stringify({
            success: true,
            response: respRecord,
            evaluation: evalRecord,
            solution: ansData ? {
              correct_answer: ansData.correct_answer,
              explanation: ansData.explanation,
              model_answer: ansData.model_answer,
              solution_data: ansData.solution_data
            } : null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // SUBJECTIVE AI EVALUATION FOR WRITING / SPEAKING
      // 1. Commit Pending Evaluation Record first
      const { data: existingEval } = await supabaseAdmin
        .from('practice_response_evaluations')
        .select('id, version')
        .eq('response_id', respRecord.id)
        .order('version', { ascending: false })
        .maybeSingle();

      const newVersion = (existingEval?.version || 0) + 1;
      const supersedesId = existingEval?.id || null;

      const { data: pendingEval, error: pErr } = await supabaseAdmin
        .from('practice_response_evaluations')
        .upsert({
          response_id: respRecord.id,
          attempt_id,
          question_id,
          skill: qData.skill,
          part_number: qData.part_number,
          status: 'pending',
          evaluator_type: 'ai',
          version: newVersion,
          supersedes_evaluation_id: supersedesId
        })
        .select()
        .single();

      if (pErr) throw pErr;

      // 2. Trigger Async Background AI Evaluation Job
      const backgroundTask = async () => {
        try {
          const env = {
            ENABLE_AI_MOCK: Deno.env.get('ENABLE_AI_MOCK') || 'false',
            AI_API_KEY: Deno.env.get('AI_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '',
            AI_MODEL: Deno.env.get('AI_MODEL') || 'gpt-4o-mini',
            DENO_ENV: Deno.env.get('DENO_ENV') || 'development'
          };

          const providerEngine = getAIProvider(env);

          // Update status to processing
          await supabaseAdmin
            .from('practice_response_evaluations')
            .update({ status: 'processing', started_at: new Date().toISOString() })
            .eq('id', pendingEval.id);

          let evalResult;
          if (qData.skill === 'writing') {
            evalResult = await providerEngine.writingEvaluator.evaluateWriting({
              evaluationId: pendingEval.id,
              attemptId,
              responseId: respRecord.id,
              questionId,
              skill: 'writing',
              partNumber: qData.part_number,
              userResponseText: userText,
              version: newVersion,
              supersedesEvaluationId: supersedesId
            });
          } else {
            evalResult = await providerEngine.speakingEvaluator.evaluateSpeaking({
              evaluationId: pendingEval.id,
              attemptId,
              responseId: respRecord.id,
              questionId,
              skill: 'speaking',
              partNumber: qData.part_number,
              userResponseText: userText,
              recordingPath: recPath,
              version: newVersion,
              supersedesEvaluationId: supersedesId
            });
          }

          // Update terminal evaluation state in DB
          await supabaseAdmin
            .from('practice_response_evaluations')
            .update({
              status: evalResult.status,
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
              completed_at: new Date().toISOString()
            })
            .eq('id', pendingEval.id);

        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await supabaseAdmin
            .from('practice_response_evaluations')
            .update({
              status: 'failed',
              error_code: 'AI_PROVIDER_ERROR',
              error_message: errMsg,
              normalized_score: null,
              cefr_level: null
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
      const { data: responses } = await supabaseAdmin
        .from('practice_responses')
        .select('id, question_id, response')
        .eq('attempt_id', attempt_id);

      let totalScore = 0;
      let evaluatedCount = 0;

      for (const r of (responses || [])) {
        const { data: qData } = await supabaseAdmin
          .from('aptis_questions')
          .select('skill')
          .eq('id', r.question_id)
          .single();

        if (qData && (qData.skill === 'reading' || qData.skill === 'listening')) {
          const { data: ansData } = await supabaseAdmin
            .from('aptis_question_answers')
            .select('correct_answer')
            .eq('question_id', r.question_id)
            .maybeSingle();

          if (ansData && ansData.correct_answer !== undefined) {
            const uStr = typeof r.response === 'string' ? r.response : (r.response?.text || '');
            const match = matchShortAnswer(uStr, ansData.correct_answer);
            if (match.isCorrect) {
              totalScore += 1.0;
            }
            evaluatedCount++;
          }
        }
      }

      const finalStatus = (attempt.skill === 'reading' || attempt.skill === 'listening') ? 'completed' : 'submitted';

      const { data: updatedAttempt, error: uErr } = await supabaseAdmin
        .from('practice_attempts')
        .update({
          status: finalStatus,
          total_score: evaluatedCount > 0 ? totalScore : null,
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
          total_evaluated_score: evaluatedCount > 0 ? totalScore : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported action '${action}'` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
