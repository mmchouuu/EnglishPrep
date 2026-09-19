import React from 'react';
import { X, Sparkles, CheckCircle2, AlertTriangle, RefreshCw, Award, BookOpen, AlertCircle } from 'lucide-react';

/**
 * Reusable AI Evaluation Modal Component
 * Displays real-time evaluation status, normalized score, CEFR level,
 * criteria breakdowns, spelling diagnostics, strengths, and improvements.
 */
export function AIEvaluationModal({ evaluation, onClose, isDarkMode = false }) {
  if (!evaluation) return null;

  const status = evaluation.status || 'pending';
  const isPending = status === 'pending' || status === 'processing';
  const isFailed = status === 'failed';
  const isCompleted = status === 'completed' || status === 'needs_review';

  const normalizedScore = evaluation.normalized_score !== null && evaluation.normalized_score !== undefined
    ? Math.round(evaluation.normalized_score)
    : null;
  const cefrLevel = evaluation.cefr_level;
  const rubricResult = evaluation.rubric_result || {};
  const criteria = rubricResult.criteria || [];
  const spelling = rubricResult.spelling || { issueCount: 0, issues: [] };
  const strengths = evaluation.strengths || [];
  const improvements = evaluation.improvements || [];
  const feedback = evaluation.feedback;

  const theme = isDarkMode
    ? {
      bg: '#0f172a',
      cardBg: '#1e293b',
      border: '#334155',
      text: '#ffffff',
      subText: '#cbd5e1',
      muted: '#94a3b8'
    }
    : {
      bg: '#ffffff',
      cardBg: '#f8fafc',
      border: '#e2e8f0',
      text: '#0f172a',
      subText: '#334155',
      muted: '#64748b'
    };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-8 space-y-0 transition-all"
        style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
      >
        {/* Modal Header */}
        <div
          className="p-5 border-b flex items-center justify-between"
          style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: theme.border }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#2563eb]/10 text-[#2563eb]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight" style={{ color: theme.text }}>
                  Kết quả chấm điểm AI
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                  AI practice estimate
                </span>
              </div>
              <p className="text-xs" style={{ color: theme.muted }}>
                Đánh giá chi tiết dựa trên thang điểm chuẩn Aptis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

          {/* STATE 1: PENDING / PROCESSING */}
          {isPending && (
            <div className="p-10 rounded-2xl border text-center space-y-4 my-4" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
              <RefreshCw className="w-10 h-10 text-[#2563eb] animate-spin mx-auto" />
              <div className="space-y-1">
                <h4 className="text-base font-extrabold" style={{ color: theme.text }}>
                  AI đang phân tích & chấm điểm bài làm...
                </h4>
                <p className="text-xs max-w-sm mx-auto" style={{ color: theme.muted }}>
                  Hệ thống đang thực hiện phân tích Ngữ pháp, Từ vựng, Task Fulfilment và Chính tả. Kết quả sẽ tự động hiển thị trong vài giây.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: FAILED */}
          {isFailed && (
            <div className="p-8 rounded-2xl border text-center space-y-4 my-4 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-rose-700 dark:text-rose-300">
                  Không thể hoàn tất chấm điểm AI
                </h4>
                <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md mx-auto">
                  {evaluation.error_message || 'Có lỗi xảy ra trong quá trình xử lý bài làm. Vui lòng thử lại.'}
                </p>
              </div>
            </div>
          )}

          {/* STATE 3: COMPLETED / NEEDS REVIEW */}
          {isCompleted && (
            <>
              {/* Score Header Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Score Widget */}
                <div
                  className="p-5 rounded-2xl border flex items-center gap-4"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#2563eb]/10 border border-[#2563eb]/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xl font-extrabold text-[#2563eb]">
                      {normalizedScore !== null ? normalizedScore : '—'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">/ 100</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold block" style={{ color: theme.muted }}>Điểm tổng quan</span>
                    <h4 className="text-lg font-extrabold" style={{ color: theme.text }}>
                      {normalizedScore !== null ? `${normalizedScore} điểm` : 'Chờ giáo viên duyệt'}
                    </h4>
                    {status === 'needs_review' && (
                      <span className="text-[10px] font-bold text-amber-500 block">
                        ⚠ Cần giáo viên chấm bài phát âm trực tiếp
                      </span>
                    )}
                  </div>
                </div>

                {/* CEFR Level Widget */}
                <div
                  className="p-5 rounded-2xl border flex items-center gap-4"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center shrink-0">
                    <Award className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block" style={{ color: theme.muted }}>Trình độ ước tính (CEFR)</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {cefrLevel || '—'}
                      </span>
                      {cefrLevel && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                          Thang Aptis
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* General Feedback Summary */}
              {feedback && (
                <div className="p-4 rounded-xl border space-y-1.5" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#2563eb]">
                    <BookOpen className="w-4 h-4" />
                    <span>Nhận xét tổng quan của AI:</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: theme.subText }}>
                    {feedback}
                  </p>
                </div>
              )}

              {/* Criteria Breakdown */}
              {criteria.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Chi tiết tiêu chí chấm điểm
                  </h4>
                  <div className="space-y-2.5">
                    {criteria.map((c, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl border space-y-1.5"
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span style={{ color: theme.text }}>{c.criterionName}</span>
                          <span className="text-[#2563eb]">{c.score} / {c.maxScore} pts</span>
                        </div>
                        {c.feedback && (
                          <p className="text-xs leading-relaxed" style={{ color: theme.muted }}>
                            {c.feedback}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spelling Diagnostics (if issues found) */}
              {spelling && spelling.issues && spelling.issues.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-500">
                      Gợi ý sửa lỗi chính tả ({spelling.issues.length} lỗi)
                    </h4>
                  </div>
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                    {spelling.issues.map((issue, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs border-b border-amber-500/10 pb-1.5 last:border-b-0 last:pb-0">
                        <div>
                          <span className="line-through text-rose-500 font-bold mr-2">{issue.original}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">→ {issue.suggestion}</span>
                        </div>
                        {issue.reason && (
                          <span className="text-[11px] text-slate-400">{issue.reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {strengths.length > 0 && (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Điểm mạnh:</span>
                    </div>
                    <ul className="text-xs space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300">
                      {strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {improvements.length > 0 && (
                  <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-600 dark:text-blue-400">
                      <Sparkles className="w-4 h-4" />
                      <span>Cần cải thiện:</span>
                    </div>
                    <ul className="text-xs space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300">
                      {improvements.map((imp, idx) => (
                        <li key={idx}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div
          className="p-4 border-t flex items-center justify-end gap-3"
          style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: theme.border }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all"
          >
            Đóng bảng điểm
          </button>
        </div>
      </div>
    </div>
  );
}
