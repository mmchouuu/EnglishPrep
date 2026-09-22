import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Eye, 
  EyeOff, 
  FileText,
  Mic
} from 'lucide-react';
import {
  resolveWebSpeechVoice,
  registerActiveAudio,
  registerActiveSpeech,
  stopGlobalAudio,
  parseDialogueTurns
} from '../../services/listeningAudioProvider.js';

export function renderFormattedTranscript(text = '', isDarkMode = false) {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text
    .replace(/^Question:\s*/gi, '')
    .replace(/^Transcript:\s*/gi, '')
    .replace(/\bTranscript:\s*/gi, '\n')
    .trim();

  // 1. Strip all Segment headers completely (e.g. **Segment 1 ??? ...**, Segment 1 —, etc.)
  cleaned = cleaned.replace(/(?:\*\*)?\s*Segment\s*\d+[\s\S]*?(?:\*\*|\r?\n|$)/gi, '');

  // 2. Insert newlines before any speaker label (Person A:, Person B:, Man:, Friend:, Ahmed:, Rose:, etc.)
  cleaned = cleaned.replace(/(?<=\S)\s+(?=\b(?:Person\s+[A-D]|Man|Woman|Friend|Sister|Brother|Mother|Father|Customer|Clerk|Receptionist|Assistant|Officer|Doctor|Patient|Teacher|Student|Speaker\s*\d*|W|M|[A-Z][a-zA-Z0-9_\s]{0,20}):\s*)/gi, '\n');

  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  return (
    <div className="space-y-3.5 font-medium leading-relaxed font-sans text-sm">
      {lines.map((line, idx) => {
        // Match speaker label prefix at start of line (including names like Ahmed, Rose, etc.)
        const match = line.match(/^((?:Person\s+[A-D]|Man|Woman|Friend|Sister|Brother|Mother|Father|Customer|Clerk|Receptionist|Assistant|Officer|Doctor|Patient|Teacher|Student|Speaker\s*\d*|W|M|[A-Z][a-zA-Z0-9_]{1,20})):?\s*(.*)$/i);

        if (match) {
          const rawLabel = match[1].trim();
          const content = match[2].trim();
          return (
            <p key={idx} className="leading-relaxed">
              <strong className={`font-black tracking-wide ${isDarkMode ? 'text-blue-400' : 'text-[#2563eb]'}`}>
                {rawLabel}:
              </strong>{' '}
              <span>{content}</span>
            </p>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export const AudioPlayer = ({ 
  audioUrl, 
  audioContent,
  requestedVoiceProfile = 'en-GB-female',
  partNumber = 1,
  transcript, 
  explanation, 
  translation,
  maxReplays = 999, 
  isDarkMode = false,
  allowTranscriptBeforeSubmit = false,
  isSubmitted = false
}) => {
  const audioRef = useRef(null);
  const progressTimerRef = useRef(null);
  const isPlayingRef = useRef(false);
  const turnsQueueRef = useRef([]);
  const currentTurnIdxRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Web Speech API states
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isUsingTts, setIsUsingTts] = useState(false);
  const [actualVoiceUsed, setActualVoiceUsed] = useState('Default Voice');

  const stopProgressTicker = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const startProgressTicker = (estimatedSeconds) => {
    stopProgressTicker();
    setDuration(estimatedSeconds);
    setCurrentTime(0);

    const startTime = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000) * playbackRate;
      if (elapsed >= estimatedSeconds) {
        stopProgressTicker();
        setCurrentTime(estimatedSeconds);
      } else {
        setCurrentTime(elapsed);
      }
    }, 100);
  };

  // 1. Detect Speech Synthesis voices
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices() || [];
        setAvailableVoices(voices);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  // 2. Unmount Cleanup
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      stopProgressTicker();
      stopGlobalAudio();
    };
  }, []);

  // 3. Reset player on audio source/profile change
  useEffect(() => {
    isPlayingRef.current = false;
    stopProgressTicker();
    stopGlobalAudio();
    setIsPlaying(false);
    setCurrentTime(0);
    setHasError(false);

    if (audioUrl && typeof audioUrl === 'string' && audioUrl.trim().length > 0) {
      setIsUsingTts(false);
      if (audioRef.current) {
        audioRef.current.load();
      }
    } else {
      setIsUsingTts(true);
      const res = resolveWebSpeechVoice(requestedVoiceProfile, availableVoices);
      setActualVoiceUsed(res.actualVoiceUsed);
    }
  }, [audioUrl, audioContent, requestedVoiceProfile]);

  const togglePlay = () => {
    if (isPlaying) {
      isPlayingRef.current = false;
      stopProgressTicker();
      stopGlobalAudio();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {}
    }

    if (audioUrl && typeof audioUrl === 'string' && audioUrl.trim().length > 0 && audioRef.current) {
      registerActiveAudio(audioRef.current);
      audioRef.current.play()
        .then(() => {
          isPlayingRef.current = true;
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(err => {
          console.warn("HTML5 audio file play error, switching to Web Speech API fallback:", err);
          setIsUsingTts(true);
          setIsLoading(false);
          playWebSpeechTts();
        });
      return;
    }

    playWebSpeechTts();
  };

  const playWebSpeechTts = () => {
    stopProgressTicker();
    
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }

    const textToSpeak = (audioContent || transcript || "Listening passage text audio player fallback.").trim();
    if (!textToSpeak) {
      setIsLoading(false);
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    const turns = parseDialogueTurns(textToSpeak, requestedVoiceProfile, partNumber);
    if (turns.length === 0) {
      setIsLoading(false);
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    const fullLength = turns.reduce((sum, t) => sum + t.textToSpeak.length, 0);
    const estimatedDuration = Math.max(4, Math.ceil(fullLength / 11));

    turnsQueueRef.current = turns;
    currentTurnIdxRef.current = 0;
    isPlayingRef.current = true;

    setIsPlaying(true);
    setIsLoading(false);
    startProgressTicker(estimatedDuration);

    playTurnSequence();
  };

  const playTurnSequence = () => {
    if (!isPlayingRef.current) return;

    if (currentTurnIdxRef.current >= turnsQueueRef.current.length) {
      stopProgressTicker();
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentTime(0);
      setReplayCount(prev => prev + 1);
      return;
    }

    const turn = turnsQueueRef.current[currentTurnIdxRef.current];

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {}

      const utterance = new SpeechSynthesisUtterance(turn.textToSpeak);

      const freshVoices = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || availableVoices || [];
      const voiceRes = resolveWebSpeechVoice(turn.voiceProfile, freshVoices);

      if (voiceRes && voiceRes.voice) {
        try {
          utterance.voice = voiceRes.voice;
        } catch (err) {}
      }
      setActualVoiceUsed(voiceRes?.actualVoiceUsed || turn.voiceProfile);

      utterance.pitch = turn.pitch || 1.0;
      utterance.rate = (turn.rate || 1.0) * (playbackRate || 1.0);
      utterance.volume = isMuted ? 0 : (volume ?? 1);

      utterance.onstart = () => {
        registerActiveSpeech(utterance);
      };

      utterance.onend = () => {
        if (!isPlayingRef.current) return;
        currentTurnIdxRef.current += 1;
        playTurnSequence();
      };

      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis utterance error:", e);
        if (!isPlayingRef.current) return;
        currentTurnIdxRef.current += 1;
        playTurnSequence();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("SpeechSynthesis speak error:", err);
      }
    }
  };

  // HTML5 audio event handlers
  const handleTimeUpdate = () => {
    if (!isUsingTts && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (!isUsingTts && audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setReplayCount(prev => prev + 1);
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (!isUsingTts && audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleRateChange = (newRate) => {
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
    if (isPlayingRef.current && isUsingTts) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
        setTimeout(() => {
          if (isPlayingRef.current) {
            playTurnSequence();
          }
        }, 50);
      }
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (!isUsingTts && audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const canShowTranscript = allowTranscriptBeforeSubmit || isSubmitted;

  return (
    <div className={`rounded-xl border p-4 sm:p-5 transition-all shadow-xs ${
      isDarkMode 
        ? 'bg-slate-900/90 border-slate-800 text-slate-100' 
        : 'bg-white border-slate-200/90 text-slate-800'
    }`}>
      {/* HTML5 Audio Element (Hidden) */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={() => {
            console.warn("Audio load error, fallback to TTS");
            setIsUsingTts(true);
          }}
        />
      )}

      {/* Main Control Panel */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Play/Pause Button & Engine Badge */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={isLoading || (maxReplays && replayCount >= maxReplays && !isPlaying)}
            className={`w-12 h-12 rounded-2xl font-bold flex items-center justify-center transition-all shadow-sm ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                : maxReplays && replayCount >= maxReplays
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-blue-500/20'
            }`}
            title={isPlaying ? "Pause audio" : "Play audio"}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wide uppercase">
                {isUsingTts ? 'Web Speech Engine' : 'Audio Track'}
              </span>
              {isUsingTts && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <Mic className="w-3 h-3" /> multi-voice
                </span>
              )}
            </div>

            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {isUsingTts ? actualVoiceUsed : (audioUrl ? 'Source File' : 'Speech Synthesizer')}
            </div>
          </div>
        </div>

        {/* Progress Bar & Time */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-10 text-right shrink-0">
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            disabled={isUsingTts}
            className="flex-1 h-2 rounded-lg bg-slate-200 dark:bg-slate-800 accent-[#2563eb] cursor-pointer"
          />

          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-10 shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {/* Action Controls: Speed, Mute, Transcript Toggle */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          {/* Speed Selector */}
          <div className={`flex items-center rounded-xl border p-0.5 text-xs font-bold ${
            isDarkMode 
              ? 'bg-slate-800 border-slate-700 text-slate-200' 
              : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            {[0.8, 1, 1.2].map((rate) => (
              <button
                key={rate}
                onClick={() => handleRateChange(rate)}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                  playbackRate === rate
                    ? 'bg-[#2563eb] text-white font-extrabold shadow-2xs'
                    : isDarkMode
                      ? 'text-slate-400 hover:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-xl border transition-colors ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Transcript Toggle Button (ALWAYS visible when transcript exists) */}
          {transcript && (
            <button
              onClick={() => setShowTranscript(prev => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-extrabold transition-all shadow-2xs ${
                showTranscript
                  ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-blue-500/20'
                  : isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-750'
                    : 'bg-blue-50 border-blue-200 text-[#2563eb] hover:bg-blue-100'
              }`}
            >
              {showTranscript ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showTranscript ? 'Hide transcript' : 'Show transcript'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Audio Transcript Box */}
      {showTranscript && transcript && (
        <div className={`mt-4 p-4.5 rounded-2xl border text-xs leading-relaxed space-y-3 animate-in fade-in slide-in-from-top-2 shadow-2xs ${
          isDarkMode 
            ? 'bg-slate-950 border-slate-800 text-slate-200' 
            : 'bg-blue-50/40 border-blue-100 text-slate-900'
        }`}>
          <div className="flex items-center justify-between border-b border-blue-200/50 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2 font-black text-[#2563eb] dark:text-blue-400">
              <FileText className="w-4 h-4" />
              <span>Audio Transcript (Word Comments Source)</span>
            </div>
          </div>

          {renderFormattedTranscript(transcript, isDarkMode)}

          {translation && (
            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <strong className="text-[#2563eb] dark:text-blue-400 font-bold">Bản dịch tiếng Việt:</strong>
              <p className="mt-1">{translation}</p>
            </div>
          )}

          {explanation && (
            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <strong className="text-[#2563eb] dark:text-blue-400 font-bold">Giải thích chi tiết:</strong>
              <p className="mt-1">{explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
