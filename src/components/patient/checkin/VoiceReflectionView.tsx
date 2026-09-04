/**
 * STILL-care Voice Reflection View
 *
 * Frontend simulation of a spoken check-in experience.
 * - Does NOT access the browser microphone
 * - Does NOT make speech recognition or Whisper calls
 * - Provides realistic states: Ready -> Recording -> Review & Transcript Preview -> Submit
 * - Patient can review and edit the transcript directly
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Edit3
} from 'lucide-react';

const DEFAULT_MOCK_TRANSCRIPT =
  "Over the past few days, the workload has been feeling heavier than usual. I find myself staying awake late thinking through upcoming tasks, and it's taking more energy to start the day. But I had a good conversation with a friend yesterday which helped a bit.";

interface VoiceReflectionViewProps {
  prompt: string;
  onSubmit: (content: string) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

type VoiceState = 'ready' | 'recording' | 'review';

export function VoiceReflectionView({
  prompt,
  onSubmit,
  onBack,
  isSubmitting
}: VoiceReflectionViewProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('ready');
  const [seconds, setSeconds] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>(DEFAULT_MOCK_TRANSCRIPT);
  const [isPlayingMockAudio, setIsPlayingMockAudio] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);

  // Recording timer
  useEffect(() => {
    if (voiceState === 'recording') {
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [voiceState]);

  // Mock audio playback timer
  useEffect(() => {
    if (isPlayingMockAudio) {
      playbackRef.current = setInterval(() => {
        setPlaybackProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingMockAudio(false);
            return 0;
          }
          return prev + 5;
        });
      }, 250);
    } else {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
    }

    return () => {
      if (playbackRef.current) clearInterval(playbackRef.current);
    };
  }, [isPlayingMockAudio]);

  const handleStartRecording = () => {
    setVoiceState('recording');
  };

  const handleStopRecording = () => {
    setVoiceState('review');
    setPlaybackProgress(0);
    setIsPlayingMockAudio(false);
  };

  const handleRetake = () => {
    setIsPlayingMockAudio(false);
    setPlaybackProgress(0);
    setSeconds(0);
    setVoiceState('ready');
  };

  const toggleMockPlayback = () => {
    if (isPlayingMockAudio) {
      setIsPlayingMockAudio(false);
    } else {
      if (playbackProgress >= 100) {
        setPlaybackProgress(0);
      }
      setIsPlayingMockAudio(true);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBack = () => {
    if (voiceState === 'recording' || (voiceState === 'review' && transcript.trim())) {
      const confirmLeave = window.confirm(
        'You have an active recording in progress. Are you sure you want to go back? Your recording will be discarded.'
      );
      if (!confirmLeave) return;
    }
    onBack();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Guiding Prompt Header */}
      <div className="bg-paper-grey/60 border border-charcoal/10 rounded-lg p-5 space-y-1.5">
        <span className="text-[11px] font-semibold text-charcoal/60 uppercase tracking-wider">
          Guiding Prompt
        </span>
        <p className="font-serif text-lg text-charcoal leading-snug">
          "{prompt}"
        </p>
        <p className="text-xs text-charcoal/60">
          Speak naturally in your own time.
        </p>
      </div>

      {/* Main Interactive Stage */}
      <div className="bg-bone border border-charcoal/15 rounded-lg p-6 sm:p-8 space-y-6 text-center">
        {/* 1. READY STATE */}
        {voiceState === 'ready' && (
          <div className="space-y-6 py-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-paper-grey border border-charcoal/15 flex items-center justify-center text-slate-teal shadow-inner">
              <Mic className="w-8 h-8" aria-hidden="true" />
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="font-serif text-xl text-charcoal font-medium">
                Take your time. Start when you're ready.
              </h2>
              <p className="text-xs text-charcoal/70 leading-relaxed">
                When you tap start, the demo simulation will begin recording. You can pause or stop whenever you have shared what you would like.
              </p>
              <p className="text-[11px] text-charcoal/50 pt-1">
                Frontend simulation &middot; No actual audio is recorded or stored
              </p>
            </div>

            <div>
              <button
                type="button"
                id="start-voice-recording-button"
                onClick={handleStartRecording}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-charcoal text-bone hover:bg-charcoal/90 text-sm font-medium transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[48px]"
              >
                <Mic className="w-4 h-4" aria-hidden="true" />
                <span>Start recording</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. RECORDING STATE */}
        {voiceState === 'recording' && (
          <div className="space-y-6 py-4" aria-live="polite">
            <div className="space-y-3">
              {/* Accessible status banner */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-terracotta/10 border border-terracotta/20 text-terracotta text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-terracotta animate-pulse" />
                <span>Recording in progress</span>
              </div>

              {/* Animated visual waveform bars (peaceful, non-distracting) */}
              <div
                className="flex items-center justify-center gap-1.5 h-12 py-2"
                aria-hidden="true"
              >
                <div className="w-1 bg-slate-teal/70 rounded-full animate-[pulse_1.2s_ease-in-out_infinite] h-4" />
                <div className="w-1 bg-slate-teal/80 rounded-full animate-[pulse_0.8s_ease-in-out_infinite_0.1s] h-8" />
                <div className="w-1 bg-slate-teal rounded-full animate-[pulse_1.0s_ease-in-out_infinite_0.2s] h-11" />
                <div className="w-1 bg-slate-teal/90 rounded-full animate-[pulse_0.9s_ease-in-out_infinite_0.15s] h-6" />
                <div className="w-1 bg-slate-teal/80 rounded-full animate-[pulse_1.1s_ease-in-out_infinite_0.3s] h-10" />
                <div className="w-1 bg-slate-teal/70 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.25s] h-5" />
              </div>

              {/* Elapsed time */}
              <div className="font-mono text-2xl font-semibold text-charcoal">
                {formatTime(seconds)}
              </div>

              <p className="text-xs text-charcoal/60">
                Speaking at your own pace...
              </p>
            </div>

            <div>
              <button
                type="button"
                id="stop-voice-recording-button"
                onClick={handleStopRecording}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-charcoal text-bone hover:bg-charcoal/90 text-sm font-medium transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[48px]"
              >
                <Square className="w-4 h-4 fill-bone" aria-hidden="true" />
                <span>Stop recording</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. REVIEW & TRANSCRIPT PREVIEW STATE */}
        {voiceState === 'review' && (
          <div className="space-y-6 text-left">
            {/* Playback review bar */}
            <div className="p-4 bg-paper-grey/70 border border-charcoal/15 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-charcoal">
                  Recorded reflection ({formatTime(seconds || 24)})
                </span>
                <button
                  type="button"
                  id="retake-recording-button"
                  onClick={handleRetake}
                  className="inline-flex items-center gap-1.5 text-xs text-charcoal/70 hover:text-charcoal font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Retake</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="toggle-playback-button"
                  onClick={toggleMockPlayback}
                  aria-label={isPlayingMockAudio ? 'Pause playback' : 'Play recorded audio'}
                  className="w-9 h-9 rounded-full bg-charcoal text-bone flex items-center justify-center hover:bg-charcoal/90 transition-colors shrink-0"
                >
                  {isPlayingMockAudio ? (
                    <Pause className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5 fill-bone" aria-hidden="true" />
                  )}
                </button>

                <div className="flex-1 bg-charcoal/15 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-teal h-full transition-all duration-200"
                    style={{ width: `${playbackProgress}%` }}
                  />
                </div>

                <span className="font-mono text-xs text-charcoal/70">
                  {isPlayingMockAudio ? `${Math.round(playbackProgress)}%` : formatTime(seconds || 24)}
                </span>
              </div>
            </div>

            {/* Transcript Preview Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal uppercase tracking-wider">
                  <Edit3 className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
                  <span>Transcript preview</span>
                </div>
                <span className="text-[11px] text-charcoal/60">
                  Review & edit before submitting
                </span>
              </div>

              <p className="text-xs text-charcoal/70 leading-relaxed">
                This simulated transcription shows what you shared. You can edit any sentence below to ensure it accurately reflects your thoughts.
              </p>

              <label htmlFor="voice-transcript-input" className="sr-only">
                Transcript text
              </label>
              <textarea
                id="voice-transcript-input"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={6}
                disabled={isSubmitting}
                className="w-full p-4 rounded-lg bg-bone border border-charcoal/20 text-charcoal text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-charcoal/30 focus:border-charcoal resize-y"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <button
          type="button"
          id="voice-back-button"
          onClick={handleBack}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-charcoal/20 bg-bone hover:bg-paper-grey text-charcoal text-xs font-medium transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to options</span>
        </button>

        {voiceState === 'review' && (
          <button
            type="button"
            id="submit-voice-reflection"
            onClick={() => onSubmit(transcript)}
            disabled={transcript.trim().length === 0 || isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-charcoal text-bone hover:bg-charcoal/90 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm min-h-[44px]"
          >
            {isSubmitting ? (
              <span>Recording check-in...</span>
            ) : (
              <>
                <span>Submit reflection</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Discreet Privacy Note */}
      <div className="p-3.5 bg-paper-grey/40 border border-charcoal/10 rounded text-[11px] text-charcoal/70 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-moss shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          Your supervisor receives high-level themes and relevant summaries rather than your full conversation transcript.
        </p>
      </div>
    </div>
  );
}
