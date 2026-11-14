import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  ImagePlus,
  Mic,
  Cpu,
  Globe,
  Zap,
  CloudSun,
  Orbit,
  Workflow,
  X,
  ArrowUpRight,
  Volume2,
  Languages,
} from 'lucide-react';
import type { BriefingData, BrahmaTab, ChatMessage, LanguageMode, OrbState } from '../types/brahma';

interface NeuralCommandCenterProps {
  orbState: OrbState;
  setOrbState: (state: OrbState) => void;
  messages: ChatMessage[];
  onSendMessage: (text: string, imageBase64?: string, imageMimeType?: string) => Promise<void>;
  isThinking: boolean;
  briefing: BriefingData | null;
  onNavigate: (tab: BrahmaTab) => void;
  languageMode: LanguageMode;
  setLanguageMode: (lang: LanguageMode) => void;
  autoSpeakReply: boolean;
  setAutoSpeakReply: (v: boolean) => void;
  onSpeakDeepVoice: (text: string) => Promise<void>;
}

const QUICK_PROMPTS = [
  { label: 'রাত্রি নিরাপত্তা প্রোটোকল', prompt: 'রাত্রি প্রোটোকল চালু করো', icon: Workflow },
  { label: 'DHT11 সার্কিট দেখাও', prompt: 'How to connect DHT11 to Arduino Pro Mini', icon: Cpu },
  { label: 'ISS লাইভ ট্র্যাক', prompt: 'Track International Space Station on the globe', icon: Orbit },
  { label: 'স্টুডিও লাইট বন্ধ', prompt: 'স্টুডিও লাইট বন্ধ করো', icon: Zap },
];

