import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Mic, MicOff, Check, CheckCircle, ArrowRight,
  Clock, RotateCcw, Flag, Sparkles, Save,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  MessageSquare, Info, Search, ShieldAlert,
  LogIn, RefreshCw, Eye, EyeOff, Volume2, AlertTriangle, Database
} from 'lucide-react';
import confetti from 'canvas-confetti';

import PartSelector from './reading/PartSelector';
import PracticeModeSelector from './reading/PracticeModeSelector';
import ReadingTimerProgressWidget from './reading/ReadingTimerProgressWidget';
import TopicHeaderBanner from './reading/TopicHeaderBanner';
import BookmarkButton from './reading/BookmarkButton';
import NavigatorActionButtons from './common/NavigatorActionButtons';
import { AIEvaluationModal } from './common/AIEvaluationModal';
import { InlineEvaluationCard } from './common/InlineEvaluationCard';

import { useSpeakingPractice } from '../hooks/useSpeakingPractice';


// ─── Part Definitions ─────────────────────────────────────────────────────────
const speakingParts = [
  { id: '1', label: 'Part 1', sublabel: 'Personal Information' },
  { id: '2', label: 'Part 2', sublabel: 'Describe a Photo' },
  { id: '3', label: 'Part 3', sublabel: 'Compare Photos' },
  { id: '4', label: 'Part 4', sublabel: 'Abstract Topic' }
];

// ─── Global Audio Object URL Registry for Safe Revocation ──────────────────────
const activeAudioObjects = new Set();

