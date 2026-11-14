import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Eye,
  Monitor,
  Camera,
  Mic,
  MicOff,
  Square,
  Send,
  SwitchCamera,
  Upload,
  Sparkles,
  Volume2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import type { LanguageMode, VoiceProfile } from '../types/brahma';
import { brahmaFetch, getApiBaseUrl, isNativeApkRuntime } from '../lib/brahmaClient';

interface LiveVisionPanelProps {
  languageMode: LanguageMode;
  voiceProfile: VoiceProfile;
}

type VisionSourceMode = 'screen' | 'camera';

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

function pcm16Base64ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const count = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(new ArrayBuffer(count * 4));
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

export const LiveVisionPanel: React.FC<LiveVisionPanelProps> = ({ languageMode, voiceProfile }) => {
  const [sourceMode, setSourceMode] = useState<VisionSourceMode>('screen');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [framesSent, setFramesSent] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState<string>('—');
  const [statusNote, setStatusNote] = useState<string>(
    'স্ক্রিন শেয়ার বা ফোন ক্যামেরা চালু করে ব্রহ্মাকে লাইভ ভিডিও দেখান'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState('');
  const [transcripts, setTranscripts] = useState<
    Array<{ id: string; role: 'user' | 'brahma'; text: string; time: string }>
  >([]);
  const [analyzingFrame, setAnalyzingFrame] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const frameIntervalRef = useRef<number>(0);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micEnabledRef = useRef<boolean>(micEnabled);
  const isStreamingRef = useRef<boolean>(false);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  const appendTranscript = useCallback((role: 'user' | 'brahma', text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && Date.now() - Number(last.id.split('-')[1] || 0) < 4000) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${clean}`.replace(/\s+/g, ' ').trim() },
        ];
      }
      return [
        ...prev.slice(-24),
        {
          id: `${role}-${Date.now()}`,
          role,
          text: clean,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
      ];
    });
  }, []);

  const clearAudioQueue = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current.clear();
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  const playPcmChunk = useCallback((base64Audio: string) => {
    let ctx = outputAudioCtxRef.current;
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext({ sampleRate: 24000 });
      outputAudioCtxRef.current = ctx;
      nextStartTimeRef.current = ctx.currentTime;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const float32 = pcm16Base64ToFloat32(base64Audio);
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current);
    src.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;
    activeSourcesRef.current.add(src);
    src.onended = () => {
      activeSourcesRef.current.delete(src);
    };
  }, []);

  const stopSession = useCallback(() => {
    isStreamingRef.current = false;
    setIsStreaming(false);
    setIsConnecting(false);

    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = 0;
    }

    clearAudioQueue();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      void inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    setStatusNote('লাইভ ভিশন সেশন বন্ধ করা হয়েছে');
  }, [clearAudioQueue]);

  useEffect(() => {
    return () => {
      stopSession();
      if (outputAudioCtxRef.current) {
        void outputAudioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopSession]);

  const captureAndSendFrame = useCallback(() => {
    const video = videoRef.current;
    const ws = wsRef.current;
    if (!video || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }

    // Scale down smoothly to max 960px width for ultra-low-latency streaming
    const scale = Math.min(1, 960 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    const b64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

    ws.send(JSON.stringify({ video: b64 }));
    setFramesSent((n) => n + 1);
    setLastFrameTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, []);

  const startLiveVision = async (requestedMode: VisionSourceMode, camFacing = facingMode) => {
    stopSession();
    setErrorMsg(null);
    setIsConnecting(true);
    setFramesSent(0);
    setSourceMode(requestedMode);

    let stream: MediaStream;
    try {
      if (requestedMode === 'screen') {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error(
            'এই ব্রাউজার বা অ্যানড্রয়েড ওয়েবভিউতে স্ক্রিন শেয়ার ব্লক করা থাকতে পারে। অনুগ্রহ করে "Live Camera" বা নিচের স্ক্রিনশট আপলোড ব্যবহার করুন।'
          );
        }
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 15, max: 30 } },
          audio: false,
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: camFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }
    } catch (err: unknown) {
      setIsConnecting(false);
      const msg = err instanceof Error ? err.message : 'Media permission denied';
      setErrorMsg(
        requestedMode === 'screen'
          ? `স্ক্রিন শেয়ার চালু করা যায়নি (${msg})। মোবাইল বা আইফ্রেম সীমাবদ্ধতার কারণে এটি হতে পারে — "Phone Camera" অথবা "Snap & Analyze" ব্যবহার করতে পারেন।`
          : `ক্যামেরা অনুমতি পাওয়া যায়নি: ${msg}`
      );
      return;
    }

    videoStreamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      stopSession();
    });

    // Prepare 24kHz playback AudioContext on user gesture
    if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
      outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (outputAudioCtxRef.current.state === 'suspended') {
      await outputAudioCtxRef.current.resume().catch(() => {});
    }
    nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;

    const voiceParam = voiceProfile === 'commanding' ? 'Fenrir' : 'Charon';
    const configuredBase = getApiBaseUrl();

    // Standalone Android APK mode without backend server: stream camera frames via on-device Gemini API
    if (isNativeApkRuntime() && !configuredBase) {
      setIsConnecting(false);
      setIsStreaming(true);
      isStreamingRef.current = true;
      setStatusNote('Android Standalone Live Vision চালু (On-Device Gemini Frame Stream)');

      frameIntervalRef.current = window.setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.videoWidth === 0) return;
        const c = document.createElement('canvas');
        const scale = Math.min(1, 720 / video.videoWidth);
        c.width = Math.round(video.videoWidth * scale);
        c.height = Math.round(video.videoHeight * scale);
        c.getContext('2d')?.drawImage(video, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL('image/jpeg', 0.7);
        setFramesSent((n) => n + 1);
        setLastFrameTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        void analyzeSingleFrame(
          dataUrl,
          'image/jpeg',
          'ক্যামেরায় যা দেখা যাচ্ছে তা ১-২ লাইনে সংক্ষেপে বলো।'
        );
      }, 4500);
      return;
    }

    const wsTarget = configuredBase ? new URL(configuredBase) : window.location;
    const wsProto = wsTarget.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${wsTarget.host}/ws/live-vision?lang=${encodeURIComponent(
      languageMode === 'auto' ? 'bn' : languageMode
    )}&voice=${encodeURIComponent(voiceParam)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

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
          setIsConnecting(false);
          setIsStreaming(true);
          isStreamingRef.current = true;
          setStatusNote(
            requestedMode === 'screen'
              ? 'লাইভ স্ক্রিন শেয়ার সংযুক্ত — আল্ট্রা লো-লেটেন্সি ১ FPS ভিডিও স্ট্রিম চলছে'
              : 'লাইভ ফোন ক্যামেরা সংযুক্ত — ব্রহ্মা সরাসরি দেখছে ও শুনছে'
          );

          // Send an initial greeting/context frame immediately, then 1 FPS
          window.setTimeout(() => captureAndSendFrame(), 250);
          frameIntervalRef.current = window.setInterval(() => {
            captureAndSendFrame();
          }, 1000);
        }

        if (msg.audio) {
          playPcmChunk(msg.audio);
        }
        if (msg.interrupted) {
          clearAudioQueue();
        }
        if (msg.inputTranscript) {
          appendTranscript('user', msg.inputTranscript);
        }
        if (msg.outputTranscript) {
          appendTranscript('brahma', msg.outputTranscript);
        }
        if (msg.error) {
          setErrorMsg(msg.error);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setErrorMsg('Live Vision WebSocket সংযোগে সমস্যা হয়েছে।');
      stopSession();
    };

    ws.onclose = () => {
      if (isStreamingRef.current) {
        stopSession();
      }
    };

    // Start 16kHz microphone capture so user can talk over live video
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      micStreamRef.current = micStream;
      const inCtx = new AudioContext({ sampleRate: 16000 });
      inputAudioCtxRef.current = inCtx;
      const source = inCtx.createMediaStreamSource(micStream);
      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!micEnabledRef.current) return;
        const activeWs = wsRef.current;
        if (!activeWs || activeWs.readyState !== WebSocket.OPEN || !isStreamingRef.current) return;
        const base64Pcm = float32ToPcm16Base64(e.inputBuffer.getChannelData(0));
        activeWs.send(JSON.stringify({ audio: base64Pcm }));
      };
    } catch {
      // Mic is optional; user can still stream screen/camera and send text prompts
      setMicEnabled(false);
    }
  };

  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (isStreaming && sourceMode === 'camera') {
      void startLiveVision('camera', nextFacing);
    }
  };

  const sendLiveTextPrompt = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: clean }));
      appendTranscript('user', clean);
      setPromptInput('');
    }
  };

  const analyzeSingleFrame = async (base64DataUrl: string, mimeType: string, customPrompt?: string) => {
    setAnalyzingFrame(true);
    setErrorMsg(null);
    try {
      const res = await brahmaFetch('/api/vision/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64DataUrl,
          mimeType,
          prompt: customPrompt || promptInput.trim() || 'এই স্ক্রিন বা ছবিতে কী আছে তা বিশ্লেষণ করে সমাধান বলো।',
          languageMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Frame analysis failed');
      } else if (data.analysis) {
        appendTranscript('brahma', data.analysis);
      }
    } catch {
      setErrorMsg('নেটওয়ার্ক সমস্যার কারণে ছবি বিশ্লেষণ করা যায়নি।');
    } finally {
      setAnalyzingFrame(false);
    }
  };

  const handleSnapshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        appendTranscript('user', `স্ক্রিনশট/ছবি পাঠানো হয়েছে: ${file.name}`);
        void analyzeSingleFrame(reader.result, file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSnapCurrentVideo = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    void analyzeSingleFrame(dataUrl, 'image/jpeg');
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#020305] overflow-hidden">
      {/* Top Control Header */}
      <div className="p-3 sm:p-4 bg-[#07080b] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center">
            <Eye className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Brahma Live Vision // Screen & Camera
              </h2>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isStreaming
                    ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300 animate-pulse'
                    : isConnecting
                      ? 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                {isStreaming ? 'LIVE 1 FPS WS' : isConnecting ? 'CONNECTING...' : 'STANDBY'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{statusNote}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void startLiveVision('screen')}
            disabled={isConnecting}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition cursor-pointer ${
              isStreaming && sourceMode === 'screen'
                ? 'bg-cyan-400 text-[#020305] border-cyan-300'
                : 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-400/40 text-cyan-200'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Share Screen Live</span>
          </button>

          <button
            type="button"
            onClick={() => void startLiveVision('camera')}
            disabled={isConnecting}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition cursor-pointer ${
              isStreaming && sourceMode === 'camera'
                ? 'bg-cyan-400 text-[#020305] border-cyan-300'
                : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Phone Camera Live</span>
          </button>

          {sourceMode === 'camera' && (
            <button
              type="button"
              onClick={handleFlipCamera}
              className="px-2.5 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 inline-flex items-center gap-1 cursor-pointer"
              title="Flip Front/Rear Camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setMicEnabled((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs border inline-flex items-center gap-1.5 cursor-pointer ${
              micEnabled
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
            }`}
          >
            {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            <span>{micEnabled ? 'Mic On' : 'Mic Muted'}</span>
          </button>

          {isStreaming && (
            <button
              type="button"
              onClick={stopSession}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Split Video Viewport + Live Neural Feed */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left: Live Video Monitor */}
        <div className="lg:col-span-7 flex flex-col bg-[#07080b] border border-cyan-500/20 rounded-2xl overflow-hidden min-h-[260px]">
          <div className="px-4 py-2 bg-[#0d0f14] border-b border-white/10 flex items-center justify-between text-[11px] font-mono">
            <span className="text-cyan-300 inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              VIDEO FEED ({sourceMode === 'screen' ? 'SCREEN CAPTURE' : `CAMERA: ${facingMode.toUpperCase()}`})
            </span>
            <span className="text-slate-400">
              Frames: <strong className="text-white">{framesSent}</strong> • Last: {lastFrameTime}
            </span>
          </div>

          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain ${isStreaming ? 'block' : 'hidden'}`}
            />

            {!isStreaming && (
              <div className="p-6 text-center max-w-md space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
                  <Eye className="w-8 h-8 text-cyan-400" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-white">
                    আল্ট্রা লো-লেটেন্সি লাইভ স্ক্রিন ও ক্যামেরা ভিশন
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    উপরে <strong>Share Screen Live</strong> চাপলে ব্রহ্মা আপনার ফোনের বা কম্পিউটারের স্ক্রিন সরাসরি লাইভ ভিডিওর মতো দেখবে এবং মুখে ভয়েসেই তাৎক্ষণিক উত্তর ও নির্দেশনা দেবে।
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void startLiveVision('screen')}
                    className="px-4 py-2 rounded-xl bg-cyan-400 text-[#020305] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Monitor className="w-4 h-4" />
                    <span>স্ক্রিন লাইভ শুরু করুন</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={analyzingFrame}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-cyan-400" />
                    <span>{analyzingFrame ? 'বিশ্লেষণ চলছে...' : 'স্ক্রিনশট / ছবি আপলোড'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSnapshotUpload}
                  />
                </div>
              </div>
            )}

            {isStreaming && (
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleSnapCurrentVideo}
                  disabled={analyzingFrame}
                  className="px-3 py-1.5 rounded-lg bg-black/75 hover:bg-black border border-cyan-400/40 text-[11px] text-cyan-200 inline-flex items-center gap-1 cursor-pointer backdrop-blur"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{analyzingFrame ? 'Deep Scan...' : 'Deep HD Frame Scan'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Transcript & Instant Voice/Text Steering */}
        <div className="lg:col-span-5 flex flex-col bg-[#07080b] border border-cyan-500/20 rounded-2xl overflow-hidden min-h-0">
          <div className="px-4 py-2.5 bg-[#0d0f14] border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-white inline-flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              লাইভ ভিশন কথোপকথন (24kHz Deep Voice)
            </span>
            <span className="text-[10px] font-mono text-emerald-400">
              {voiceProfile === 'commanding' ? 'FENRIR' : 'CHARON'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {transcripts.length === 0 ? (
              <div className="text-xs text-slate-400 space-y-2 py-4">
                <p>সেশন শুরু হলে এখানে লাইভ ভয়েস ট্রান্সক্রিপ্ট এবং ব্রহ্মার তাৎক্ষণিক পর্যবেক্ষণ দেখা যাবে।</p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {[
                    'আমার স্ক্রিনে এখন কী দেখা যাচ্ছে?',
                    'কোনো এরর থাকলে সমাধান বলো',
                    'এই সার্কিট বা কোডটি পরীক্ষা করো',
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendLiveTextPrompt(q)}
                      disabled={!isStreaming}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/15 border border-white/10 text-cyan-200 disabled:opacity-40 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl text-xs border ${
                    t.role === 'user'
                      ? 'bg-cyan-500/10 border-cyan-400/30 text-cyan-100 ml-6'
                      : 'bg-[#0d0f14] border-white/10 text-slate-200 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-bold uppercase tracking-wider">
                      {t.role === 'user' ? 'আপনি' : 'ব্রহ্মা লাইভ ভিশন'}
                    </span>
                    <span className="font-mono">{t.time}</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{t.text}</p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendLiveTextPrompt(promptInput);
            }}
            className="p-3 bg-[#0d0f14] border-t border-white/10 flex gap-2"
          >
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={
                isStreaming
                  ? 'লাইভ ভিডিওর ওপর প্রশ্ন লিখুন বা মাইকে বলুন...'
                  : 'আগে লাইভ শেয়ার শুরু করুন অথবা স্ক্রিনশট আপলোড করুন'
              }
              className="flex-1 bg-[#07080b] border border-cyan-500/25 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!isStreaming || !promptInput.trim()}
              className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#020305] font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
