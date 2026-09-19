# ASP.NET Core / C# Backend Refactor Handoff Specification

## 1. Overview & Objectives

This document provides exact mapping specifications for transitioning the OnAptis backend from Supabase Edge Functions (TypeScript) to an **ASP.NET Core Web API / C# Background Worker** architecture without modifying the React frontend or PostgreSQL database structure.

---

## 2. Component Mapping Table

| Supabase Edge / TypeScript Component | ASP.NET Core / C# Component Target | Responsibility |
| :--- | :--- | :--- |
| `supabase/functions/submit-practice/index.ts` | `PracticeSubmissionController.cs` | Receives `submit_question` and `submit_attempt` HTTP requests, validates JWT, enqueues evaluation jobs. |
| `src/services/evaluationApiClient.js` | *Keep JS interface intact* | Switch `VITE_EVALUATION_API_MODE=custom_http` to point to ASP.NET Core endpoints. |
| `_shared/ai/types.ts` | `AIEvaluationDTOs.cs` | `record` or `class` definitions for DTO payloads. |
| `_shared/ai/provider.ts` | `IAIEvaluator.cs`, `OpenAIEvaluator.cs`, `MockAIEvaluator.cs` | AI LLM & Whisper provider implementations. |
| `_shared/ai/answerMatching.ts` | `AnswerMatchingService.cs` | Deterministic short answer matching & Damerau-Levenshtein spelling tolerance. |
| `_shared/ai/rubrics.ts` | `RubricDefinitionService.cs` | Aptis criteria rubrics, score normalization, CEFR level ceiling logic. |
| `_shared/ai/scoring.ts` | `EvaluationScoringService.cs` | Aggregates raw criteria scores and applies audio guards. |
| `_shared/ai/validation.ts` | `EvaluationResultValidator.cs` | FluentValidation / DTO validation enforcing C2 rejection. |
| `claim_next_pending_evaluation` & `recover_stuck_evaluation_jobs` RPCs | `AIEvaluationBackgroundWorker.cs` (or Hangfire / Quartz.NET) | Durable background worker claiming jobs using `FOR UPDATE SKIP LOCKED`. |

---

## 3. C# Class & Interface Specifications

### DTO Models (`AIEvaluationDTOs.cs`)
```csharp
namespace OnAptis.Core.DTOs;

public enum AptisSkill { Reading, Listening, Writing, Speaking }
public enum CEFRLevel { A1, A2, B1, B2, C1 }
public enum EvaluationStatus { Pending, Processing, NeedsReview, Completed, Failed }

public record SubmissionRequestDto(
    string Action,
    Guid AttemptId,
    Guid QuestionId,
    UserResponsePayload Response
);

public record UserResponsePayload(
    string? Text,
    int? WordCount,
    string? RecordingPath
);

public record SubmissionResponseDto(
    bool Success,
    Guid AttemptId,
    Guid ResponseId,
    Guid EvaluationId,
    string EvaluationStatus,
    string Message
);
```

### Background Worker Pattern (`AIEvaluationBackgroundWorker.cs`)
```csharp
namespace OnAptis.Worker;

public class AIEvaluationBackgroundWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AIEvaluationBackgroundWorker> _logger;

    public AIEvaluationBackgroundWorker(IServiceProvider serviceProvider, ILogger<AIEvaluationBackgroundWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<OnAptisDbContext>();
            var aiEvaluator = scope.ServiceProvider.GetRequiredService<IAIEvaluator>();

            // Claim pending job atomically using FOR UPDATE SKIP LOCKED RPC
            var claimedJob = await dbContext.ClaimNextPendingEvaluationAsync("csharp_worker_node_1", stoppingToken);

            if (claimedJob != null)
            {
                await aiEvaluator.ProcessEvaluationAsync(claimedJob, stoppingToken);
            }
            else
            {
                await Task.Delay(3000, stoppingToken);
            }
        }
    }
}
```

---

## 4. Unchanged Components (Frontend & Infrastructure)

1. **React Frontend Components & Hooks**:
   - `WritingPractice.jsx`, `SpeakingPractice.jsx`, `Dashboard.jsx`.
   - `useWritingPractice.js`, `useSpeakingPractice.js`, `useDashboardStats.js`.
2. **PostgreSQL Database Schema**:
   - `practice_response_evaluations` table.
   - `practice_attempts` and `practice_responses` tables.
   - `speaking-recordings` and `speaking-images` Storage buckets and RLS policies.
