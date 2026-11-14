import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Zap,
  Send,
  Radio,
  ShieldAlert,
  Languages,
} from 'lucide-react';
import type { LanguageMode, VoiceProfile } from '../types/brahma';

interface LiveVoiceStudioProps {
  languageMode: LanguageMode;
  setLanguageMode: (lang: LanguageMode) => void;
  voiceProfile: VoiceProfile;
  setVoiceProfile: (vp: VoiceProfile) => void;
  continuousListening: boolean;
  setContinuousListening: (v: boolean) => void;
  onSendMessage: (text: string) => Promise<string>;
  onSpeakDeepVoice: (
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onLevel?: (lvl: number) => void
  ) => Promise<void>;
  onStopSpeaking: () => void;
  onVoiceLevel?: (lvl: number) => void;
}

type VoiceEngineState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'INTERRUPTED';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const LiveVoiceStudio: React.FC<LiveVoiceStudioProps> = ({
  languageMode,
  setLanguageMode,
  voiceProfile,
  setVoiceProfile,
  continuousListening,
  setContinuousListening,
  onSendMessage,
  onSpeakDeepVoice,
  onStopSpeaking,
  onVoiceLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [voiceState, setVoiceState] = useState<VoiceEngineState>('IDLE');
  const [micActive, setMicActive] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [wakeWordOnly, setWakeWordOnly] = useState(false);
  const [userTranscript, setUserTranscript] = useState(
    'কন্টিনিউয়াস লিসেনিং চালু করুন — বাংলা, হিন্দি বা যেকোনো ভাষায় সরাসরি কথা বলুন...'
  );
  const [aiSubtitle, setAiSubtitle] = useState('ব্রহ্মা ডিপ ভয়েস ইঞ্জিন প্রস্তুত।');
  const [manualText, setManualText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  const stateRef = useRef<VoiceEngineState>('IDLE');
  const userLevelRef = useRef(0.08);
  const aiLevelRef = useRef(0.05);
  const shockwaveRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafAudioRef = useRef<number>(0);
  const continuousRef = useRef(continuousListening);
  const isSpeakingRef = useRef(false);
  const micActiveRef = useRef(false);
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    stateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    continuousRef.current = continuousListening;
  }, [continuousListening]);

  useEffect(() => {
    micActiveRef.current = micActive;
  }, [micActive]);

  useEffect(() => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    if (!win.SpeechRecognition && !win.webkitSpeechRecognition) {
      setSpeechSupported(false);
    }
    return () => {
      stopMic();
      onStopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Organic Harmonic Fluid Orb Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let time = 0;
    let smoothedLevel = 0.08;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      animId = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2 - 42;
      ctx.clearRect(0, 0, width, height);

      time += 0.025;
      const st = stateRef.current;
      const targetLevel = st === 'SPEAKING' ? aiLevelRef.current : userLevelRef.current;
      smoothedLevel += (targetLevel - smoothedLevel) * 0.2;
      const baseRadius = Math.min(width, height) * 0.16 + smoothedLevel * 64;

      if (shockwaveRef.current > 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, shockwaveRef.current, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${Math.max(0, 1 - shockwaveRef.current / 260)})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        shockwaveRef.current += 7;
        if (shockwaveRef.current > 260) shockwaveRef.current = 0;
      }

      const points = 64;
      const numRings = 3;
      for (let ring = 0; ring < numRings; ring++) {
        ctx.beginPath();
        const ringOffset = ring * 12;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const harmonic1 = Math.sin(angle * 3 + time * (1.5 + ring * 0.5));
          const harmonic2 = Math.cos(angle * 5 - time * 2);
          const displacement = (harmonic1 + harmonic2) * (10 + smoothedLevel * 28);
          const r = baseRadius + displacement + ringOffset;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        let strokeColor = `rgba(0, 229, 255, ${0.45 - ring * 0.1})`;
        let fillColor = `rgba(0, 229, 255, ${0.06 - ring * 0.015})`;
        if (st === 'SPEAKING') {
          strokeColor = `rgba(244, 63, 94, ${0.55 - ring * 0.1})`;
          fillColor = `rgba(244, 63, 94, ${0.14 - ring * 0.03})`;
        } else if (st === 'THINKING') {
          strokeColor = `rgba(139, 92, 246, ${0.5 - ring * 0.1})`;
          fillColor = `rgba(139, 92, 246, ${0.09 - ring * 0.02})`;
        } else if (st === 'INTERRUPTED') {
          strokeColor = `rgba(245, 158, 11, ${0.5 - ring * 0.1})`;
          fillColor = `rgba(245, 158, 11, ${0.1 - ring * 0.03})`;
        }

        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      const coreGradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, baseRadius * 0.78);
      if (st === 'SPEAKING') {
        coreGradient.addColorStop(0, 'rgba(244, 63, 94, 0.8)');
        coreGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
      } else if (st === 'THINKING') {
        coreGradient.addColorStop(0, 'rgba(139, 92, 246, 0.75)');
        coreGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
      } else if (st === 'INTERRUPTED') {
        coreGradient.addColorStop(0, 'rgba(245, 158, 11, 0.7)');
        coreGradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
      } else {
        coreGradient.addColorStop(0, 'rgba(0, 229, 255, 0.65)');
        coreGradient.addColorStop(1, 'rgba(0, 229, 255, 0)');
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.fill();
    };

    render();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const getRecognitionLang = useCallback(() => {
    if (languageMode === 'bn') return 'bn-IN';
    if (languageMode === 'hi') return 'hi-IN';
    if (languageMode === 'en') return 'en-US';
    return 'bn-IN';
  }, [languageMode]);

  const spawnRecognition = useCallback(() => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!RecognitionCtor) return null;

    const rec = new RecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = getRecognitionLang();

    rec.onresult = (ev) => {
      if (isSpeakingRef.current) return;
      const last = ev.results[ev.results.length - 1];
      const txt = last[0].transcript.trim();
      if (!txt) return;
      setUserTranscript(txt);
      if (last.isFinal && txt !== lastTranscriptRef.current) {
        lastTranscriptRef.current = txt;
        setTimeout(() => {
          lastTranscriptRef.current = '';
        }, 1800);

        if (wakeWordOnly) {
          const lower = txt.toLowerCase();
          if (!/(brahma|ব্রহ্মা|ब्रह्मा|bramha)/.test(lower)) {
            return;
          }
        }
        handleVoicePrompt(txt);
      }
    };

    rec.onerror = () => {
      // Auto-recovered in onend when continuous mode is active
    };

    rec.onend = () => {
      if (continuousRef.current && micActiveRef.current && !isSpeakingRef.current) {
        window.setTimeout(() => {
          try {
            rec.lang = getRecognitionLang();
            rec.start();
          } catch {
            // ignore restart race
          }
        }, 250);
      }
    };

    return rec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getRecognitionLang, wakeWordOnly]);

  const handleVoicePrompt = async (spoken: string) => {
    const clean = spoken.trim();
    if (!clean) return;
    setUserTranscript(clean);
    setVoiceState('THINKING');
    setAiSubtitle('নিউরাল কোর বিশ্লেষণ করছে...');
    navigator.vibrate?.(18);

    try {
      const reply = await onSendMessage(clean);
      setAiSubtitle(reply);

      if (ttsEnabled) {
        isSpeakingRef.current = true;
        try {
          recognitionRef.current?.stop();
        } catch {
          // ignore
        }

        await onSpeakDeepVoice(
          reply,
          () => setVoiceState('SPEAKING'),
          () => {
            isSpeakingRef.current = false;
            aiLevelRef.current = 0.05;
            if (continuousRef.current && micActiveRef.current) {
              setVoiceState('LISTENING');
              try {
                recognitionRef.current?.start();
              } catch {
                // ignore
              }
            } else {
              setVoiceState(micActiveRef.current ? 'LISTENING' : 'IDLE');
            }
          },
          (lvl) => {
            aiLevelRef.current = lvl;
          }
        );
      } else {
        setVoiceState(micActiveRef.current ? 'LISTENING' : 'IDLE');
      }
    } catch {
      isSpeakingRef.current = false;
      setAiSubtitle('ব্রহ্মা নিউরাল কোরের সাথে সংযোগ ব্যাহত হয়েছে।');
      setVoiceState('IDLE');
    }
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const src = audioCtx.createMediaStreamSource(stream);
      src.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const sampleLevel = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 180;
        const clamped = Math.min(1, Math.max(0.06, avg));
        userLevelRef.current = clamped;
        onVoiceLevel?.(clamped);
        rafAudioRef.current = requestAnimationFrame(sampleLevel);
      };
      sampleLevel();

      const rec = spawnRecognition();
      if (rec) {
        recognitionRef.current = rec;
        rec.start();
      }

      setMicActive(true);
      micActiveRef.current = true;
      setVoiceState('LISTENING');
      navigator.vibrate?.([25, 30]);
    } catch {
      setAiSubtitle('মাইক্রোফোন অনুমতি পাওয়া যায়নি। নিচের টেক্সট বক্স ব্যবহার করুন।');
      setMicActive(false);
    }
  };

  const stopMic = () => {
    cancelAnimationFrame(rafAudioRef.current);
    micActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    userLevelRef.current = 0.08;
    setMicActive(false);
    setVoiceState('IDLE');
  };

  const handleInterrupt = () => {
    onStopSpeaking();
    isSpeakingRef.current = false;
    shockwaveRef.current = 12;
    aiLevelRef.current = 0.05;
    setVoiceState('INTERRUPTED');
    setTimeout(() => {
      if (continuousRef.current && micActiveRef.current) {
        setVoiceState('LISTENING');
        try {
          recognitionRef.current?.start();
        } catch {
          // ignore
        }
      } else {
        setVoiceState(micActiveRef.current ? 'LISTENING' : 'IDLE');
      }
    }, 650);
  };

  const stateBadgeColor =
    voiceState === 'SPEAKING'
      ? 'text-rose-300 border-rose-500/40 bg-rose-500/15'
      : voiceState === 'THINKING'
        ? 'text-violet-300 border-violet-500/40 bg-violet-500/10'
        : voiceState === 'INTERRUPTED'
          ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
          : 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10';

  return (
    <div className="relative w-full h-full flex flex-col bg-[#060709] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(244,63,94,0.08) 0%, transparent 55%), radial-gradient(circle at 80% 20%, rgba(0,229,255,0.08) 0%, transparent 50%)',
        }}
      />

      {/* Top Voice & Language Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-3 py-1 rounded-full border text-xs font-semibold tracking-wider ${stateBadgeColor}`}>
            {voiceState}
          </span>

          <button
            type="button"
            onClick={() => setContinuousListening(!continuousListening)}
            className={`px-3 py-1 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition ${
              continuousListening
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${continuousListening ? 'animate-pulse' : ''}`} />
            <span>{continuousListening ? 'Continuous Listening ON' : 'Continuous OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setWakeWordOnly((v) => !v)}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium cursor-pointer ${
              wakeWordOnly
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            {wakeWordOnly ? 'Wake Word: "Brahma"' : 'Direct Voice'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={languageMode}
              onChange={(e) => setLanguageMode(e.target.value as LanguageMode)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="bn" className="bg-[#07080b]">বাংলা (Pure Bengali)</option>
              <option value="hi" className="bg-[#07080b]">हिन्दी (Pure Hindi)</option>
              <option value="auto" className="bg-[#07080b]">Auto (BN / HI / EN)</option>
              <option value="en" className="bg-[#07080b]">English</option>
            </select>
          </div>

          <div className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <select
              value={voiceProfile}
              onChange={(e) => setVoiceProfile(e.target.value as VoiceProfile)}
              className="bg-transparent text-xs text-rose-200 focus:outline-none cursor-pointer"
            >
              <option value="deep-voinkor" className="bg-[#07080b]">Deep ভয়ঙ্কর Bass (Charon)</option>
              <option value="commanding" className="bg-[#07080b]">Commanding Baritone (Fenrir)</option>
              <option value="calm-deep" className="bg-[#07080b]">Calm Deep Bass</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setTtsEnabled((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 cursor-pointer"
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Organic Fluid Orb Canvas */}
      <div className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="w-full h-full block" />

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 space-y-2 text-center">
          <div className="bg-[#0d0f14]/85 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-cyan-400 mb-0.5">
              {speechSupported ? 'Continuous Voice Input' : 'Text Input Mode'}
            </div>
            <div className="text-xs sm:text-sm text-slate-200">{userTranscript}</div>
          </div>

          <div className="bg-[#07080b]/92 backdrop-blur-xl border border-rose-500/30 rounded-2xl px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-rose-400 mb-0.5">
              Brahma Deep Neural Voice ({languageMode.toUpperCase()})
            </div>
            <div className="text-xs sm:text-sm text-white max-h-24 overflow-y-auto whitespace-pre-wrap">
              {aiSubtitle}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 px-4 py-3 border-t border-white/10 bg-[#07080b]/95 backdrop-blur-xl flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={micActive ? stopMic : startMic}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider inline-flex items-center gap-2 transition cursor-pointer ${
            micActive
              ? 'bg-rose-500/25 border border-rose-400/60 text-rose-200 hover:bg-rose-500/35'
              : 'bg-cyan-400 text-[#020305] hover:bg-cyan-300'
          }`}
        >
          {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{micActive ? 'Stop Continuous Mic' : 'Start Continuous Listening'}</span>
        </button>

        <button
          type="button"
          onClick={handleInterrupt}
          className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Zap className="w-4 h-4" />
          <span>Interrupt</span>
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manualText.trim()) return;
            const txt = manualText;
            setManualText('');
            handleVoicePrompt(txt);
          }}
          className="flex-1 min-w-[220px] max-w-md flex items-center gap-2 bg-white/5 border border-white/15 rounded-xl px-3 py-1.5"
        >
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="বাংলা, हिन्दी বা ইংরেজিতে লিখুন..."
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
          />
          <button type="submit" className="text-cyan-400 hover:text-cyan-300 p-1 cursor-pointer">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