export const NeuralCommandCenter: React.FC<NeuralCommandCenterProps> = ({
  orbState,
  setOrbState,
  messages,
  onSendMessage,
  isThinking,
  briefing,
  onNavigate,
  languageMode,
  setLanguageMode,
  autoSpeakReply,
  setAutoSpeakReply,
  onSpeakDeepVoice,
}) => {
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ dataUrl: string; mimeType: string; name: string } | null>(null);
  const orbIframeRef = useRef<HTMLIFrameElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const win = orbIframeRef.current?.contentWindow as
      | (Window & {
          setBrahmaState?: (state: string) => void;
          triggerPulse?: () => void;
        })
      | null;
    if (win?.setBrahmaState) {
      win.setBrahmaState(orbState);
      if (orbState === 'EXECUTING' || orbState === 'SPEAKING') {
        win.triggerPulse?.();
      }
    }
  }, [orbState]);

  useEffect(() => {
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
    const win = orbIframeRef.current?.contentWindow as (Window & { triggerPulse?: () => void }) | null;
    win?.triggerPulse?.();
    setOrbState('SCANNING');
    setTimeout(() => setOrbState('ONLINE'), 1400);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#020305]">
      <iframe
        ref={orbIframeRef}
        src="/brahma-assets/orb/index.html"
        title="Brahma 3D Neural Orb"
        className="absolute inset-0 w-full h-full border-0 pointer-events-auto opacity-85"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#020305]/75 via-transparent to-[#020305]/95" />

      {/* Top Android Telemetry Bento */}
      <div className="relative z-10 px-3 sm:px-4 pt-3 pb-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-[#07080b]/80 backdrop-blur-md border border-cyan-500/20 rounded-xl px-3 py-2 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-400/80 font-semibold">আবহাওয়া</div>
            <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">
              {briefing ? `${briefing.weather.tempC}°C · ${briefing.weather.location}` : '28°C'}
            </div>
            <div className="text-[10px] text-slate-400">
              {briefing ? `আর্দ্রতা ${briefing.weather.humidity}%` : 'Live Telemetry'}
            </div>
          </div>
          <CloudSun className="w-5 h-5 text-cyan-400 shrink-0" />
        </div>

        <button
          type="button"
          onClick={() => onNavigate('globe')}
          className="text-left bg-[#07080b]/80 backdrop-blur-md border border-cyan-500/20 hover:border-cyan-400/50 rounded-xl px-3 py-2 flex items-center justify-between transition cursor-pointer"
        >
          <div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-400/80 font-semibold">ISS কক্ষপথ</div>
            <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">
              {briefing ? `${briefing.iss.latitude}°, ${briefing.iss.longitude}°` : '22.57°, 88.36°'}
            </div>
            <div className="text-[10px] text-slate-400">
              {briefing ? `${briefing.iss.altitudeKm} km` : '419 km'}
            </div>
          </div>
          <Globe className="w-5 h-5 text-cyan-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('automation')}
          className="text-left bg-[#07080b]/80 backdrop-blur-md border border-cyan-500/20 hover:border-cyan-400/50 rounded-xl px-3 py-2 flex items-center justify-between transition cursor-pointer"
        >
          <div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-400/80 font-semibold">অটোমেশন</div>
            <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">
              {briefing ? `${briefing.stats.activeAutomations} Active Rules` : '4 Active Rules'}
            </div>
            <div className="text-[10px] text-slate-400">Autonomous Pipelines</div>
          </div>
          <Workflow className="w-5 h-5 text-cyan-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('smart-office')}
          className="text-left bg-[#07080b]/80 backdrop-blur-md border border-cyan-500/20 hover:border-cyan-400/50 rounded-xl px-3 py-2 flex items-center justify-between transition cursor-pointer"
        >
          <div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-400/80 font-semibold">স্মার্ট মেশ</div>
            <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">
              {briefing ? `${briefing.stats.onlineDevices}/${briefing.stats.totalDevices} Online` : '3/5 Online'}
            </div>
            <div className="text-[10px] text-slate-400">Tuya · HA · Atomberg</div>
          </div>
          <Zap className="w-5 h-5 text-emerald-400 shrink-0" />
        </button>
      </div>

      {/* Chat & Command Area */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-end px-3 sm:px-4 pb-3 pointer-events-none">
        <div className="max-w-4xl w-full mx-auto flex flex-col gap-2.5 max-h-full pointer-events-auto">
          {messages.length > 0 && (
            <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm backdrop-blur-xl border ${
                      msg.role === 'user'
                        ? 'bg-cyan-500/15 border-cyan-400/35 text-white'
                        : 'bg-[#07080b]/90 border-white/15 text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
                    }`}
                  >
                    {msg.imagePreview && (
                      <img
                        src={msg.imagePreview}
                        alt="Attached context"
                        className="max-h-36 rounded-lg mb-2 border border-white/10"
                      />
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                    {msg.role === 'assistant' && (
                      <div className="mt-2 pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                        <div className="flex items-center gap-2">
                          <span>Tier {msg.tier ?? 3} · {msg.latencyMs ?? 0}ms</span>
                          <button
                            type="button"
                            onClick={() => onSpeakDeepVoice(msg.text)}
                            className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200 cursor-pointer"
                            title="Play in Deep Voinkor Voice"
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
                  <div className="bg-[#07080b]/85 backdrop-blur-xl border border-cyan-500/30 rounded-2xl px-4 py-2 text-xs text-cyan-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    ব্রহ্মা নিউরাল কোর উত্তর প্রস্তুত করছে...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Language, Deep Voice & Quick Triggers */}
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_PROMPTS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onSendMessage(item.prompt)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#07080b]/85 hover:bg-cyan-500/15 border border-cyan-500/25 text-[11px] text-slate-200 backdrop-blur-md transition cursor-pointer"
                >
                  <Icon className="w-3 h-3 text-cyan-400" />
                  {item.label}
                </button>
              );
            })}

            <div className="ml-auto flex items-center gap-1.5">
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#07080b]/85 border border-white/15 text-[11px]">
                <Languages className="w-3 h-3 text-cyan-400" />
                <select
                  value={languageMode}
                  onChange={(e) => setLanguageMode(e.target.value as LanguageMode)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="bn" className="bg-[#07080b]">বাংলা</option>
                  <option value="hi" className="bg-[#07080b]">हिन्दी</option>
                  <option value="auto" className="bg-[#07080b]">Auto</option>
                  <option value="en" className="bg-[#07080b]">EN</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setAutoSpeakReply(!autoSpeakReply)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${
                  autoSpeakReply
                    ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                    : 'bg-[#07080b]/85 border-white/15 text-slate-400'
                }`}
              >
                <Volume2 className="w-3 h-3" />
                <span>{autoSpeakReply ? 'Deep Voice ON' : 'Muted'}</span>
              </button>

              <button
                type="button"
                onClick={triggerOrbPulse}
                className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] text-slate-300 cursor-pointer"
              >
                Pulse
              </button>
            </div>
          </div>

          {attachedImage && (
            <div className="inline-flex items-center gap-2 self-start bg-[#0d0f14]/90 border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-cyan-200">
              <img src={attachedImage.dataUrl} alt="Upload preview" className="w-7 h-7 rounded object-cover" />
              <span className="max-w-[180px] truncate">{attachedImage.name}</span>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Command Bar */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-1.5 bg-[#07080b]/92 backdrop-blur-xl border border-cyan-500/35 focus-within:border-cyan-400 rounded-2xl p-1.5 sm:p-2 shadow-[0_0_30px_rgba(0,229,255,0.12)]"
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
              title="Attach photo / circuit"
              className="p-2 rounded-xl text-slate-300 hover:text-cyan-300 hover:bg-white/5 transition"
            >
              <ImagePlus className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ব্রহ্মাকে নির্দেশ দিন (বাংলা / हिन्दी / English)..."
              className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none px-1.5"
            />

            <button
              type="button"
              onClick={() => onNavigate('voice')}
              title="Open Continuous Deep Voice Studio"
              className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/15 transition"
            >
              <Mic className="w-5 h-5" />
            </button>

            <button
              type="submit"
              disabled={isThinking}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#020305] font-bold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <span className="hidden sm:inline">Execute</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