// ─── useRecorder Custom Hook with Strict Lifecycle & Safety Rules ─────────────
function useRecorder(questionId, savedDraft = '') {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [transcript, setTranscript] = useState(() => {
    if (savedDraft) return savedDraft;
    try {
      return localStorage.getItem(`spk_draft_${questionId}`) || '';
    } catch {
      return '';
    }
  });
  const [elapsed, setElapsed] = useState(0);
  const [permissionError, setPermissionError] = useState(null);

  const mrRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const recogRef = useRef(null);
  const timerRef = useRef(null);
  const recordedUrlRef = useRef(null);
  const audioPlayingRef = useRef(false);

  // Active recording flag & session transcript refs (decoupled from prop re-renders to prevent loop duplication)
  const isRecordingRef = useRef(false);
  const initialDraftRef = useRef(savedDraft || '');
  const sessionHistoryTextRef = useRef('');
  const currentSessionTextRef = useRef('');

  // Sync savedDraft ONLY when not actively recording to prevent feedback loop
  useEffect(() => {
    if (isRecordingRef.current) return;
    if (savedDraft) {
      setTranscript(savedDraft);
      initialDraftRef.current = savedDraft;
      sessionHistoryTextRef.current = '';
      currentSessionTextRef.current = '';
    } else {
      try {
        const local = localStorage.getItem(`spk_draft_${questionId}`);
        if (local) {
          setTranscript(local);
          initialDraftRef.current = local;
          sessionHistoryTextRef.current = '';
          currentSessionTextRef.current = '';
        } else {
          setTranscript('');
          initialDraftRef.current = '';
          sessionHistoryTextRef.current = '';
          currentSessionTextRef.current = '';
        }
      } catch { }
    }
  }, [questionId, savedDraft]);

  // Auto-save transcript draft to localStorage whenever transcript changes
  useEffect(() => {
    if (questionId && transcript) {
      try {
        localStorage.setItem(`spk_draft_${questionId}`, transcript);
      } catch { }
    }
  }, [questionId, transcript]);

  // Stop all active streams, contexts, speech recognizers, and timers
  const stop = useCallback(() => {
    isRecordingRef.current = false;
    if (mrRef.current && mrRef.current.state !== 'inactive') {
      try { mrRef.current.stop(); } catch { }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (recogRef.current) {
      recogRef.current.onend = null; // Remove auto-restart handler prior to explicit stop
      try { recogRef.current.stop(); } catch { }
      recogRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      try { ctxRef.current.close(); } catch { }
      ctxRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  // Safe Revoke Object URL: Only revokes if not playing
  const safeRevokeUrl = useCallback(() => {
    if (recordedUrlRef.current && !audioPlayingRef.current) {
      const url = recordedUrlRef.current;
      activeAudioObjects.delete(url);
      try { URL.revokeObjectURL(url); } catch { }
      recordedUrlRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    safeRevokeUrl();
    setRecordedUrl(null);
    setTranscript('');
    initialDraftRef.current = '';
    sessionHistoryTextRef.current = '';
    currentSessionTextRef.current = '';
    try { localStorage.removeItem(`spk_draft_${questionId}`); } catch { }
    setElapsed(0);
    setPermissionError(null);
  }, [stop, safeRevokeUrl, questionId]);

  // Clean up resources on question switch or unmount
  useEffect(() => {
    return () => {
      stop();
      safeRevokeUrl();
    };
  }, [questionId, stop, safeRevokeUrl]);

  const start = useCallback(async () => {
    setPermissionError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError('Trình duyệt của bạn không hỗ trợ ghi âm.');
      return;
    }

    reset();
    isRecordingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mr.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          recordedUrlRef.current = url;
          activeAudioObjects.add(url);
          setRecordedUrl(url);
        }
      };

      mr.start();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(buf);
          const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        recogRef.current = rec;
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (ev) => {
          let sessionText = '';
          for (let i = 0; i < ev.results.length; i++) {
            sessionText += ev.results[i][0].transcript + ' ';
          }
          currentSessionTextRef.current = sessionText;
          const fullTranscript = (initialDraftRef.current + ' ' + sessionHistoryTextRef.current + ' ' + sessionText).replace(/\s+/g, ' ').trim();
          setTranscript(fullTranscript);
        };

        rec.onend = () => {
          if (currentSessionTextRef.current) {
            sessionHistoryTextRef.current = (sessionHistoryTextRef.current + ' ' + currentSessionTextRef.current).replace(/\s+/g, ' ').trim();
            currentSessionTextRef.current = '';
          }
          if (isRecordingRef.current && mrRef.current && mrRef.current.state === 'recording') {
            try {
              rec.start();
            } catch { }
          }
        };

        rec.start();
      }
    } catch (err) {
      stop();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Vui lòng cho phép truy cập Microphone trong trình duyệt để ghi âm bài nói.');
      } else {
        setPermissionError('Không thể kết nối Microphone. Vui lòng kiểm tra lại thiết bị.');
      }
    }
  }, [reset, stop]);

  return {
    isRecording,
    audioLevel,
    recordedUrl,
    transcript,
    elapsed,
    permissionError,
    audioPlayingRef,
    start,
    stop,
    reset
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ─── Safe Image Component with Infinite Loop Prevention & Fallback Support ──
function SafeImage({ src, fallbackSrc, alt, className }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [triedFallback, setTriedFallback] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setTriedFallback(false);
    setImgError(false);
  }, [src]);

  const handleError = () => {
    if (fallbackSrc && !triedFallback && currentSrc !== fallbackSrc) {
      setTriedFallback(true);
      setCurrentSrc(fallbackSrc);
    } else {
      setImgError(true);
    }
  };

  if (imgError || !currentSrc) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-400 p-4 text-center ${className}`}>
        <Database className="w-8 h-8 mb-2 text-slate-400" />
        <span className="text-xs font-semibold">Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt || 'Speaking prompt photo'}
      className={className}
      onError={handleError}
    />
  );
}

// ─── Post-Submission Model Answer Toggler ──────────────────────────────────────
// SECURITY RULE: Strictly disabled & hidden BEFORE submission! Only displays
// if server evaluation response returns valid model_answer.
function PostSubmitSampleAnswer({ isSubmitted, serverSolution, isDarkMode }) {
  const [showSample, setShowSample] = useState(false);

  if (!isSubmitted || !serverSolution) return null;

  const sampleAnswer = serverSolution.model_answer || serverSolution.solution_data?.sample_answer || serverSolution.explanation;
  if (!sampleAnswer) return null;

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setShowSample(prev => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${showSample
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
          : isDarkMode
            ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs'
          }`}
      >
        {showSample ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        <span>{showSample ? 'Ẩn câu trả lời mẫu (Server)' : 'Xem câu trả lời mẫu (Server)'}</span>
      </button>

      {showSample && (
        <div className={`mt-2 p-3.5 rounded-xl border text-xs leading-relaxed transition-all ${isDarkMode
          ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
          : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
          <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-700 dark:text-amber-400">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Official Model Answer (Evaluated by Server):</span>
          </div>
          <p>{sampleAnswer}</p>
        </div>
      )}
    </div>
  );
}

// ─── Waveform / Recorder Widget ───────────────────────────────────────────────
function RecorderWidget({ rec, maxTime, isDarkMode }) {
  const bars = 30;
  const cardBg = isDarkMode ? 'bg-[#111827] border-[#29364a]' : 'bg-white border-slate-200';

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${cardBg}`}>
      {rec.permissionError && (
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{rec.permissionError}</span>
        </div>
      )}

      {/* Mic + waveform row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={rec.isRecording ? rec.stop : rec.start}
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all ${rec.isRecording
            ? 'bg-rose-500 shadow-lg shadow-rose-500/30 animate-pulse'
            : 'bg-[#2563eb] hover:bg-[#1d4ed8] shadow-lg shadow-blue-500/20'
            }`}
        >
          {rec.isRecording ? (
            <MicOff className="w-5 h-5 text-white" />
          ) : (
            <Mic className="w-5 h-5 text-white" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-0.5 h-8 mb-1.5">
            {Array.from({ length: bars }).map((_, i) => {
              const active = rec.isRecording && i < Math.round((rec.audioLevel / 100) * bars);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-75 ${active ? 'bg-[#2563eb]' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
                    }`}
                  style={{ height: active ? `${Math.max(4, Math.round(Math.random() * 26) + 4)}px` : '4px' }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={`font-semibold flex items-center gap-1.5 ${rec.isRecording ? 'text-emerald-600 dark:text-emerald-400' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${rec.isRecording ? 'bg-emerald-500 animate-pulse' : isDarkMode ? 'bg-slate-600' : 'bg-slate-300'
                }`} />
              {rec.isRecording ? 'Đang ghi âm...' : rec.recordedUrl ? 'Đã ghi âm (Local preview)' : 'Nhấn mic để phát biểu'}
            </span>
            <span className={`font-bold tabular-nums ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {fmt(rec.elapsed)} / {fmt(maxTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Audio Playback player */}
      {rec.recordedUrl && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <audio
            src={rec.recordedUrl}
            controls
            onPlay={() => { rec.audioPlayingRef.current = true; }}
            onPause={() => { rec.audioPlayingRef.current = false; }}
            onEnded={() => { rec.audioPlayingRef.current = false; }}
            className="w-full h-8"
          />
        </div>
      )}

      {/* Speech-to-text Transcript */}
      <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-50'}`}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-slate-400">
          Nội dung bản chép lời (Speech-to-Text)
        </p>
        <p className={`text-xs leading-relaxed min-h-[32px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          {rec.transcript || <span className="italic text-slate-400">Giọng nói sẽ được tự động chép lời tại đây khi bạn nói...</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Part 1 Card ──────────────────────────────────────────────────────────────
function Part1Card({ q, isDarkMode, isOpen, onToggle, total, isSubmitted, serverSolution, itemEvaluation, isMarked, onMark, savedResponse, onSaveResponse, onSubmitQuestion }) {
  const rec = useRecorder(q.id, savedResponse?.transcript);
  const [draftSaved, setDraftSaved] = useState(false);

  // Sync recorder output to hook state
  useEffect(() => {
    if (rec.recordedUrl || rec.transcript) {
      onSaveResponse(q.id, {
        transcript: rec.transcript,
        elapsed: rec.elapsed,
        recordingPersistence: 'local_only',
        status: 'recorded'
      });
    }
  }, [q.id, rec.recordedUrl, rec.transcript, rec.elapsed, onSaveResponse]);

  const handleSaveDraft = () => {
    if (rec.transcript) {
      try { localStorage.setItem(`spk_draft_${q.id}`, rec.transcript); } catch { }
      onSaveResponse(q.id, {
        transcript: rec.transcript,
        elapsed: rec.elapsed,
        recordingPersistence: 'local_only',
        status: 'draft'
      });
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2500);
    }
  };

  const bg = isOpen
    ? (isDarkMode ? 'bg-slate-800/90 border-slate-700 shadow-sm' : 'bg-slate-200/90 border-slate-300 shadow-xs')
    : (isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100/80 border-slate-200/80 hover:bg-slate-200/70 transition-all');

  return (
    <div className={`rounded-2xl border transition-all ${bg}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left"
      >
        <span className="w-7 h-7 rounded-full bg-[#2563eb] text-white text-xs font-extrabold flex items-center justify-center shrink-0 shadow-xs">
          {q.num}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-semibold mb-0.5">Question {q.num} of {total}</p>
          <p className={`text-sm font-extrabold truncate ${isDarkMode ? 'text-white' : 'text-[#0f172a]'}`}>
            {q.question}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
            {q.speakTime}s
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 space-y-3">
          <RecorderWidget rec={rec} maxTime={q.speakTime} isDarkMode={isDarkMode} />

          {/* Post-submit official model answer */}
          <PostSubmitSampleAnswer isSubmitted={isSubmitted} serverSolution={serverSolution} isDarkMode={isDarkMode} />

          <div className={`pt-3 border-t flex items-center justify-between gap-3 flex-wrap ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <BookmarkButton
              isBookmarked={isMarked}
              onToggle={onMark}
              label="Mark"
              isDarkMode={isDarkMode}
            />

            <div className="flex items-center gap-2">
              {rec.transcript && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${draftSaved
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 shadow-xs'
                    }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{draftSaved ? 'Saved draft!' : 'Save draft'}</span>
                </button>
              )}
              {rec.recordedUrl && (
                <button
                  type="button"
                  onClick={rec.reset}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 shadow-xs'
                    }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ghi lại</span>
                </button>
              )}
              {(rec.recordedUrl || rec.transcript) && (
                <button
                  type="button"
                  onClick={() => {
                    onSubmitQuestion(q.id, {
                      transcript: rec.transcript,
                      elapsed: rec.elapsed,
                      recordingPersistence: 'local_only',
                      status: 'recorded'
                    }, { prompt: q.question, modelAnswer: q.modelAnswer || q.sampleAnswer, partNumber: 1 });
                    confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{isSubmitted ? 'Chấm lại câu này' : 'Check response'}</span>
                </button>
              )}
              {isSubmitted && !itemEvaluation && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" />Đã nộp (Pending evaluation)
                </span>
              )}
            </div>
          </div>

          {/* Inline AI Evaluation Card */}
          <InlineEvaluationCard
            evaluation={itemEvaluation}
            userAnswerText={rec.transcript}
            onRecheck={() => {
              onSubmitQuestion(q.id, {
                transcript: rec.transcript,
                elapsed: rec.elapsed,
                recordingPersistence: 'local_only',
                status: 'recorded'
              }, { modelAnswer: q.modelAnswer || q.sampleAnswer });
            }}
            isDarkMode={isDarkMode}
          />
        </div>
      )}
    </div>
  );
}

function Part1PersonalInfo({
  questions = [], activeIdx = 0, topicItem = null, isDarkMode,
  markedQs = {}, onMark = () => { }, submittedQs = {},
  evaluationResults = {}, itemEvaluations = {}, savedResponses = {}, onSaveResponse = () => { }, onSubmitQuestion = () => { }
}) {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const safeMarked = markedQs || {};
  const safeSubmitted = submittedQs || {};
  const safeEval = evaluationResults || {};

  const [openIdx, setOpenIdx] = useState(activeIdx);

  useEffect(() => {
    setOpenIdx(activeIdx);
  }, [activeIdx]);

  const bg = isDarkMode ? 'bg-[#0f172a] border-slate-800 text-slate-100' : 'bg-white border-slate-200/80 text-[#0f172a] shadow-xs';
  const firstQ = safeQuestions[0] || {};
  const topicId = topicItem?.id || topicItem?.setKey || topicItem?.groupKey || firstQ.groupKey || firstQ.id || 'part1-topic';

  return (
    <div className={`rounded-2xl border p-6 sm:p-7 shadow-xs space-y-4 ${bg}`}>
      <div className="space-y-3">
        {safeQuestions.map((q, i) => {
          const qId = q?.id || `sp1-q-${i}`;
          return (
            <div key={qId} id={`speaking-q-${i}`} data-scroll-index={i} className="scroll-mt-24">
              <Part1Card
                q={q}
                isDarkMode={isDarkMode}
                isOpen={openIdx === i}
                onToggle={() => setOpenIdx(prev => prev === i ? -1 : i)}
                total={safeQuestions.length}
                isSubmitted={!!safeSubmitted[qId]}
                serverSolution={safeEval[qId]}
                itemEvaluation={itemEvaluations[qId]}
                isMarked={!!safeMarked[qId]}
                onMark={() => onMark(qId)}
                savedResponse={savedResponses[qId]}
                onSaveResponse={onSaveResponse}
                onSubmitQuestion={onSubmitQuestion}
              />
            </div>
          );
        })}
      </div>

      {/* Bottom Topic-level Mark button for Part 1 */}
      <div className={`pt-4 border-t flex items-center justify-between gap-3 flex-wrap ${isDarkMode ? 'border-slate-800' : 'border-slate-200/80'}`}>
        <BookmarkButton
          isBookmarked={!!safeMarked[topicId]}
          onToggle={() => onMark(topicId)}
          label="Mark Topic"
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
}

// ─── Part 2 Question Card ──────────────────────────────────────────────────────
function Part2QuestionCard({ q, speakTime, isDarkMode, isMarked, onMark, isSubmitted, serverSolution, itemEvaluation, savedResponse, onSaveResponse, onSubmitQuestion }) {
  const rec = useRecorder(q.id, savedResponse?.transcript);
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    if (rec.recordedUrl || rec.transcript) {
      onSaveResponse(q.id, {
        transcript: rec.transcript,
        elapsed: rec.elapsed,
        recordingPersistence: 'local_only',
        status: 'recorded'
      });
    }
  }, [q.id, rec.recordedUrl, rec.transcript, rec.elapsed, onSaveResponse]);

  const handleSaveDraft = () => {
    if (rec.transcript) {
      try { localStorage.setItem(`spk_draft_${q.id}`, rec.transcript); } catch { }
      onSaveResponse(q.id, {
        transcript: rec.transcript,
        elapsed: rec.elapsed,
        recordingPersistence: 'local_only',
        status: 'draft'
      });
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2500);
    }
  };

  const cardBg = isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/60 border-slate-200/80';

  return (
    <div id={`speaking-q-${q.id}`} className={`rounded-xl border p-4 space-y-3 scroll-mt-24 ${cardBg}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-[#2563eb] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
            {q.num}
          </span>
          <span className={`text-sm font-bold leading-snug ${isDarkMode ? 'text-white' : 'text-[#0f172a]'}`}>{q.text}</span>
        </div>
        <span className={`text-[11px] font-semibold flex items-center gap-1 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
          <Clock className="w-3.5 h-3.5" />{speakTime}s
        </span>
      </div>

      <RecorderWidget rec={rec} maxTime={speakTime} isDarkMode={isDarkMode} />

      <PostSubmitSampleAnswer isSubmitted={isSubmitted} serverSolution={serverSolution} isDarkMode={isDarkMode} />

      <div className={`pt-2 border-t flex items-center justify-between gap-2 flex-wrap ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
        <BookmarkButton isBookmarked={isMarked} onToggle={onMark} label="Mark" isDarkMode={isDarkMode} />
        <div className="flex gap-2">
          {rec.transcript && (
            <button
              type="button"
              onClick={handleSaveDraft}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${draftSaved
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{draftSaved ? 'Saved draft!' : 'Save draft'}</span>
            </button>
          )}
          {rec.recordedUrl && (
            <button
              type="button"
              onClick={rec.reset}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ghi lại</span>
            </button>
          )}
          {(rec.recordedUrl || rec.transcript) && (
            <button
              type="button"
              onClick={() => {
                onSubmitQuestion(q.id, {
                  transcript: rec.transcript,
                  elapsed: rec.elapsed,
                  recordingPersistence: 'local_only',
                  status: 'recorded'
                }, { prompt: q.text, modelAnswer: q.modelAnswer || q.sampleAnswer || q.solution, partNumber: 2 });
                confetti({ particleCount: 25, spread: 45, origin: { y: 0.7 } });
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{isSubmitted ? 'Chấm lại câu này' : 'Check response'}</span>
            </button>
          )}
          {isSubmitted && !itemEvaluation && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Done</span>}
        </div>
      </div>

      {/* Inline AI Evaluation Card */}
      <InlineEvaluationCard
        evaluation={itemEvaluation}
        userAnswerText={rec.transcript}
        onRecheck={() => {
          onSubmitQuestion(q.id, {
            transcript: rec.transcript,
            elapsed: rec.elapsed,
            recordingPersistence: 'local_only',
            status: 'recorded'
          }, { modelAnswer: q.modelAnswer || q.sampleAnswer || q.solution });
        }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

// ─── Part 2: Describe Photo Container ─────────────────────────────────────────
function Part2DescribePhoto({ topic, isDarkMode, markedQs, onMark, submittedQs, evaluationResults, itemEvaluations, savedResponses = {}, onSaveResponse, onSubmitQuestion }) {
  const bg = isDarkMode ? 'bg-[#0f172a] border-slate-800 text-slate-100' : 'bg-white border-[#cbd5e1]/60 text-[#0f172a]';
  const infoBg = isDarkMode ? 'bg-blue-950/40 border-blue-900/50 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700';

  const variants = Array.isArray(topic.imageVariants) && topic.imageVariants.length > 0
    ? topic.imageVariants
    : (Array.isArray(topic.images) ? topic.images : []);

  const [activeVariantIdx, setActiveVariantIdx] = useState(topic.activeVariantIndex || 0);

  const activeImage = variants[activeVariantIdx] || variants[0];
  const hasMultipleVariants = variants.length > 1;

  const setNum = (function () {
    const m = String(topic.setKey || topic.id || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  })();
  const paddedNum = String(setNum).padStart(3, '0');
  const fallbackUrl = `/assets/speaking/part-2/set-${paddedNum}/photo-${activeVariantIdx + 1}.jpg`;

  return (
    <div className={`rounded-2xl border p-6 sm:p-7 shadow-xs space-y-5 scroll-mt-24 ${bg}`}>
      {/* Set Title Header */}
      <div className={`flex items-center justify-between p-3.5 px-4 rounded-xl border ${infoBg}`}>
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0" />
          <h3 className="text-sm font-extrabold text-[#2563eb] dark:text-blue-400 tracking-wider uppercase">
            {topic.topicName || `SET ${String(setNum).padStart(2, '0')}`}
          </h3>
        </div>
        <span className="text-xs font-bold text-blue-600 dark:text-blue-300">
          3 questions ({topic.speakTime || 45}s per q)
        </span>
      </div>

      {/* Variant toggle buttons if set has 2 photo variants */}
      {hasMultipleVariants && (
        <div className="flex items-center justify-center gap-2">
          {variants.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveVariantIdx(i)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${activeVariantIdx === i
                ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-xs'
                : isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
            >
              Photo {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Render ONLY ONE active image at a time full-width */}
      <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-[16/10]">
        <SafeImage
          src={activeImage?.url}
          fallbackSrc={activeImage?.fallbackUrl || fallbackUrl}
          alt={activeImage?.alt || `${topic.topicName} - Photo ${activeVariantIdx + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="space-y-4">
        {topic.questions.map((q) => (
          <Part2QuestionCard
            key={q.id}
            q={q}
            speakTime={topic.speakTime}
            isDarkMode={isDarkMode}
            isMarked={!!markedQs[q.id]}
            onMark={() => onMark(q.id)}
            isSubmitted={!!submittedQs[q.id]}
            serverSolution={evaluationResults[q.id]}
            itemEvaluation={itemEvaluations?.[q.id]}
            savedResponse={savedResponses[q.id]}
            onSaveResponse={onSaveResponse}
            onSubmitQuestion={onSubmitQuestion}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div className={`pt-5 border-t flex items-center justify-between gap-3 flex-wrap ${isDarkMode ? 'border-slate-800' : 'border-slate-200/80'}`}>
        <BookmarkButton isBookmarked={!!markedQs[topic.id]} onToggle={() => onMark(topic.id)} label="Mark topic" isDarkMode={isDarkMode} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } })}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all"
          >
            Check this set <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Part 3: Compare Photos Container ─────────────────────────────────────────
function Part3ComparePhotos({ topic, isDarkMode, markedQs, onMark, submittedQs, evaluationResults, itemEvaluations, savedResponses = {}, onSaveResponse, onSubmitQuestion }) {
  const bg = isDarkMode ? 'bg-[#0f172a] border-slate-800 text-slate-100' : 'bg-white border-[#cbd5e1]/60 text-[#0f172a]';
  const infoBg = isDarkMode ? 'bg-blue-950/40 border-blue-900/50 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700';

  const combinedImg = topic.combinedImage || (Array.isArray(topic.images) ? topic.images[0] : null);

  const setNum = (function () {
    const m = String(topic.setKey || topic.id || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  })();
  const paddedNum = String(setNum).padStart(3, '0');
  const fallbackUrl = `/assets/speaking/part-3/set-${paddedNum}/comparison.jpg`;

  return (
    <div className={`rounded-2xl border p-6 sm:p-7 shadow-xs space-y-5 scroll-mt-24 ${bg}`}>
      {/* Set Title Header */}
      <div className={`flex items-center justify-between p-3.5 px-4 rounded-xl border ${infoBg}`}>
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0" />
          <h3 className="text-sm font-extrabold text-[#2563eb] dark:text-blue-400 tracking-wider uppercase">
            {topic.topicName || `SET ${String(setNum).padStart(2, '0')}`}
          </h3>
        </div>
        <span className="text-xs font-bold text-blue-600 dark:text-blue-300">
          3 questions ({topic.speakTime || 45}s per q)
        </span>
      </div>

      {/* Render ONE combined comparison image full-width */}
      {combinedImg && (
        <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-[16/9]">
          <SafeImage
            src={combinedImg.url}
            fallbackSrc={combinedImg.fallbackUrl || fallbackUrl}
            alt={combinedImg.alt || `${topic.topicName} - Comparison Image`}
            className="w-full h-full object-contain bg-slate-950/10 dark:bg-slate-900/50"
          />
        </div>
      )}

      {/* 3 question cards */}
      <div className="space-y-4">
        {topic.questions.map((q) => (
          <Part2QuestionCard
            key={q.id}
            q={q}
            speakTime={topic.speakTime}
            isDarkMode={isDarkMode}
            isMarked={!!markedQs[q.id]}
            onMark={() => onMark(q.id)}
            isSubmitted={!!submittedQs[q.id]}
            serverSolution={evaluationResults[q.id]}
            itemEvaluation={itemEvaluations?.[q.id]}
            savedResponse={savedResponses[q.id]}
            onSaveResponse={onSaveResponse}
            onSubmitQuestion={onSubmitQuestion}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div className={`pt-5 border-t flex items-center justify-between gap-3 flex-wrap ${isDarkMode ? 'border-slate-800' : 'border-slate-200/80'}`}>
        <BookmarkButton isBookmarked={!!markedQs[topic.id]} onToggle={() => onMark(topic.id)} label="Mark topic" isDarkMode={isDarkMode} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } })}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all"
          >
            Check this set <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single Timer for Speaking Part 4 (120s Speak) ───────────────────────────
function Part4SpeakingTimer({ speakSeconds = 120, isDarkMode }) {
  const bg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200';

  return (
    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${bg}`}>
      <div className="flex items-center gap-3">
        <div className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#2563eb]" />
          <span>Thời gian phát biểu: {speakSeconds}s (Single Task)</span>
        </div>
      </div>
      <span className="text-xs text-slate-400 font-semibold">Trả lời cả 3 câu hỏi trong cùng một bài nói ({speakSeconds}s)</span>
    </div>
  );
}

// ─── Part 4: Abstract Topic Container ────────────────────────────────────────
function Part4AbstractTopic({ topic, isDarkMode, markedQs, onMark, submittedQs, evaluationResults, itemEvaluations, savedResponses = {}, onSaveResponse, onSubmitQuestion }) {
  const rec = useRecorder(topic.id, savedResponses?.[topic.id]?.transcript);
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem(`p4_notes_${topic.id}`) || savedResponses?.[topic.id]?.notes || '';
  });
  const [showVariants, setShowVariants] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const isSubmitted = !!submittedQs[topic.id];
  const serverSolution = evaluationResults[topic.id];

  useEffect(() => {
    try { localStorage.setItem(`p4_notes_${topic.id}`, notes); } catch { }
    if (rec.recordedUrl || rec.transcript || notes) {
      onSaveResponse(topic.id, {
        notes,
        transcript: rec.transcript,
        elapsed: rec.elapsed,
        recordingPersistence: 'local_only',
        status: 'recorded'
      });
    }
  }, [topic.id, notes, rec.recordedUrl, rec.transcript, rec.elapsed, onSaveResponse]);

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(`p4_notes_${topic.id}`, notes);
      if (rec.transcript) localStorage.setItem(`spk_draft_${topic.id}`, rec.transcript);
    } catch { }
    onSaveResponse(topic.id, {
      notes,
      transcript: rec.transcript,
      elapsed: rec.elapsed,
      recordingPersistence: 'local_only',
      status: 'draft'
    });
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2500);
  };

  const handleSubmit = () => {
    onSubmitQuestion(topic.id, {
      notes,
      transcript: rec.transcript,
      elapsed: rec.elapsed,
      recordingPersistence: 'local_only',
      status: 'recorded'
    }, { prompt: topic.topicName || mainQ.text, modelAnswer: topic.sampleAnswer || topic.solution, partNumber: 4 });
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
  };

  const bg = isDarkMode ? 'bg-[#0f172a] border-slate-800 text-slate-100' : 'bg-white border-[#cbd5e1]/60 text-[#0f172a]';
  const mainQ = topic.prompts?.[0] || { text: topic.questions?.[0] || 'Main Question' };
  const subQ1 = topic.prompts?.[1] || { text: topic.questions?.[1] || 'Subquestion 1' };
  const subQ2 = topic.prompts?.[2] || { text: topic.questions?.[2] || 'Subquestion 2' };

  return (
    <div className={`rounded-2xl border p-6 sm:p-7 shadow-xs space-y-6 ${bg}`}>
      {/* 1. Speaking Timer (120s) */}
      <Part4SpeakingTimer speakSeconds={topic.speakTime || 120} isDarkMode={isDarkMode} />

      {/* 2. Module Prompts Card (Main Question + 2 Subquestions) */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold tracking-wider uppercase text-[#2563eb]">
              {topic.moduleName || topic.topicName}
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-400 shrink-0">3 prompts (Single Speaking Task)</span>
        </div>

        {/* Prompt 1: Main Question */}
        <div className={`p-4 rounded-xl border space-y-2 ${isDarkMode ? 'bg-slate-900 border-blue-900/40' : 'bg-blue-50/50 border-blue-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#2563eb] text-white">
              1. Main Question
            </span>
            {mainQ.variants && mainQ.variants.length > 0 && (
              <button
                type="button"
                onClick={() => setShowVariants(p => !p)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {showVariants ? 'Ẩn phrasings' : `+${mainQ.variants.length} cách hỏi khác`}
              </button>
            )}
          </div>
          <p className={`text-sm font-extrabold leading-snug ${isDarkMode ? 'text-white' : 'text-[#0f172a]'}`}>
            {mainQ.text}
          </p>

          {showVariants && mainQ.variants && (
            <div className={`mt-2 p-2.5 rounded-lg border text-xs space-y-1 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Alternate Prompt Variants (Main Question):</p>
              {mainQ.variants.map((v, vIdx) => (
                <p key={vIdx} className="italic">&bull; {v}</p>
              ))}
            </div>
          )}
        </div>

        {/* Prompt 2: Subquestion 1 */}
        <div className={`p-3.5 rounded-xl border space-y-1 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            2. Subquestion 1
          </span>
          <p className={`text-xs font-bold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            {subQ1.text}
          </p>
        </div>

        {/* Prompt 3: Subquestion 2 */}
        <div className={`p-3.5 rounded-xl border space-y-1 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`}>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            3. Subquestion 2
          </span>
          <p className={`text-xs font-bold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            {subQ2.text}
          </p>
        </div>
      </div>

      {/* 4. Notes + Single Recorder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
        {/* Preparation Notes */}
        <div className={`rounded-xl border p-4 space-y-2 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/60 border-slate-200/80'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Ghi chú dàn ý <span className="font-normal text-slate-400">(Notes for preparation)</span>
              </span>
            </div>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Viết các ý chính của bạn tại đây (dàn ý phát biểu cho 3 câu hỏi)..."
            maxLength={500}
            className={`w-full h-40 resize-none text-xs p-3 rounded-xl border outline-none focus:border-blue-400 transition-all leading-relaxed ${isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600' : 'bg-white border-slate-200 text-[#0f172a] placeholder:text-slate-300'
              }`}
          />
          <p className="text-right text-[10px] text-slate-400">{notes.length}/500</p>
        </div>

        {/* Single Recorder */}
        <div className={`rounded-xl border p-4 space-y-3 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/60 border-slate-200/80'}`}>
          <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Phần ghi âm phát biểu (Single recorder for whole Module)
          </span>
          <RecorderWidget rec={rec} maxTime={topic.speakTime || 120} isDarkMode={isDarkMode} />
          {rec.recordedUrl && (
            <button
              type="button"
              onClick={rec.reset}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ghi lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Post-submit official model answer */}
      <PostSubmitSampleAnswer isSubmitted={isSubmitted} serverSolution={serverSolution} isDarkMode={isDarkMode} />

      {/* Inline AI Evaluation Card */}
      <InlineEvaluationCard
        evaluation={itemEvaluations?.[topic.id]}
        userAnswerText={rec.transcript}
        onRecheck={handleSubmit}
        isDarkMode={isDarkMode}
      />

      {/* Bottom actions */}
      <div className={`pt-5 border-t flex items-center justify-between gap-3 flex-wrap ${isDarkMode ? 'border-slate-800' : 'border-slate-200/80'}`}>
        <BookmarkButton isBookmarked={!!markedQs[topic.id]} onToggle={() => onMark(topic.id)} label="Mark Module" isDarkMode={isDarkMode} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${draftSaved
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : isDarkMode
                ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs'
              }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{draftSaved ? 'Saved draft!' : 'Save draft'}</span>
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!rec.recordedUrl && !rec.transcript}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all disabled:opacity-50"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{isSubmitted ? 'Chấm lại Module' : 'Check response'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Speaking Navigator (Right Sidebar) ───────────────────────────────────────
function SpeakingNavigator({
  selectedPart, currentMode, currentTopicIdx = 0, onSelectTopicIdx,
  items = [], markedQs = {}, submittedQs = {}, isDarkMode
}) {
  const [jumpInput, setJumpInput] = useState('');

  const bg = isDarkMode ? 'bg-[#111827] border-[#29364a]' : 'bg-white border-[#d8e2ef]';
  const textColor = isDarkMode ? 'text-white' : 'text-[#0f172a]';
  const subText = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const safeItems = Array.isArray(items) ? items : [];
  const safeMarked = markedQs || {};
  const safeSubmitted = submittedQs || {};

  const flaggedCount = Object.values(safeMarked).filter(Boolean).length;
  const submittedCount = Object.values(safeSubmitted).filter(Boolean).length;
  const totalCount = safeItems.length;

  const handleJump = (e) => {
    e.preventDefault();
    const n = parseInt(jumpInput, 10);
    if (!isNaN(n) && n >= 1 && n <= totalCount) {
      onSelectTopicIdx(n - 1);
      setJumpInput('');
    }
  };

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-20">
      <ReadingTimerProgressWidget
        timeStr="00:00:00"
        answeredCount={submittedCount}
        totalCount={totalCount}
        isDarkMode={isDarkMode}
      />

      <div className={`p-5 rounded-2xl border shadow-xs space-y-4 ${bg}`}>
        <div className="flex items-center justify-between">
          <h3 className={`text-base font-extrabold tracking-tight ${textColor}`}>
            Part {selectedPart}
          </h3>
          <span className={`text-xs font-semibold ${subText}`}>
            {submittedCount}/{totalCount}
          </span>
        </div>

        <form onSubmit={handleJump} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={selectedPart === 1 && currentMode === 'full' ? 'e.g. 2' : 'e.g. 1'}
              value={jumpInput}
              onChange={e => setJumpInput(e.target.value)}
              className={`flex-1 px-3 py-1.5 rounded-xl text-xs border outline-none transition-all focus:border-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 shadow-inner'
                }`}
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1 shrink-0"
            >
              <Search className="w-3 h-3" />Go
            </button>
          </div>
        </form>

        <div className={`flex items-center justify-between text-[11px] font-medium py-2 border-y ${isDarkMode ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-200'
          }`}>
          <div className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-white'}`} />
            <span>Not done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#2563eb]" />
            <span>Submitted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-rose-500 bg-rose-500/20" />
            <span>Flagged</span>
          </div>
        </div>

        {selectedPart === 1 && currentMode === 'full' ? (
          <div className="grid grid-cols-7 gap-2 max-h-52 overflow-y-auto pr-1">
            {safeItems.map((q, idx) => {
              const qId = q?.id || `q-${idx}`;
              const isActive = idx === currentTopicIdx;
              const isFlagged = !!safeMarked[qId];
              const isDone = !!safeSubmitted[qId];

              let style = isDarkMode
                ? { bg: '#1e293b', border: '#334155', text: '#cbd5e1' }
                : { bg: '#ffffff', border: '#d8e2ef', text: '#0f172a' };

              if (isActive && !isDone && !isFlagged) {
                style = isDarkMode
                  ? { bg: '#334155', border: '#2563eb', text: '#ffffff' }
                  : { bg: '#e2e8f0', border: '#2563eb', text: '#0f172a' };
              }

              if (isDone) style = { bg: '#2563eb', border: '#2563eb', text: '#ffffff' };
              if (isFlagged) style = { bg: 'rgba(244,63,94,0.15)', border: '#f43f5e', text: isDarkMode ? '#fda4af' : '#e11d48' };

              return (
                <button
                  key={qId}
                  type="button"
                  onClick={() => onSelectTopicIdx(idx)}
                  className="h-8 rounded-lg text-xs font-extrabold border flex items-center justify-center transition-all focus:outline-none"
                  style={{
                    backgroundColor: style.bg,
                    borderColor: style.border,
                    color: style.text
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {safeItems.map((topic, idx) => {
              const tId = topic?.id || topic?.setKey || `topic-${idx}`;
              const isActive = idx === currentTopicIdx;
              const isFlagged = !!safeMarked[tId];
              const isDone = !!safeSubmitted[tId];
              const isPart4 = selectedPart === 4;
              const showCoreHeader = isPart4 && topic?.coreName && (idx === 0 || topic.coreNumber !== safeItems[idx - 1]?.coreNumber);

              return (
                <React.Fragment key={tId}>
                  {showCoreHeader && (
                    <div className={`mt-3 mb-1 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase flex items-center gap-1.5 ${isDarkMode
                      ? 'bg-blue-950/80 border border-blue-900/60 text-blue-300'
                      : 'bg-blue-50 border border-blue-200/80 text-blue-800'
                      }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] shrink-0" />
                      <span className="truncate">{topic.coreName}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectTopicIdx(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left ${isActive
                      ? isDarkMode ? 'bg-blue-950/50 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-[#2563eb]'
                      : isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <span className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${isDone ? 'bg-[#2563eb] text-white' :
                      isFlagged ? 'bg-rose-500/20 text-rose-600 border border-rose-500' :
                        isActive ? 'bg-[#2563eb] text-white' :
                          isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                      {idx + 1}
                    </span>
                    <span className="truncate flex-1">{topic?.topicName || topic?.moduleName || `Set ${idx + 1}`}</span>
                    {isFlagged && <Flag className="w-3 h-3 text-rose-500 shrink-0" />}
                    {isDone && !isFlagged && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}

        <NavigatorActionButtons
          flaggedCount={flaggedCount}
          onSubmitAll={() => confetti({ particleCount: 100, spread: 90, origin: { y: 0.6 } })}
          isDarkMode={isDarkMode}
        />
      </div>
    </aside>
  );
}

// ─── Main SpeakingPractice Component ──────────────────────────────────────────
export function SpeakingPractice({ isDarkMode = false }) {
  const { partId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedPart = useMemo(() => {
    if (!partId) return 1;
    const match = String(partId).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }, [partId]);
  const currentMode = searchParams.get('mode') || 'full';
  const topicParam = searchParams.get('topic');
  const coreParam = searchParams.get('core');
  const moduleParam = searchParams.get('module');

  const currentTopicIdx = useMemo(() => {
    if (!topicParam) return 0;
    const parsed = parseInt(topicParam, 10);
    return isNaN(parsed) || parsed < 1 ? 0 : parsed - 1;
  }, [topicParam]);

  const {
    authStatus,
    authUser,
    loading,
    error,
    isEmpty,
    attempt,
    groups,
    activeGroup,
    adaptedData,
    coreStories,
    userRecordings,
    markedQuestions,
    submittedQuestions,
    evaluationResults,
    submitting,
    submitError,
    activeEvaluation,
    setActiveEvaluation,
    itemEvaluations = {},
    toggleBookmark,
    saveRecordingResponse,
    handleSubmitQuestion
  } = useSpeakingPractice({
    activePart: selectedPart,
    practiceMode: currentMode,
    topicParam,
    coreParam,
    moduleParam
  });

  const safeData = useMemo(() => Array.isArray(adaptedData) ? adaptedData : [], [adaptedData]);
  const safeMarked = markedQuestions || {};
  const safeSubmitted = submittedQuestions || {};
  const safeEval = evaluationResults || {};
  const safeItemEvaluations = itemEvaluations || {};

  const [activeNavIdx, setActiveNavIdx] = useState(currentTopicIdx);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    setActiveNavIdx(currentTopicIdx);
  }, [currentTopicIdx]);

  const handleTopicChange = (idx) => {
    isNavigatingRef.current = true;
    setActiveNavIdx(idx);

    const cardEl = document.getElementById(`speaking-topic-card-${idx}`) || document.getElementById(`speaking-q-${idx}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const params = new URLSearchParams(window.location.search);
    const targetModule = safeData[idx];
    if (targetModule && targetModule.moduleKey) {
      params.set('module', targetModule.moduleKey);
    }
    params.set('topic', (idx + 1).toString());
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);

    setTimeout(() => { isNavigatingRef.current = false; }, 600);
  };

  const handlePartSelect = (pId) => {
    navigate(`/speaking/part-${pId}?mode=${currentMode}`);
  };

  const activeTopicItem = useMemo(() => {
    if (!safeData || safeData.length === 0) return null;
    return safeData[Math.min(activeNavIdx, safeData.length - 1)] || null;
  }, [safeData, activeNavIdx]);

  // ScrollSpy: Update activeNavIdx locally on scroll with ZERO screen flickering
  useEffect(() => {
    if (loading || !safeData || safeData.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isNavigatingRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idxAttr = entry.target.getAttribute('data-scroll-index');
            if (idxAttr !== null) {
              const idx = parseInt(idxAttr, 10);
              if (!isNaN(idx)) {
                setActiveNavIdx(idx);
                const params = new URLSearchParams(window.location.search);
                params.set('topic', (idx + 1).toString());
                window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
              }
            }
          }
        });
      },
      { rootMargin: '-20% 0px -50% 0px', threshold: 0.2 }
    );

    const elements = document.querySelectorAll('[data-scroll-index]');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [loading, adaptedData, selectedPart, currentMode]);

  const currentReturnUrl = encodeURIComponent(window.location.pathname + window.location.search);

  return (
    <div className={`min-h-screen pb-12 transition-colors ${isDarkMode ? 'bg-[#090d16] text-slate-100' : 'bg-[#f4f7fc] text-[#0f172a]'}`}>
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* SPEAKING PRACTICE Banner */}
        <div>
          <span className="text-xs font-extrabold text-[#2563eb] tracking-wider uppercase block">
            SPEAKING PRACTICE
          </span>
        </div>

        {/* PartSelector & PracticeModeSelector */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1">
            <PartSelector
              parts={speakingParts}
              selectedPart={String(selectedPart)}
              onSelectPart={handlePartSelect}
              isDarkMode={isDarkMode}
            />
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <PracticeModeSelector
              selectedPart={String(selectedPart)}
              selectedMode={currentMode}
              onSelectMode={(mVal) => {
                const params = new URLSearchParams(searchParams);
                params.set('mode', mVal);
                if (selectedPart === 4 && mVal === 'core' && !params.get('core')) {
                  params.set('core', 'speaking-p4-core1');
                }
                setSearchParams(params);
              }}
              hasTopics={true}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        {/* Core Story Tabs when in Part 4 & mode = 'core' */}
        {selectedPart === 4 && currentMode === 'core' && coreStories && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {coreStories.map((cs) => {
              const isSelected = (coreParam || 'speaking-p4-core1') === cs.key;
              return (
                <button
                  key={cs.key}
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set('mode', 'core');
                    params.set('core', cs.key);
                    params.set('topic', '1');
                    setSearchParams(params);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all border ${isSelected
                    ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-sm'
                    : isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  Core {cs.coreNumber}: {cs.name.replace(/^CORE STORY \d+\s*–\s*/i, '')}
                </button>
              );
            })}
          </div>
        )}

        {/* State 1: Auth Loading */}
        {authStatus === 'loading' && (
          <div className={`p-12 rounded-2xl border text-center space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
            }`}>
            <RefreshCw className="w-8 h-8 text-[#2563eb] animate-spin mx-auto" />
            <p className="text-sm font-bold">Verifying authentication status...</p>
          </div>
        )}

        {/* State 2: Unauthenticated Prompt */}
        {authStatus === 'unauthenticated' && (
          <div className={`p-10 md:p-14 rounded-2xl border text-center space-y-5 shadow-lg ${isDarkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-extrabold tracking-tight">Authentication Required</h3>
              <p className="text-xs leading-relaxed" style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                Supabase Row Level Security (RLS) requires an authenticated user session to access Aptis Speaking practice questions. Please sign in to continue.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <Link
                to={`/login?redirectTo=${currentReturnUrl}`}
                className="px-6 py-3 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-blue-500/20 inline-flex items-center gap-2 transition-transform hover:scale-[1.02]"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Create Account</span>
              </Link>
            </div>
          </div>
        )}

        {/* State 3: Loading Data */}
        {authStatus === 'authenticated' && loading && (
          <div className={`p-12 rounded-2xl border text-center space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
            }`}>
            <RefreshCw className="w-8 h-8 text-[#2563eb] animate-spin mx-auto" />
            <p className="text-sm font-bold">Loading Speaking Part {selectedPart} data from Supabase...</p>
          </div>
        )}

        {/* State 4: Error State (No mock fallback!) */}
        {authStatus === 'authenticated' && !loading && error && (
          <div className={`p-8 rounded-2xl border text-center space-y-4 ${isDarkMode ? 'bg-rose-950/30 border-rose-800/50 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-extrabold">Failed to load Speaking questions</h3>
            <p className="text-xs max-w-lg mx-auto leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* State 5: Database Really Has 0 Rows */}
        {authStatus === 'authenticated' && !loading && !error && isEmpty && (
          <div className={`p-12 rounded-2xl border text-center space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
            }`}>
            <Database className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-base font-extrabold">No questions found</h3>
            <p className="text-xs">No practice questions exist for Speaking Part {selectedPart} in database.</p>
          </div>
        )}

        {/* Main Content Area */}
        {authStatus === 'authenticated' && !loading && !error && !isEmpty && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left Content Area */}
            <div id="speaking-main-content" className="flex-1 w-full space-y-6 scroll-mt-24">

              {/* ── PART 1 FULL MODE ── */}
              {selectedPart === 1 && currentMode !== 'topic' && (
                <Part1PersonalInfo
                  questions={safeData}
                  activeIdx={activeNavIdx}
                  isDarkMode={isDarkMode}
                  markedQs={safeMarked}
                  onMark={toggleBookmark}
                  submittedQs={safeSubmitted}
                  evaluationResults={safeEval}
                  itemEvaluations={safeItemEvaluations}
                  savedResponses={userRecordings}
                  onSaveResponse={saveRecordingResponse}
                  onSubmitQuestion={handleSubmitQuestion}
                />
              )}

              {/* ── PART 1 TOPIC MODE ── */}
              {selectedPart === 1 && currentMode === 'topic' && (
                <div className="space-y-8">
                  {safeData.map((topicItem, setIdx) => (
                    <div key={topicItem.id || setIdx} id={`speaking-topic-card-${setIdx}`} data-scroll-index={setIdx} className="scroll-mt-24">
                      <div className={`rounded-2xl border p-6 sm:p-7 shadow-xs space-y-4 ${isDarkMode ? 'bg-[#0f172a] border-slate-800 text-slate-100' : 'bg-white border-slate-200/80 text-[#0f172a] shadow-xs'}`}>
                        <h3 className="text-sm font-extrabold text-[#2563eb] tracking-wider uppercase mb-2">
                          {topicItem.topicName}
                        </h3>
                        <div className="space-y-3">
                          {(topicItem.questions || []).map((q, qIdx) => (
                            <Part1Card
                              key={q.id || qIdx}
                              q={q}
                              isDarkMode={isDarkMode}
                              isOpen={true}
                              onToggle={() => { }}
                              total={topicItem.questions.length}
                              isSubmitted={!!safeSubmitted[q.id]}
                              serverSolution={safeEval[q.id]}
                              itemEvaluation={safeItemEvaluations[q.id]}
                              isMarked={!!safeMarked[q.id]}
                              onMark={() => toggleBookmark(q.id)}
                              savedResponse={userRecordings[q.id]}
                              onSaveResponse={saveRecordingResponse}
                              onSubmitQuestion={handleSubmitQuestion}
                            />
                          ))}
                        </div>
                        <div className={`pt-4 border-t flex items-center justify-between gap-3 flex-wrap ${isDarkMode ? 'border-slate-800' : 'border-slate-200/80'}`}>
                          <BookmarkButton
                            isBookmarked={!!safeMarked[topicItem.id]}
                            onToggle={() => toggleBookmark(topicItem.id)}
                            label="Mark Topic"
                            isDarkMode={isDarkMode}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── PART 2 ── */}
              {selectedPart === 2 && (
                <div className="space-y-8">
                  {safeData.map((topicItem, setIdx) => (
                    <div key={topicItem.id || setIdx} id={`speaking-topic-card-${setIdx}`} data-scroll-index={setIdx} className="scroll-mt-24">
                      <Part2DescribePhoto
                        topic={topicItem}
                        isDarkMode={isDarkMode}
                        markedQs={safeMarked}
                        onMark={toggleBookmark}
                        submittedQs={safeSubmitted}
                        evaluationResults={safeEval}
                        itemEvaluations={safeItemEvaluations}
                        savedResponses={userRecordings}
                        onSaveResponse={saveRecordingResponse}
                        onSubmitQuestion={handleSubmitQuestion}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ── PART 3 ── */}
              {selectedPart === 3 && (
                <div className="space-y-8">
                  {safeData.map((topicItem, setIdx) => (
                    <div key={topicItem.id || setIdx} id={`speaking-topic-card-${setIdx}`} data-scroll-index={setIdx} className="scroll-mt-24">
                      <Part3ComparePhotos
                        topic={topicItem}
                        isDarkMode={isDarkMode}
                        markedQs={safeMarked}
                        onMark={toggleBookmark}
                        submittedQs={safeSubmitted}
                        evaluationResults={safeEval}
                        itemEvaluations={safeItemEvaluations}
                        savedResponses={userRecordings}
                        onSaveResponse={saveRecordingResponse}
                        onSubmitQuestion={handleSubmitQuestion}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ── PART 4 ── */}
              {selectedPart === 4 && (
                <div className="space-y-8">
                  {safeData.map((topicItem, setIdx) => (
                    <div key={topicItem.id || setIdx} id={`speaking-topic-card-${setIdx}`} data-scroll-index={setIdx} className="scroll-mt-24">
                      <Part4AbstractTopic
                        topic={topicItem}
                        isDarkMode={isDarkMode}
                        markedQs={safeMarked}
                        onMark={toggleBookmark}
                        submittedQs={safeSubmitted}
                        evaluationResults={safeEval}
                        itemEvaluations={safeItemEvaluations}
                        savedResponses={userRecordings}
                        onSaveResponse={saveRecordingResponse}
                        onSubmitQuestion={handleSubmitQuestion}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Topic Navigation Bar (< and >) */}
              {safeData.length > 1 && (
                <div className="flex items-center justify-between pt-4 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeNavIdx > 0) {
                        handleTopicChange(activeNavIdx - 1);
                      }
                    }}
                    disabled={activeNavIdx <= 0}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${activeNavIdx > 0
                      ? isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs'
                      : 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <span className="text-xs font-extrabold" style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                    {activeTopicItem?.topicName || activeTopicItem?.moduleName || 'Module'} ({activeNavIdx + 1} / {safeData.length})
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeNavIdx < safeData.length - 1) {
                        handleTopicChange(activeNavIdx + 1);
                      }
                    }}
                    disabled={activeNavIdx >= safeData.length - 1}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${activeNavIdx < safeData.length - 1
                      ? isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs'
                      : 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}

            </div>

            {/* Right Sidebar Navigator */}
            <SpeakingNavigator
              selectedPart={selectedPart}
              currentMode={currentMode}
              currentTopicIdx={activeNavIdx}
              onSelectTopicIdx={handleTopicChange}
              items={safeData}
              markedQs={safeMarked}
              submittedQs={safeSubmitted}
              isDarkMode={isDarkMode}
            />

          </div>
        )}

      </div>
    </div>
  );
}

export default SpeakingPractice;

