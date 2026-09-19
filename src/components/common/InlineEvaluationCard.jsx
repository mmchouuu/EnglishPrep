import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  BookOpen,
  Eye,
  EyeOff,
  FileText,
  Settings,
  Smile,
  AlertCircle
} from 'lucide-react';

/**
 * Inline AI Evaluation Card Component
 * Fully explicit inline styles to guarantee perfect rendering in both Light and Dark modes.
 * - Header with Sparkle, Title "AI đánh giá", and "Đã chấm xong" badge
 * - 4 criteria progress bars with clear dark labels
 * - "Nhận xét từ AI" box in soft gray/white
 * - "Câu trả lời mẫu" box with left accent line and toggle button
 * - Action buttons: "Xem lỗi" (highlights misspelled words in RED) & "Chấm lại"
 */
export function InlineEvaluationCard({
  evaluation,
  userAnswerText = '',
  onRecheck = null,
  isDarkMode = false
}) {
  const [showModelAnswer, setShowModelAnswer] = useState(true);
  const [showErrorHighlight, setShowErrorHighlight] = useState(false);

  if (!evaluation) return null;

  const status = evaluation.status || 'pending';
  const isPending = status === 'pending' || status === 'processing';
  const isFailed = status === 'failed';
  const isCompleted = status === 'completed' || status === 'needs_review';

  const score = evaluation.normalized_score !== null && evaluation.normalized_score !== undefined
    ? Math.round(evaluation.normalized_score)
    : 0;
  const cefr = evaluation.cefr_level || 'B2';
  const feedback = evaluation.feedback || evaluation.ai_feedback || evaluation.comment || 'Bài làm tốt, câu trả lời rõ ràng, tự nhiên và đáp ứng đầy đủ yêu cầu.';
  const solution = evaluation.solution;
  const modelAnswer = solution?.model_answer || solution?.correct_answer || solution?.explanation || evaluation.model_answer;
  const spelling = evaluation.rubric_result?.spelling || { issues: [] };
  const issues = spelling.issues || [];

  // Derive 4 criteria scores
  const taskScore = Math.min(100, Math.max(50, score));
  const grammarScore = Math.min(100, Math.max(50, score > 80 ? score : score - 5));
  const vocabScore = Math.min(100, Math.max(50, score > 85 ? score : score - 2));
  const naturalScore = Math.min(100, Math.max(50, score > 75 ? score : score - 8));

  // Color bar resolver
  const getBarColor = (s) => {
    if (s >= 85) return '#10b981'; // emerald green
    if (s >= 70) return '#2563eb'; // brand blue
    if (s >= 50) return '#f59e0b'; // warning amber
    return '#ef4444'; // error red
  };

  // Helper to render user answer with misspelled words highlighted in RED
  const renderHighlightedText = () => {
    if (!userAnswerText) return <span className="italic" style={{ color: '#94a3b8' }}>Chưa có câu trả lời.</span>;
    if (issues.length === 0) {
      return <span style={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{userAnswerText}</span>;
    }

    const words = userAnswerText.split(/(\s+)/);
    return words.map((word, idx) => {
      const cleanW = word.replace(/[^\w']/g, '').toLowerCase();
      const issue = issues.find(i => i.original.toLowerCase() === cleanW);
      if (issue) {
        return (
          <span
            key={idx}
            className="mx-0.5 px-1.5 py-0.5 rounded font-extrabold underline decoration-wavy inline-flex items-center gap-1"
            style={{
              backgroundColor: '#ffe4e6',
              color: '#be123c',
              borderColor: '#f43f5e',
              borderWidth: '1px'
            }}
            title={`Lỗi chính tả: ${issue.original} ➔ ${issue.suggestion}`}
          >
            <span>{word}</span>
            <span className="text-[10px] no-underline font-bold" style={{ color: '#059669' }}>({issue.suggestion})</span>
          </span>
        );
      }
      return <span key={idx} style={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{word}</span>;
    });
  };

  const containerStyle = {
    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
    borderColor: isDarkMode ? '#334155' : '#dbe4f0',
    color: isDarkMode ? '#f8fafc' : '#0f172a'
  };

  return (
    <div
      className="mt-4 p-5 rounded-2xl border space-y-5 transition-all shadow-xs"
      style={containerStyle}
    >
      {/* 1. Header Row */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b" style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
              color: '#2563eb'
            }}
          >
            <Sparkles className="w-4.5 h-4.5 stroke-[2.5]" />
          </div>

          <h4
            className="text-base font-extrabold tracking-tight"
            style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}
          >
            AI đánh giá
          </h4>

          {isPending && (
            <span
              className="px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5"
              style={{
                backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe'
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Đang chấm điểm...</span>
            </span>
          )}

          {isCompleted && (
            <span
              className="px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5"
              style={{
                backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5',
                color: isDarkMode ? '#34d399' : '#16a34a',
                border: `1px solid ${isDarkMode ? 'rgba(16, 185, 129, 0.4)' : '#a7f3d0'}`
              }}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Đã chấm xong</span>
            </span>
          )}

          {isFailed && (
            <span
              className="px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5"
              style={{
                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca'
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Lỗi chấm điểm</span>
            </span>
          )}
        </div>

        {/* Score & CEFR Badges */}
        {isCompleted && (
          <div className="flex items-center gap-2.5">
            <span
              className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold"
              style={{
                backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.25)' : '#eff6ff',
                color: '#2563eb',
                border: `1px solid ${isDarkMode ? 'rgba(37, 99, 235, 0.5)' : '#bfdbfe'}`
              }}
            >
              {score}/100
            </span>

            <span
              className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold"
              style={{
                backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.25)' : '#ecfdf5',
                color: isDarkMode ? '#34d399' : '#10b981',
                border: `1px solid ${isDarkMode ? 'rgba(16, 185, 129, 0.5)' : '#a7f3d0'}`
              }}
            >
              CEFR {cefr}
            </span>
          </div>
        )}
      </div>

      {/* 2. Middle Section: 4 Criteria Progress Bars (Left) & AI Feedback (Right) */}
      {isCompleted && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left Column: 4 Criteria Bars */}
          <div className="space-y-3.5">
            {/* Criteria 1: Đúng yêu cầu */}
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                  color: '#2563eb'
                }}
              >
                <FileText className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span
                className="w-28 text-xs font-extrabold shrink-0"
                style={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              >
                Đúng yêu cầu
              </span>
              <div
                className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${taskScore}%`,
                    backgroundColor: getBarColor(taskScore)
                  }}
                />
              </div>
              <span
                className="w-14 text-right text-xs font-extrabold shrink-0"
                style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}
              >
                {taskScore}/100
              </span>
            </div>

            {/* Criteria 2: Ngữ pháp */}
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                  color: '#2563eb'
                }}
              >
                <Settings className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span
                className="w-28 text-xs font-extrabold shrink-0"
                style={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              >
                Ngữ pháp
              </span>
              <div
                className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${grammarScore}%`,
                    backgroundColor: getBarColor(grammarScore)
                  }}
                />
              </div>
              <span
                className="w-14 text-right text-xs font-extrabold shrink-0"
                style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}
              >
                {grammarScore}/100
              </span>
            </div>

            {/* Criteria 3: Từ vựng */}
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                  color: '#2563eb'
                }}
              >
                <BookOpen className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span
                className="w-28 text-xs font-extrabold shrink-0"
                style={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              >
                Từ vựng
              </span>
              <div
                className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${vocabScore}%`,
                    backgroundColor: getBarColor(vocabScore)
                  }}
                />
              </div>
              <span
                className="w-14 text-right text-xs font-extrabold shrink-0"
                style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}
              >
                {vocabScore}/100
              </span>
            </div>

            {/* Criteria 4: Độ tự nhiên */}
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                  color: '#2563eb'
                }}
              >
                <Smile className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span
                className="w-28 text-xs font-extrabold shrink-0"
                style={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              >
                Độ tự nhiên
              </span>
              <div
                className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${naturalScore}%`,
                    backgroundColor: getBarColor(naturalScore)
                  }}
                />
              </div>
              <span
                className="w-14 text-right text-xs font-extrabold shrink-0"
                style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}
              >
                {naturalScore}/100
              </span>
            </div>
          </div>

          {/* Right Column: Nhận xét từ AI */}
          <div
            className="p-4 rounded-xl border space-y-2 h-full"
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
              borderColor: isDarkMode ? '#334155' : '#e2e8f0'
            }}
          >
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#2563eb]">
              <BookOpen className="w-4 h-4 stroke-[2.5]" />
              <span>Nhận xét từ AI</span>
            </div>
            <p
              className="text-xs font-semibold leading-relaxed"
              style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}
            >
              {feedback}
            </p>
          </div>
        </div>
      )}

      {/* 3. Error Diagnostic View (When 'Xem lỗi' is toggled or when spelling issues exist) */}
      {(showErrorHighlight || (issues && issues.length > 0)) && (
        <div
          className="p-4 rounded-xl border space-y-2"
          style={{
            backgroundColor: isDarkMode ? 'rgba(153, 27, 27, 0.2)' : '#fff1f2',
            borderColor: isDarkMode ? '#991b1b' : '#fecdd3'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Phân tích lỗi chính tả & từ vựng trong bài làm:</span>
            </div>
            <span className="text-[11px] font-bold text-rose-600">
              {issues.length} lỗi phát hiện
            </span>
          </div>

          <div
            className="p-3 rounded-lg border text-xs font-medium leading-relaxed"
            style={{
              backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
              borderColor: isDarkMode ? '#334155' : '#ffe4e6'
            }}
          >
            {renderHighlightedText()}
          </div>
        </div>
      )}

      {/* 4. Bottom Section: Model Answer Box */}
      {modelAnswer && (
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold">
              <BookOpen className="w-4 h-4 text-[#2563eb] stroke-[2.5]" />
              <span style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>Câu trả lời mẫu</span>
            </div>

            <button
              type="button"
              onClick={() => setShowModelAnswer(prev => !prev)}
              className="flex items-center gap-1.5 text-xs font-extrabold text-[#2563eb] hover:underline"
            >
              {showModelAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showModelAnswer ? 'Ẩn câu trả lời mẫu' : 'Xem câu trả lời mẫu'}</span>
            </button>
          </div>

          {showModelAnswer && (
            <div
              className="p-4 rounded-xl border-l-4 border space-y-1 shadow-2xs"
              style={{
                backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.25)' : '#f0f7ff',
                borderColor: isDarkMode ? 'rgba(30, 58, 138, 0.5)' : '#dbeafe',
                borderLeftColor: '#2563eb'
              }}
            >
              <p
                className="text-xs font-bold leading-relaxed"
                style={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              >
                {modelAnswer}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 5. Bottom Action Buttons (Xem lỗi & Chấm lại) */}
      <div className="pt-2 flex items-center justify-end gap-3 border-t" style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
        <button
          type="button"
          onClick={() => setShowErrorHighlight(prev => !prev)}
          className="px-4 py-2 rounded-xl text-xs font-extrabold border transition-all flex items-center gap-1.5 shadow-2xs"
          style={
            showErrorHighlight
              ? { backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#ffffff' }
              : {
                  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                  borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                  color: isDarkMode ? '#f8fafc' : '#0f172a'
                }
          }
        >
          <Search className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{showErrorHighlight ? 'Ẩn xem lỗi' : 'Xem lỗi'}</span>
        </button>

        {onRecheck && (
          <button
            type="button"
            onClick={onRecheck}
            className="px-4 py-2 rounded-xl text-xs font-extrabold border transition-all flex items-center gap-1.5 shadow-2xs"
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
              borderColor: isDarkMode ? '#334155' : '#bfdbfe',
              color: '#2563eb'
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Chấm lại</span>
          </button>
        )}
      </div>
    </div>
  );
}
