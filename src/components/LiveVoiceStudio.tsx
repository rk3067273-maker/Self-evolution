import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Zap,
  Send,
  Radio,
  Languages,
  User,
} from 'lucide-react';
import type { LanguageMode, OrbState, VoiceGender, VoiceProfile } from '../types/brahma';
import {
  brahmaFetch,
  getApiBaseUrl,
  getVoiceOption,
  isNativeApkRuntime,
  VOICE_CATALOG,
} from '../lib/brahmaClient';

function float32ToPcm16Base64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function pcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const out = new Float32Array(len / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

interface LiveVoiceStudioProps {
  assistantName: string;
  languageMode: LanguageMode;
  setLanguageMode: (lang: LanguageMode) => void;
  voiceProfile: VoiceProfile;
  setVoiceProfile: (vp: VoiceProfile) => void;
  continuousListening: boolean;
  setContinuousListening: (v: boolean) => void;
  silentUntilUserSpeaks: boolean;
  onSendMessage: (text: string) => Promise<string>;
  onSpeakDeepVoice: (
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onLevel?: (lvl: number) => void
  ) => Promise<void>;
  onStopSpeaking: () => void;
  onVoiceLevel?: (lvl: number) => void;
  onOrbStateChange?: (state: OrbState) => void;
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
  assistantName,
  languageMode,
  setLanguageMode,
  voiceProfile,
  setVoiceProfile,
  continuousListening,
  setContinuousListening,
  silentUntilUserSpeaks,
  onSendMessage,
  onSpeakDeepVoice,
  onStopSpeaking,
  onVoiceLevel,
  onOrbStateChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [voiceState, setVoiceState] = useState<VoiceEngineState>('IDLE');
  const [micActive, setMicActive] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [wakeWordOnly, setWakeWordOnly] = useState(false);
  const [voiceCategory, setVoiceCategory] = useState<VoiceGender>(() => getVoiceOption(voiceProfile).gender);
  const [userTranscript, setUserTranscript] = useState(
    'মাইক চালু করুন — আপনি কথা বললেই উত্তর দেবে, তার আগে চুপচাপ থাকবে...'
  );
  const [aiSubtitle, setAiSubtitle] = useState(`${assistantName} প্রস্তুত — আপনি কথা বললে উত্তর দেব।`);
  const [manualText, setManualText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [recorderFallback, setRecorderFallback] = useState(false);
  const [liveSessionActive, setLiveSessionActive] = useState(false);

  const stateRef = useRef<VoiceEngineState>('IDLE');
  const userLevelRef = useRef(0.08);
  const aiLevelRef = useRef(0.05);
  const shockwaveRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafAudioRef = useRef<number>(0);
  const continuousRef = useRef(continuousListening);
  const isSpeakingRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const micActiveRef = useRef(false);
  const recorderFallbackRef = useRef(false);
  const lastTranscriptRef = useRef('');

  // Gemini 3.8 Live Real-Time Voice WS refs
  const liveWsRef = useRef<WebSocket | null>(null);
  const liveInputCtxRef = useRef<AudioContext | null>(null);
  const liveOutputCtxRef = useRef<AudioContext | null>(null);
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const liveNextStartRef = useRef<number>(0);
  const liveSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    setVoiceCategory(getVoiceOption(voiceProfile).gender);
  }, [voiceProfile]);

  useEffect(() => {
    stateRef.current = voiceState;
    if (voiceState === 'LISTENING') {
      onOrbStateChange?.('LISTENING');
    } else if (voiceState === 'THINKING') {
      onOrbStateChange?.('THINKING');
    } else if (voiceState === 'SPEAKING') {
      onOrbStateChange?.('SPEAKING');
    } else if (voiceState === 'INTERRUPTED') {
      onOrbStateChange?.('EXECUTING');
    } else {
      onOrbStateChange?.('ONLINE');
    }
  }, [onOrbStateChange, voiceState]);

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
      void stopMic();
      if (liveOutputCtxRef.current) {
        void liveOutputCtxRef.current.close().catch(() => {});
        liveOutputCtxRef.current = null;
      }
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
          const speakStrokes = [
            'rgba(34, 211, 238, 0.52)',
            'rgba(251, 113, 133, 0.44)',
            'rgba(52, 211, 153, 0.36)',
          ];
          strokeColor = speakStrokes[ring % 3];
          fillColor = `rgba(251, 113, 133, ${0.12 - ring * 0.025})`;
        } else if (st === 'THINKING') {
          const thinkStrokes = [
            'rgba(167, 139, 250, 0.52)',
            'rgba(56, 189, 248, 0.42)',
            'rgba(251, 191, 36, 0.34)',
          ];
          strokeColor = thinkStrokes[ring % 3];
          fillColor = `rgba(167, 139, 250, ${0.09 - ring * 0.02})`;
        } else if (st === 'LISTENING') {
          const listenStrokes = [
            'rgba(45, 212, 191, 0.52)',
            'rgba(96, 165, 250, 0.42)',
            'rgba(129, 140, 248, 0.34)',
          ];
          strokeColor = listenStrokes[ring % 3];
          fillColor = `rgba(45, 212, 191, ${0.08 - ring * 0.018})`;
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
        coreGradient.addColorStop(0, 'rgba(251, 113, 133, 0.72)');
        coreGradient.addColorStop(0.6, 'rgba(34, 211, 238, 0.25)');
        coreGradient.addColorStop(1, 'rgba(52, 211, 153, 0)');
      } else if (st === 'THINKING') {
        coreGradient.addColorStop(0, 'rgba(167, 139, 250, 0.72)');
        coreGradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.22)');
        coreGradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
      } else if (st === 'LISTENING') {
        coreGradient.addColorStop(0, 'rgba(45, 212, 191, 0.68)');
        coreGradient.addColorStop(0.6, 'rgba(96, 165, 250, 0.22)');
        coreGradient.addColorStop(1, 'rgba(129, 140, 248, 0)');
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
      if (isSpeakingRef.current || Date.now() < cooldownUntilRef.current) return;
      const last = ev.results[ev.results.length - 1];
      const txt = last[0].transcript.trim();
      if (!txt || txt.length < 2) return;
      setUserTranscript(txt);
      if (last.isFinal && txt !== lastTranscriptRef.current) {
        lastTranscriptRef.current = txt;
        setTimeout(() => {
          lastTranscriptRef.current = '';
        }, 1800);

        if (wakeWordOnly) {
          const lower = txt.toLowerCase();
          const nameToken = assistantName.trim().toLowerCase().split(/\s+/)[0];
          const matchesCustom = nameToken.length >= 2 && lower.includes(nameToken);
          if (!matchesCustom && !/(brahma|ব্রহ্মা|ब्रह्मा|bramha)/.test(lower)) {
            return;
          }
        }
        handleVoicePrompt(txt);
      }
    };

    rec.onerror = (ev) => {
      const errCode = ev?.error || 'unknown';
      if (errCode === 'no-speech' || errCode === 'aborted') {
        return;
      }
      if (
        errCode === 'service-not-allowed' ||
        errCode === 'not-allowed' ||
        errCode === 'network' ||
        errCode === 'audio-capture'
      ) {
        try {
          rec.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
        if (streamRef.current && typeof MediaRecorder !== 'undefined') {
          recorderFallbackRef.current = true;
          setRecorderFallback(true);
          startAudioRecorder(streamRef.current);
          setUserTranscript('অডিও রেকর্ডার মোড সক্রিয় — কথা বলুন এবং শেষ হলে "Send Voice" চাপুন।');
        } else {
          setUserTranscript(`স্পিচ রিকগনিশন ত্রুটি (${errCode})। নিচের টেক্সট বক্স ব্যবহার করুন।`);
        }
      }
    };

    rec.onend = () => {
      if (
        continuousRef.current &&
        micActiveRef.current &&
        !isSpeakingRef.current &&
        !recorderFallbackRef.current
      ) {
        window.setTimeout(() => {
          try {
            rec.lang = getRecognitionLang();
            rec.start();
          } catch {
            // ignore restart race
          }
        }, 300);
      }
    };

    return rec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantName, getRecognitionLang, wakeWordOnly]);

  const startAudioRecorder = (stream: MediaStream) => {
    if (typeof MediaRecorder === 'undefined') return;
    try {
      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
    } catch {
      // ignore if MediaRecorder fails to start
    }
  };

  const transcribeRecordedAudio = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        resolve(new Blob(recordedChunksRef.current, { type: mime }));
      };
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(recordedChunksRef.current, { type: 'audio/webm' }));
      }
    });
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];

    if (blob.size < 400) {
      setUserTranscript('কোনো স্পষ্ট শব্দ পাওয়া যায়নি। আবার চেষ্টা করুন।');
      return;
    }

    setVoiceState('THINKING');
    setUserTranscript('ভয়েস ট্রান্সক্রাইব করা হচ্ছে...');

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Audio read error'));
      reader.readAsDataURL(blob);
    });

    try {
      const res = await brahmaFetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Data,
          mimeType: blob.type || 'audio/webm',
          languageMode,
        }),
      });
      const raw = await res.text();
      let data: { text?: string; error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        setAiSubtitle(data.error || `ভয়েস ট্রান্সক্রিপশন ব্যর্থ (HTTP ${res.status})।`);
        setVoiceState('IDLE');
        return;
      }
      const spoken = (data.text || '').trim();
      if (!spoken) {
        setUserTranscript('কথা বোঝা যায়নি। স্পষ্টভাবে আবার বলুন।');
        setVoiceState(micActiveRef.current ? 'LISTENING' : 'IDLE');
        return;
      }
      await handleVoicePrompt(spoken);
    } catch {
      setAiSubtitle('ভয়েস সার্ভারে সংযোগ পাওয়া যায়নি।');
      setVoiceState('IDLE');
    }
  };

  const handleVoicePrompt = async (spoken: string) => {
    const clean = spoken.trim();
    if (!clean) return;
    setUserTranscript(clean);
    setVoiceState('THINKING');
    setAiSubtitle(`${assistantName} আপনার কথা বুঝছে...`);
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
            cooldownUntilRef.current = Date.now() + 650;
            aiLevelRef.current = 0.05;
            if (continuousRef.current && micActiveRef.current) {
              setVoiceState('LISTENING');
              window.setTimeout(() => {
                if (!micActiveRef.current || isSpeakingRef.current) return;
                try {
                  recognitionRef.current?.start();
                } catch {
                  // ignore
                }
              }, 550);
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
      setAiSubtitle(`${assistantName}-এর সাথে সংযোগ ব্যাহত হয়েছে।`);
      setVoiceState('IDLE');
    }
  };

  const clearLiveAudioQueue = useCallback(() => {
    liveSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    });
    liveSourcesRef.current.clear();
    if (liveOutputCtxRef.current) {
      liveNextStartRef.current = liveOutputCtxRef.current.currentTime;
    }
    aiLevelRef.current = 0.05;
    onVoiceLevel?.(0.05);
  }, [onVoiceLevel]);

  const playLivePcmChunk = useCallback(
    (base64Audio: string) => {
      let ctx = liveOutputCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new AudioContext({ sampleRate: 24000 });
        liveOutputCtxRef.current = ctx;
        liveNextStartRef.current = ctx.currentTime;
      }
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }

      const float32 = pcm16Base64ToFloat32(base64Audio);
      let sumSq = 0;
      for (let i = 0; i < float32.length; i += 8) {
        sumSq += float32[i] * float32[i];
      }
      const rms = Math.sqrt(sumSq / Math.max(1, Math.ceil(float32.length / 8)));
      const lvl = Math.min(1, Math.max(0.24, rms * 3.8));
      aiLevelRef.current = lvl;
      onVoiceLevel?.(lvl);
      setVoiceState('SPEAKING');

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);

      const startAt = Math.max(ctx.currentTime, liveNextStartRef.current);
      src.start(startAt);
      liveNextStartRef.current = startAt + buffer.duration;
      liveSourcesRef.current.add(src);
      src.onended = () => {
        liveSourcesRef.current.delete(src);
        if (liveSourcesRef.current.size === 0 && micActiveRef.current) {
          aiLevelRef.current = 0.05;
          onVoiceLevel?.(0.05);
          setVoiceState('LISTENING');
        }
      };
    },
    [onVoiceLevel]
  );

  const startStandardSpeechOrRecorder = (stream: MediaStream) => {
    const rec = spawnRecognition();
    if (rec) {
      recorderFallbackRef.current = false;
      setRecorderFallback(false);
      recognitionRef.current = rec;
      try {
        rec.start();
        setUserTranscript('শুনছি — আপনি কথা বললেই উত্তর দেব...');
      } catch {
        if (typeof MediaRecorder !== 'undefined') {
          recorderFallbackRef.current = true;
          setRecorderFallback(true);
          startAudioRecorder(stream);
          setUserTranscript('অডিও রেকর্ডার চালু — কথা বলে "Send Voice" চাপুন।');
        }
      }
    } else if (typeof MediaRecorder !== 'undefined') {
      recorderFallbackRef.current = true;
      setRecorderFallback(true);
      startAudioRecorder(stream);
      setUserTranscript('অডিও রেকর্ডার চালু — কথা বলে "Send Voice" চাপুন।');
    } else {
      setUserTranscript('এই ব্রাউজারে স্পিচ ইনপুট সমর্থিত নয়। নিচের টেক্সট বক্সে লিখুন।');
    }
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
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
        if (stateRef.current !== 'SPEAKING') {
          onVoiceLevel?.(clamped);
        }
        rafAudioRef.current = requestAnimationFrame(sampleLevel);
      };
      sampleLevel();

      setMicActive(true);
      micActiveRef.current = true;
      setVoiceState('LISTENING');
      navigator.vibrate?.([25, 30]);

      // Try Gemini 3.8 Live Real-Time Human Voice WebSocket first when server is reachable
      const configuredBase = getApiBaseUrl();
      const canTryLiveWs = !(isNativeApkRuntime() && !configuredBase);
      if (canTryLiveWs) {
        if (!liveOutputCtxRef.current || liveOutputCtxRef.current.state === 'closed') {
          liveOutputCtxRef.current = new AudioContext({ sampleRate: 24000 });
        }
        if (liveOutputCtxRef.current.state === 'suspended') {
          await liveOutputCtxRef.current.resume().catch(() => {});
        }
        liveNextStartRef.current = liveOutputCtxRef.current.currentTime;

        const voiceOpt = getVoiceOption(voiceProfile);
        const wsTarget = configuredBase ? new URL(configuredBase) : window.location;
        const wsProto = wsTarget.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProto}//${wsTarget.host}/ws/live-vision?lang=${encodeURIComponent(
          languageMode === 'auto' ? 'bn' : languageMode
        )}&voice=${encodeURIComponent(voiceOpt.geminiVoice)}&name=${encodeURIComponent(
          assistantName
        )}&silent=${silentUntilUserSpeaks ? 'true' : 'false'}&mode=voice`;

        let fellBack = false;
        const fallbackToSpeech = (errText?: string) => {
          if (fellBack) return;
          fellBack = true;
          setLiveSessionActive(false);
          if (liveProcessorRef.current) {
            try {
              liveProcessorRef.current.disconnect();
            } catch {
              // ignore
            }
            liveProcessorRef.current = null;
          }
          if (liveInputCtxRef.current) {
            void liveInputCtxRef.current.close().catch(() => {});
            liveInputCtxRef.current = null;
          }
          if (liveWsRef.current) {
            try {
              liveWsRef.current.close();
            } catch {
              // ignore
            }
            liveWsRef.current = null;
          }
          if (errText) {
            setAiSubtitle(errText);
          }
          if (micActiveRef.current && streamRef.current) {
            startStandardSpeechOrRecorder(streamRef.current);
          }
        };

        try {
          const ws = new WebSocket(wsUrl);
          liveWsRef.current = ws;

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data as string) as {
                ready?: boolean;
                audio?: string;
                inputTranscript?: string;
                outputTranscript?: string;
                interrupted?: boolean;
                error?: string;
              };
              if (msg.ready) {
                setLiveSessionActive(true);
                setUserTranscript('Gemini 3.8 Live সক্রিয় — স্বাভাবিকভাবে কথা বলুন, মানুষীর মতো উত্তর দেব...');

                const inCtx = new AudioContext({ sampleRate: 16000 });
                liveInputCtxRef.current = inCtx;
                const micSrc = inCtx.createMediaStreamSource(stream);
                const proc = inCtx.createScriptProcessor(4096, 1, 1);
                liveProcessorRef.current = proc;
                proc.onaudioprocess = (ev) => {
                  if (ws.readyState !== WebSocket.OPEN || !micActiveRef.current) return;
                  const b64 = float32ToPcm16Base64(ev.inputBuffer.getChannelData(0));
                  ws.send(JSON.stringify({ audio: b64 }));
                };
                micSrc.connect(proc);
                proc.connect(inCtx.destination);
              }
              if (msg.audio && ttsEnabled) {
                playLivePcmChunk(msg.audio);
              }
              if (msg.interrupted) {
                clearLiveAudioQueue();
                setVoiceState('INTERRUPTED');
                window.setTimeout(() => {
                  if (micActiveRef.current) setVoiceState('LISTENING');
                }, 400);
              }
              if (msg.inputTranscript) {
                setUserTranscript(msg.inputTranscript);
              }
              if (msg.outputTranscript) {
                setAiSubtitle(msg.outputTranscript);
              }
              if (msg.error) {
                fallbackToSpeech(msg.error);
              }
            } catch {
              // ignore parse errors
            }
          };

          ws.onerror = () => {
            fallbackToSpeech();
          };
          ws.onclose = () => {
            if (!fellBack && micActiveRef.current && !liveInputCtxRef.current) {
              fallbackToSpeech();
            } else {
              setLiveSessionActive(false);
            }
          };
          return;
        } catch {
          fallbackToSpeech();
          return;
        }
      }

      startStandardSpeechOrRecorder(stream);
    } catch {
      setAiSubtitle('মাইক্রোফোন অনুমতি পাওয়া যায়নি। নিচের টেক্সট বক্স ব্যবহার করুন।');
      setMicActive(false);
    }
  };

  const stopMic = async () => {
    cancelAnimationFrame(rafAudioRef.current);
    micActiveRef.current = false;
    setLiveSessionActive(false);
    clearLiveAudioQueue();
    if (liveProcessorRef.current) {
      try {
        liveProcessorRef.current.disconnect();
      } catch {
        // ignore
      }
      liveProcessorRef.current = null;
    }
    if (liveInputCtxRef.current) {
      void liveInputCtxRef.current.close().catch(() => {});
      liveInputCtxRef.current = null;
    }
    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch {
        // ignore
      }
      liveWsRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
    const hadRecorder = Boolean(mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive');
    if (hadRecorder) {
      await transcribeRecordedAudio();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    userLevelRef.current = 0.08;
    recorderFallbackRef.current = false;
    setRecorderFallback(false);
    setMicActive(false);
    if (!hadRecorder) {
      setVoiceState('IDLE');
    }
  };

  const handleInterrupt = () => {
    onStopSpeaking();
    clearLiveAudioQueue();
    isSpeakingRef.current = false;
    shockwaveRef.current = 12;
    aiLevelRef.current = 0.05;
    setVoiceState('INTERRUPTED');
    setTimeout(() => {
      if (liveSessionActive && micActiveRef.current) {
        setVoiceState('LISTENING');
      } else if (continuousRef.current && micActiveRef.current) {
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
      <div className="relative z-10 flex flex-col gap-2 px-4 py-3 border-b border-white/10 backdrop-blur-md bg-[#060709]/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
              {wakeWordOnly ? `Wake Word: "${assistantName}"` : 'আপনি বললেই উত্তর'}
            </button>

            {silentUntilUserSpeaks && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300">
                চুপচাপ অপেক্ষমাণ
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
              <Languages className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={languageMode}
                onChange={(e) => setLanguageMode(e.target.value as LanguageMode)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="bn" className="bg-[#07080b]">বাংলা (স্বাভাবিক বাংলা)</option>
                <option value="hi" className="bg-[#07080b]">हिन्दी (স্বাভাবিক হিন্দি)</option>
                <option value="auto" className="bg-[#07080b]">Auto (BN / HI / EN)</option>
                <option value="en" className="bg-[#07080b]">English</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setTtsEnabled((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 cursor-pointer"
              title="Toggle Voice Output"
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Separated Male & Female Voice Categories (Deep/Hard & Soft options in both) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-0.5">
            <button
              type="button"
              onClick={() => {
                setVoiceCategory('male');
                if (getVoiceOption(voiceProfile).gender !== 'male') {
                  setVoiceProfile('male-deep-hard');
                }
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                voiceCategory === 'male'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>মেল ভয়েস (Male)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVoiceCategory('female');
                if (getVoiceOption(voiceProfile).gender !== 'female') {
                  setVoiceProfile('female-soft-sweet');
                }
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                voiceCategory === 'female'
                  ? 'bg-rose-500/25 text-rose-200 border border-rose-400/50'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>ফিমেল ভয়েস (Female)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {VOICE_CATALOG.filter((v) => v.gender === voiceCategory).map((v) => {
              const active = voiceProfile === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoiceProfile(v.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
                    active
                      ? v.tone === 'hard'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span className="opacity-75 mr-1">[{v.tone === 'hard' ? 'কঠিন/ডিপ' : 'নরম'}]</span>
                  {v.labelBn}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Organic Fluid Orb Canvas */}
      <div className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="w-full h-full block" />

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 space-y-2 text-center">
          <div className="bg-[#0d0f14]/85 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-cyan-400 mb-0.5">
              {liveSessionActive
                ? 'Gemini 3.8 Live · Real-Time Human Voice'
                : recorderFallback
                  ? 'Audio Recorder Mode'
                  : speechSupported
                    ? 'Voice Input'
                    : 'Audio / Text Input Mode'}
            </div>
            <div className="text-xs sm:text-sm text-slate-200">{userTranscript}</div>
          </div>

          <div className="bg-[#07080b]/92 backdrop-blur-xl border border-rose-500/30 rounded-2xl px-5 py-3">
            <div className="text-[10px] uppercase tracking-widest text-rose-400 mb-0.5">
              {assistantName} · {getVoiceOption(voiceProfile).labelBn} ({languageMode.toUpperCase()})
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
          onClick={() => (micActive ? void stopMic() : void startMic())}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider inline-flex items-center gap-2 transition cursor-pointer ${
            micActive
              ? 'bg-rose-500/25 border border-rose-400/60 text-rose-200 hover:bg-rose-500/35'
              : 'bg-cyan-400 text-[#020305] hover:bg-cyan-300'
          }`}
        >
          {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>
            {micActive
              ? recorderFallback
                ? 'Send Voice'
                : 'Stop Continuous Mic'
              : speechSupported
                ? 'Start Continuous Listening'
                : 'Record Voice'}
          </span>
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
