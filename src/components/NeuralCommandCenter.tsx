import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  ImagePlus,
  Mic,
  Globe,
  Zap,
  CloudSun,
  Workflow,
  X,
  ArrowUpRight,
  Volume2,
  VolumeX,
  Activity,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import type {
  BriefingData,
  BrahmaTab,
  ChatMessage,
  LanguageMode,
  OrbState,
} from '../types/brahma';

interface NeuralCommandCenterProps {
  assistantName?: string;
  orbState: OrbState;
  setOrbState: (state: OrbState) => void;
  voiceLevel?: number;
  messages: ChatMessage[];
  onSendMessage: (
    text: string,
    imageBase64?: string,
    imageMimeType?: string
  ) => Promise<void>;
  isThinking: boolean;
  briefing: BriefingData | null;
  onNavigate: (tab: BrahmaTab) => void;
  languageMode: LanguageMode;
  setLanguageMode: (lang: LanguageMode) => void;
  autoSpeakReply: boolean;
  setAutoSpeakReply: (v: boolean) => void;
  onSpeakDeepVoice: (text: string) => Promise<void>;
}

export const NeuralCommandCenter: React.FC<NeuralCommandCenterProps> = ({
  assistantName = 'ব্রহ্মা AI',
  orbState,
  setOrbState,
  voiceLevel = 0.06,
  messages,
  onSendMessage,
  isThinking,
  briefing,
  onNavigate,
  autoSpeakReply,
  setAutoSpeakReply,
  onSpeakDeepVoice,
}) => {
  const [input, setInput] = useState('');
  const [chatMinimized, setChatMinimized] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{
    dataUrl: string;
    mimeType: string;
    name: string;
  } | null>(null);
  const orbIframeRef = useRef<HTMLIFrameElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncOrbBridge = (state: OrbState, level: number) => {
    const win = orbIframeRef.current?.contentWindow as
      | (Window & {
          setBrahmaState?: (state: string) => void;
          setAudioLevel?: (lvl: number) => void;
          triggerPulse?: () => void;
        })
      | null;
    if (!win) return;
    if (win.setBrahmaState) {
      win.setBrahmaState(state);
      if (state === 'EXECUTING' || state === 'SPEAKING') {
        win.triggerPulse?.();
      }
    }
    win.setAudioLevel?.(level);
  };

  useEffect(() => {
    syncOrbBridge(orbState, voiceLevel);
  }, [orbState, voiceLevel]);

  useEffect(() => {
    if (messages.length > 0 || isThinking) {
      setChatMinimized(false);
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && !attachedImage) return;
    const img = attachedImage;
    setInput('');
    setAttachedImage(null);
    navigator.vibrate?.(15);
    await onSendMessage(trimmed, img?.dataUrl, img?.mimeType);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedImage({
          dataUrl: reader.result,
          mimeType: file.type || 'image/png',
          name: file.name,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const triggerOrbPulse = () => {
    const win = orbIframeRef.current?.contentWindow as
      | (Window & { triggerPulse?: () => void })
      | null;
    win?.triggerPulse?.();
    setOrbState('SCANNING');
    setTimeout(() => setOrbState('ONLINE'), 1400);
  };

  const rgbMode =
    orbState === 'THINKING'
      ? 'thinking'
      : orbState === 'SPEAKING'
        ? 'speaking'
        : orbState === 'LISTENING'
          ? 'listening'
          : null;

  const orbStageGlow =
    rgbMode === 'thinking'
      ? 'shadow-[0_0_42px_-8px_rgba(167,139,250,0.42)]'
      : rgbMode === 'speaking'
        ? 'shadow-[0_0_42px_-8px_rgba(251,113,133,0.42)]'
        : rgbMode === 'listening'
          ? 'shadow-[0_0_42px_-8px_rgba(45,212,191,0.4)]'
          : '';

  const stateAccentText =
    rgbMode === 'thinking'
      ? 'text-violet-300'
      : rgbMode === 'speaking'
        ? 'text-rose-300'
        : rgbMode === 'listening'
          ? 'text-teal-300'
          : 'text-cyan-300';

  const showChatFeed = (messages.length > 0 || isThinking) && !chatMinimized;

  return (
    <div className="w-full h-full flex flex-col bg-[#020305] overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col gap-2.5 p-2.5 sm:p-3.5 max-w-[1440px] w-full mx-auto overflow-hidden">
        {/* Top 4-Card Telemetry KPI Strip */}
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onNavigate('globe')}
            className="text-left bg-[#070a10] hover:bg-[#0c111a] border border-white/10 hover:border-cyan-400/35 rounded-xl px-3 py-2 flex items-center justify-between gap-2 transition cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-400 truncate">
                আবহাওয়া · {briefing?.weather.location || 'Kolkata'}
              </div>
              <div className="text-base sm:text-lg font-bold text-white tabular-nums mt-0.5">
                {briefing ? `${briefing.weather.tempC}°C` : '28°C'}
              </div>
              <div className="text-[11px] text-slate-400 tabular-nums truncate">
                {briefing ? `আর্দ্রতা ${briefing.weather.humidity}%` : 'Live Feed'}
              </div>
            </div>
            <CloudSun className="w-5 h-5 text-cyan-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('globe')}
            className="text-left bg-[#070a10] hover:bg-[#0c111a] border border-white/10 hover:border-cyan-400/35 rounded-xl px-3 py-2 flex items-center justify-between gap-2 transition cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-400 truncate">
                ISS কক্ষপথ · HoloGlobe
              </div>
              <div className="text-sm sm:text-base font-bold text-white font-mono tabular-nums mt-0.5 truncate">
                {briefing
                  ? `${briefing.iss.latitude}°, ${briefing.iss.longitude}°`
                  : '22.57°, 88.36°'}
              </div>
              <div className="text-[11px] text-cyan-300 tabular-nums truncate">
                {briefing ? `উচ্চতা ${briefing.iss.altitudeKm} km` : '419 km Orbit'}
              </div>
            </div>
            <Globe className="w-5 h-5 text-cyan-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('automation')}
            className="text-left bg-[#070a10] hover:bg-[#0c111a] border border-white/10 hover:border-cyan-400/35 rounded-xl px-3 py-2 flex items-center justify-between gap-2 transition cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-400 truncate">
                অটোমেশন ইঞ্জিন
              </div>
              <div className="text-base sm:text-lg font-bold text-white tabular-nums mt-0.5">
                {briefing ? `${briefing.stats.activeAutomations} Active` : '4 Active'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Scheduled Workflows
              </div>
            </div>
            <Workflow className="w-5 h-5 text-cyan-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('smart-office')}
            className="text-left bg-[#070a10] hover:bg-[#0c111a] border border-white/10 hover:border-emerald-400/35 rounded-xl px-3 py-2 flex items-center justify-between gap-2 transition cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-400 truncate">
                স্মার্ট ডিভাইস মেশ
              </div>
              <div className="text-base sm:text-lg font-bold text-white tabular-nums mt-0.5">
                {briefing
                  ? `${briefing.stats.onlineDevices}/${briefing.stats.totalDevices} Online`
                  : '3/5 Online'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Tuya · Home Assistant · Atomberg
              </div>
            </div>
            <Zap className="w-5 h-5 text-emerald-400 shrink-0" />
          </button>
        </div>

        {/* Full-Height Expanded 3D Quantum Core Stage (Reclaiming full workspace down to input bar) */}
        <div
          className={`relative flex-1 min-h-0 rounded-2xl bg-[#05070c] border border-white/10 overflow-hidden transition-shadow duration-500 ${orbStageGlow}`}
        >
          <iframe
            ref={orbIframeRef}
            src="/brahma-assets/orb/index.html"
            title="Brahma 3D Neural Orb"
            onLoad={() => syncOrbBridge(orbState, voiceLevel)}
            className="w-full h-full border-0"
          />

          {rgbMode && (
            <>
              <div className={`brahma-rgb-wash brahma-rgb-wash-${rgbMode}`} />
              <div className={`brahma-rgb-rim brahma-rgb-${rgbMode}`}>
                <div className="brahma-rgb-rim-rotor" />
              </div>
            </>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#05070c]/85 via-[#05070c]/30 to-transparent" />

          {/* Top Overlay: Core State & RGB Lighting Test Mode Selector */}
          <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2 bg-[#070a10]/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
              <Activity className={`w-3.5 h-3.5 ${stateAccentText}`} />
              <span>{assistantName} Core</span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className={`font-mono text-[11px] ${stateAccentText}`}>{orbState}</span>
            </div>

            <div className="pointer-events-auto flex items-center gap-1 bg-[#070a10]/80 backdrop-blur-md p-1 rounded-lg border border-white/10">
              {(
                [
                  {
                    state: 'LISTENING',
                    label: 'Listen',
                    activeCls: 'bg-teal-500/25 text-teal-200 border-teal-400/50',
                  },
                  {
                    state: 'THINKING',
                    label: 'Think',
                    activeCls: 'bg-violet-500/25 text-violet-200 border-violet-400/50',
                  },
                  {
                    state: 'SPEAKING',
                    label: 'Speak',
                    activeCls: 'bg-rose-500/25 text-rose-200 border-rose-400/50',
                  },
                ] as const
              ).map((item) => {
                const active = orbState === item.state;
                return (
                  <button
                    key={item.state}
                    type="button"
                    onClick={() => setOrbState(active ? 'ONLINE' : item.state)}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold transition cursor-pointer whitespace-nowrap ${
                      active
                        ? item.activeCls
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={triggerOrbPulse}
                className="px-2 py-0.5 rounded-md border border-white/10 hover:border-cyan-400/40 hover:bg-cyan-500/15 text-[10px] font-semibold text-slate-200 transition cursor-pointer whitespace-nowrap"
              >
                Pulse
              </button>
            </div>
          </div>

          {/* Floating Conversation Drawer (Only visible when messages exist and not minimized) */}
          {messages.length > 0 && chatMinimized && (
            <button
              type="button"
              onClick={() => setChatMinimized(false)}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-[#070a10]/90 hover:bg-[#0c111a] border border-cyan-400/35 text-xs text-cyan-200 inline-flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>কথোপকথন ({messages.length})</span>
            </button>
          )}

          {showChatFeed && (
            <div className="absolute inset-x-3 bottom-3 max-h-[46%] flex flex-col rounded-2xl bg-[#070a10]/86 backdrop-blur-xl border border-white/12 shadow-[0_14px_40px_rgba(0,0,0,0.65)] overflow-hidden">
              <div className="shrink-0 px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span>{assistantName} · কথোপকথন</span>
                <button
                  type="button"
                  onClick={() => setChatMinimized(true)}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-white/5"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Hide</span>
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm border ${
                        msg.role === 'user'
                          ? 'bg-cyan-500/14 border-cyan-400/35 text-white'
                          : 'bg-[#0c111a]/95 border-white/10 text-slate-100'
                      }`}
                    >
                      {msg.imagePreview && (
                        <img
                          src={msg.imagePreview}
                          alt="Attached context"
                          referrerPolicy="no-referrer"
                          className="max-h-36 rounded-lg mb-2 border border-white/10"
                        />
                      )}
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                      {msg.role === 'assistant' && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          <div className="flex items-center gap-2 tabular-nums">
                            <span>{msg.latencyMs ?? 0}ms</span>
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              onClick={() => void onSpeakDeepVoice(msg.text)}
                              className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 cursor-pointer"
                              title="Speak Reply"
                            >
                              <Volume2 className="w-3.5 h-3.5" /> Speak
                            </button>
                          </div>
                          {msg.moduleToOpen && (
                            <button
                              type="button"
                              onClick={() => onNavigate(msg.moduleToOpen as BrahmaTab)}
                              className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-medium cursor-pointer"
                            >
                              Open {msg.moduleToOpen} <ArrowUpRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="bg-[#0c111a]/95 border border-violet-500/35 rounded-xl px-3.5 py-2 text-xs text-violet-200">
                      {assistantName} চিন্তা করছে...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Single Compact Bottom Input Bar Only */}
        <div className="shrink-0 space-y-1.5">
          {attachedImage && (
            <div className="inline-flex items-center gap-2 bg-[#0c111a] border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-cyan-200">
              <img
                src={attachedImage.dataUrl}
                alt="Upload preview"
                className="w-7 h-7 rounded object-cover"
              />
              <span className="max-w-[180px] truncate">{attachedImage.name}</span>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-1.5 bg-[#070a10] border border-white/10 rounded-2xl p-1.5"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach photo or circuit"
              className="p-2.5 rounded-xl bg-[#05070c] hover:bg-white/5 border border-white/10 text-slate-300 hover:text-cyan-300 transition cursor-pointer shrink-0"
            >
              <ImagePlus className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`${assistantName}-কে নির্দেশ দিন (বাংলা / हिन्दी / English)...`}
              className="flex-1 min-w-0 bg-[#05070c] border border-white/10 focus:border-cyan-400/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => setAutoSpeakReply(!autoSpeakReply)}
              title={autoSpeakReply ? 'Voice Reply ON' : 'Voice Reply Muted'}
              className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                autoSpeakReply
                  ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
                  : 'bg-[#05070c] border-white/10 text-slate-500'
              }`}
            >
              {autoSpeakReply ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('voice')}
              title="Open Voice Studio"
              className="p-2.5 rounded-xl bg-[#05070c] hover:bg-rose-500/15 border border-white/10 text-rose-400 transition cursor-pointer shrink-0"
            >
              <Mic className="w-4 h-4" />
            </button>

            <button
              type="submit"
              disabled={isThinking}
              className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#020305] font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="hidden sm:inline">Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
