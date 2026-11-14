import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Terminal,
  TerminalSquare,
  Mic,
  Eye,
  Workflow,
  Globe2,
  Cpu,
  Sparkles,
  Home,
  Smartphone,
  Settings,
} from 'lucide-react';
import type {
  BrahmaTab,
  BriefingData,
  ChatMessage,
  CircuitSchematic,
  LanguageMode,
  OrbState,
  TerminalState,
  VoiceProfile,
} from './types/brahma';
import { NeuralCommandCenter } from './components/NeuralCommandCenter';
import { LiveVoiceStudio } from './components/LiveVoiceStudio';
import { LiveVisionPanel } from './components/LiveVisionPanel';
import { TermuxAndApkPanel } from './components/TermuxAndApkPanel';
import { DynamicNotchOverlay, type NotchMood } from './components/DynamicNotchOverlay';
import { TerminalPopupWindow } from './components/TerminalPopupWindow';
import { AutomationPanel } from './components/AutomationPanel';
import { HoloGlobePanel } from './components/HoloGlobePanel';
import { CircuitHudPanel } from './components/CircuitHudPanel';
import { SkillForgePanel } from './components/SkillForgePanel';
import { SmartHomeAndOfficePanel } from './components/SmartHomeAndOfficePanel';
import { RemoteAndIdentityPanel } from './components/RemoteAndIdentityPanel';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { SettingsModal } from './components/SettingsModal';
import {
  brahmaFetch,
  getBrahmaNative,
  getVoiceOption,
  loadBrahmaSettings,
  saveBrahmaSettings,
  type BrahmaSettings,
} from './lib/brahmaClient';

const NAV_ITEMS: { id: BrahmaTab; label: string; shortLabel: string; icon: typeof Terminal }[] = [
  { id: 'command', label: 'Neural Core', shortLabel: 'Core', icon: Terminal },
  { id: 'voice', label: 'Deep Voice', shortLabel: 'Voice', icon: Mic },
  { id: 'vision', label: 'Live Vision', shortLabel: 'Vision', icon: Eye },
  { id: 'terminal', label: 'Termux & APK', shortLabel: 'Termux', icon: TerminalSquare },
  { id: 'automation', label: 'Automation', shortLabel: 'Auto', icon: Workflow },
  { id: 'globe', label: 'HoloGlobe', shortLabel: 'Globe', icon: Globe2 },
  { id: 'circuit', label: 'Circuit HUD', shortLabel: 'Circuit', icon: Cpu },
  { id: 'skills', label: 'Skill Forge', shortLabel: 'Forge', icon: Sparkles },
  { id: 'smart-office', label: 'Home & Office', shortLabel: 'Home', icon: Home },
  { id: 'remote', label: 'Remote & Memory', shortLabel: 'Remote', icon: Smartphone },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<BrahmaTab>('command');
  const [orbState, setOrbState] = useState<OrbState>('ONLINE');
  const [languageMode, setLanguageMode] = useState<LanguageMode>('bn');
  const [appSettings, setAppSettings] = useState<BrahmaSettings>(() => loadBrahmaSettings());
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>(() => loadBrahmaSettings().voiceProfile);
  const [continuousListening, setContinuousListening] = useState<boolean>(false);
  const [autoSpeakReply, setAutoSpeakReply] = useState<boolean>(true);

  const handleVoiceProfileChange = useCallback((vp: VoiceProfile) => {
    setVoiceProfile(vp);
    setAppSettings(saveBrahmaSettings({ voiceProfile: vp }));
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [activeCircuit, setActiveCircuit] = useState<CircuitSchematic | null>(null);
  const [pendingGlobeAction, setPendingGlobeAction] = useState<Record<string, unknown> | null>(null);
  const [voiceLevel, setVoiceLevel] = useState<number>(0.06);
  const [popupVisible, setPopupVisible] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'api' | 'permissions' | 'notch'>('api');
  const [forcedNotchMood, setForcedNotchMood] = useState<{ mood: NotchMood; ts: number } | null>(null);
  const [terminalState, setTerminalState] = useState<TerminalState>({
    running: false,
    currentTask: '',
    cwd: '~',
    lines: [],
    projects: [],
  });

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const levelIntervalRef = useRef<number>(0);

  const unlockAudioPlayback = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const onGesture = () => {
      unlockAudioPlayback();
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [unlockAudioPlayback]);

  const refreshTerminalState = useCallback(() => {
    brahmaFetch('/api/terminal/state')
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.lines)) {
          setTerminalState(d as TerminalState);
        }
      })
      .catch(() => {});
  }, []);

  const refreshBriefing = useCallback(() => {
    brahmaFetch('/api/briefing')
      .then((r) => r.json())
      .then((d) => setBriefing(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshBriefing();
    refreshTerminalState();
  }, [refreshBriefing, refreshTerminalState]);

  useEffect(() => {
    if (!terminalState.running && !popupVisible) return;
    const id = window.setInterval(refreshTerminalState, 1500);
    return () => window.clearInterval(id);
  }, [popupVisible, refreshTerminalState, terminalState.running]);

  const handleRunTerminalCommand = useCallback(async (cmd: string) => {
    setOrbState('EXECUTING');
    try {
      const res = await brahmaFetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const d = await res.json();
      if (d && Array.isArray(d.lines)) {
        setTerminalState({
          running: false,
          currentTask: '',
          cwd: d.cwd || '~',
          lines: d.lines,
          projects: d.projects || [],
        });
      }
    } finally {
      setOrbState('ONLINE');
    }
  }, []);

  const handleRunTerminalAgent = useCallback(
    async (task: string) => {
      setOrbState('EXECUTING');
      setTerminalState((prev) => ({ ...prev, running: true, currentTask: task }));
      try {
        const res = await brahmaFetch('/api/terminal/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task, languageMode }),
        });
        const d = await res.json();
        if (d && Array.isArray(d.lines)) {
          setTerminalState({
            running: false,
            currentTask: '',
            cwd: d.cwd || '~',
            lines: d.lines,
            projects: d.projects || [],
          });
        }
      } finally {
        setOrbState('ONLINE');
      }
    },
    [languageMode]
  );

  const handleClearTerminal = useCallback(async () => {
    const res = await brahmaFetch('/api/terminal/clear', { method: 'POST' });
    const d = await res.json();
    if (d && Array.isArray(d.lines)) {
      setTerminalState((prev) => ({ ...prev, lines: d.lines }));
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    window.clearInterval(levelIntervalRef.current);
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.onended = null;
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      audioSourceRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    getBrahmaNative()?.stopNativeVoice?.();
  }, []);

  const speakWithDeviceTts = useCallback(
    async (
      clean: string,
      onStart?: () => void,
      onEnd?: () => void,
      onLevel?: (lvl: number) => void
    ) => {
      const langTag = languageMode === 'hi' ? 'hi-IN' : languageMode === 'en' ? 'en-US' : 'bn-IN';
      const voiceOpt = getVoiceOption(voiceProfile);
      const pitch = voiceOpt.nativePitch;
      const rate = voiceOpt.nativeRate;
      const native = getBrahmaNative();

      setOrbState('SPEAKING');
      onStart?.();
      levelIntervalRef.current = window.setInterval(() => {
        const lvl = 0.34 + Math.random() * 0.56;
        setVoiceLevel(lvl);
        onLevel?.(lvl);
      }, 80);

      if (native?.speakDeepVoice?.(clean, langTag, pitch, rate)) {
        const estMs = Math.min(9000, Math.max(1800, clean.length * 68));
        await new Promise((r) => window.setTimeout(r, estMs));
        window.clearInterval(levelIntervalRef.current);
        setVoiceLevel(0.05);
        onLevel?.(0.05);
        setOrbState('ONLINE');
        onEnd?.();
        return;
      }

      if (window.speechSynthesis) {
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(guardId);
            resolve();
          };
          const guardId = window.setTimeout(
            finish,
            Math.min(14000, Math.max(3200, clean.length * 140))
          );

          try {
            const u = new SpeechSynthesisUtterance(clean);
            u.lang = langTag;
            u.pitch = pitch;
            u.rate = rate;
            const voices = window.speechSynthesis.getVoices();
            const langPrefix = langTag.split('-')[0].toLowerCase();
            const matchingLangVoices = voices.filter((v) =>
              v.lang.toLowerCase().startsWith(langPrefix)
            );
            if (matchingLangVoices.length > 0) {
              const wantFemale = voiceOpt.gender === 'female';
              const gendered = matchingLangVoices.find((v) => {
                const n = v.name.toLowerCase();
                return wantFemale
                  ? /female|woman|girl|lekha|kalpana|heera|swara|tanvi|aditi|raveena|priya|ananya/.test(n)
                  : /male|man|prabhat|madhur|hemant|rishi|bashkar|neel|arjun/.test(n);
              });
              u.voice = gendered || matchingLangVoices[0];
            }
            u.onend = finish;
            u.onerror = finish;
            window.speechSynthesis.speak(u);
          } catch {
            finish();
          }
        });
      }

      window.clearInterval(levelIntervalRef.current);
      setVoiceLevel(0.05);
      onLevel?.(0.05);
      setOrbState('ONLINE');
      onEnd?.();
    },
    [languageMode, voiceProfile]
  );

  const speakDeepVoice = useCallback(
    async (
      text: string,
      onStart?: () => void,
      onEnd?: () => void,
      onLevel?: (lvl: number) => void
    ) => {
      stopSpeaking();
      const clean = text.trim();
      if (!clean) {
        onEnd?.();
        return;
      }

      const ctx = unlockAudioPlayback();

      try {
        const res = await brahmaFetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            voiceProfile,
            languageMode,
          }),
        });
        const raw = await res.text();
        let data: { useNativeTts?: boolean; audioBase64?: string; mimeType?: string } = {};
        try {
          data = raw ? (JSON.parse(raw) as typeof data) : {};
        } catch {
          data = {};
        }
        if (data.useNativeTts || !res.ok || !data.audioBase64) {
          await speakWithDeviceTts(clean, onStart, onEnd, onLevel);
          return;
        }

        // Primary: Play Gemini 3.8 WAV via unlocked Web AudioContext (bypasses async HTMLAudio blocks on Android Chrome)
        if (ctx) {
          try {
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }
            const bin = atob(data.audioBase64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            analyser.connect(ctx.destination);
            audioSourceRef.current = source;

            const freqData = new Uint8Array(analyser.frequencyBinCount);
            setOrbState('SPEAKING');
            onStart?.();
            levelIntervalRef.current = window.setInterval(() => {
              analyser.getByteFrequencyData(freqData);
              let sum = 0;
              for (let i = 0; i < freqData.length; i++) sum += freqData[i];
              const lvl = Math.min(1, Math.max(0.18, sum / freqData.length / 135));
              setVoiceLevel(lvl);
              onLevel?.(lvl);
            }, 60);

            await new Promise<void>((resolve) => {
              source.onended = () => {
                window.clearInterval(levelIntervalRef.current);
                audioSourceRef.current = null;
                setVoiceLevel(0.05);
                onLevel?.(0.05);
                setOrbState('ONLINE');
                onEnd?.();
                resolve();
              };
              source.start(0);
            });
            return;
          } catch {
            // fall through to HTMLAudio element fallback
          }
        }

        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        currentAudioRef.current = audio;

        audio.onplay = () => {
          setOrbState('SPEAKING');
          onStart?.();
          levelIntervalRef.current = window.setInterval(() => {
            const lvl = 0.32 + Math.random() * 0.58;
            setVoiceLevel(lvl);
            onLevel?.(lvl);
          }, 75);
        };

        await new Promise<void>((resolve) => {
          audio.onended = () => {
            window.clearInterval(levelIntervalRef.current);
            setVoiceLevel(0.05);
            onLevel?.(0.05);
            setOrbState('ONLINE');
            onEnd?.();
            resolve();
          };
          audio.onerror = () => {
            window.clearInterval(levelIntervalRef.current);
            setVoiceLevel(0.05);
            onLevel?.(0.05);
            setOrbState('ONLINE');
            onEnd?.();
            resolve();
          };
          audio.play().catch(() => {
            window.clearInterval(levelIntervalRef.current);
            void speakWithDeviceTts(clean, onStart, onEnd, onLevel).then(resolve);
          });
        });
      } catch {
        await speakWithDeviceTts(clean, onStart, onEnd, onLevel);
      }
    },
    [languageMode, speakWithDeviceTts, stopSpeaking, unlockAudioPlayback, voiceProfile]
  );

  const handleSendMessage = useCallback(
    async (
      text: string,
      imageBase64?: string,
      imageMimeType?: string,
      skipAutoSpeak = false
    ): Promise<string> => {
      unlockAudioPlayback();
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: text || 'সংযুক্ত ছবি বিশ্লেষণ করো',
        imagePreview: imageBase64,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);
      setOrbState('THINKING');

      try {
        const res = await brahmaFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            languageMode,
            assistantName: appSettings.assistantName,
            imageBase64,
            imageMimeType,
            history: messages.slice(-8).map((m) => ({ role: m.role, text: m.text })),
          }),
        });
        const rawBody = await res.text();
        let data: {
          reply?: string;
          error?: string;
          popupAction?: 'show' | 'hide';
          moduleToOpen?: string;
          toolPayload?: unknown;
          automationExecuted?: ChatMessage['automationExecuted'];
          intent?: string;
          orbState?: string;
          tier?: number;
          latencyMs?: number;
        } = {};
        try {
          data = rawBody ? (JSON.parse(rawBody) as typeof data) : {};
        } catch {
          data = { error: `Server returned HTTP ${res.status}` };
        }
        const replyText = res.ok
          ? String(data.reply || 'উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।')
          : String(data.error || `Brahma Core returned HTTP ${res.status}`);

        if (res.ok) {
          if (data.popupAction === 'show') {
            setPopupVisible(true);
            refreshTerminalState();
          } else if (data.popupAction === 'hide') {
            setPopupVisible(false);
          }

          if (data.moduleToOpen === 'circuit' && data.toolPayload) {
            setActiveCircuit(data.toolPayload as CircuitSchematic);
          } else if (data.moduleToOpen === 'globe' && data.toolPayload) {
            setPendingGlobeAction(data.toolPayload as Record<string, unknown>);
          } else if (data.moduleToOpen === 'terminal') {
            refreshTerminalState();
          }

          if (data.automationExecuted || data.intent === 'smart_home') {
            refreshBriefing();
          }
          setOrbState((data.orbState as OrbState) || 'SPEAKING');
        } else {
          setOrbState('IDLE');
        }

        const aiMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          tier: data.tier,
          intent: data.intent,
          latencyMs: data.latencyMs,
          moduleToOpen: data.moduleToOpen,
          popupAction: data.popupAction,
          automationExecuted: data.automationExecuted,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);

        if (autoSpeakReply && !skipAutoSpeak && res.ok) {
          void speakDeepVoice(replyText);
        } else {
          window.setTimeout(() => setOrbState('ONLINE'), 2000);
        }
        return replyText;
      } catch {
        const fallback = 'ব্রহ্মা নিউরাল কোরের সাথে সংযোগ স্থাপন করা যায়নি।';
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: fallback,
            timestamp: new Date().toISOString(),
          },
        ]);
        setOrbState('IDLE');
        return fallback;
      } finally {
        setIsThinking(false);
      }
    },
    [appSettings.assistantName, autoSpeakReply, languageMode, messages, refreshBriefing, refreshTerminalState, speakDeepVoice, unlockAudioPlayback]
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-[#020305] text-[#f4f6f8] overflow-hidden">
      {/* Dynamic Notch Floating Eye-Tracking, Mood Expressions & Dizzy Overlay */}
      <DynamicNotchOverlay
        orbState={orbState}
        voiceLevel={voiceLevel}
        terminalRunning={terminalState.running}
        popupVisible={popupVisible}
        expressionsEnabled={appSettings.notchExpressions}
        dizzyEnabled={appSettings.dizzyReaction}
        silentUntilUserSpeaks={appSettings.silentUntilUserSpeaks}
        scale={appSettings.notchScale}
        position={appSettings.notchPosition}
        onPositionChange={(pos) => setAppSettings(saveBrahmaSettings({ notchPosition: pos }))}
        forcedMood={forcedNotchMood}
        onDizzyTriggered={(phrase) => {
          if (!appSettings.silentUntilUserSpeaks) {
            void speakDeepVoice(phrase);
          }
        }}
        onTogglePopup={() => {
          setPopupVisible((v) => !v);
          refreshTerminalState();
        }}
      />

      {/* Reserved Top Notch Gutter so header controls never collide with Dynamic Notch */}
      <div className="shrink-0 h-11 bg-[#020305]" />

      {/* Top Android Companion Header */}
      <header className="shrink-0 h-14 px-3 sm:px-5 bg-[#070a10] border-b border-white/10 flex items-center justify-between gap-4 z-30">
        <div className="flex items-center gap-2.5 shrink-0">
          <img
            src="/brahma-assets/brahma_evo_logo.png"
            alt={appSettings.assistantName || 'Brahma AI'}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-contain border border-white/15 bg-[#0d121c] p-0.5 shrink-0"
          />
          <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            {appSettings.assistantName || 'ব্রহ্মা AI'}
          </span>
        </div>

        {/* Desktop / Tablet Top Nav */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto py-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/40'
                    : 'bg-transparent border border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-cyan-400' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            onClick={() => {
              setSettingsInitialTab('api');
              setSettingsOpen(true);
            }}
            title="Settings, Server & Android Permissions"
            className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#020305] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Main Module Viewport */}
      <main className="flex-1 min-h-0 relative">
        {activeTab === 'command' && (
          <NeuralCommandCenter
            assistantName={appSettings.assistantName}
            orbState={orbState}
            setOrbState={setOrbState}
            voiceLevel={voiceLevel}
            messages={messages}
            onSendMessage={async (text, img, mime) => {
              await handleSendMessage(text, img, mime, false);
            }}
            isThinking={isThinking}
            briefing={briefing}
            onNavigate={setActiveTab}
            languageMode={languageMode}
            setLanguageMode={setLanguageMode}
            autoSpeakReply={autoSpeakReply}
            setAutoSpeakReply={setAutoSpeakReply}
            onSpeakDeepVoice={(txt) => speakDeepVoice(txt)}
          />
        )}

        {activeTab === 'voice' && (
          <LiveVoiceStudio
            assistantName={appSettings.assistantName}
            languageMode={languageMode}
            setLanguageMode={setLanguageMode}
            voiceProfile={voiceProfile}
            setVoiceProfile={handleVoiceProfileChange}
            continuousListening={continuousListening}
            setContinuousListening={setContinuousListening}
            silentUntilUserSpeaks={appSettings.silentUntilUserSpeaks}
            onSendMessage={(txt) => handleSendMessage(txt, undefined, undefined, true)}
            onSpeakDeepVoice={speakDeepVoice}
            onStopSpeaking={stopSpeaking}
            onVoiceLevel={setVoiceLevel}
            onOrbStateChange={setOrbState}
          />
        )}

        {activeTab === 'vision' && (
          <LiveVisionPanel
            assistantName={appSettings.assistantName}
            languageMode={languageMode}
            voiceProfile={voiceProfile}
            silentUntilUserSpeaks={appSettings.silentUntilUserSpeaks}
          />
        )}

        {activeTab === 'terminal' && (
          <TermuxAndApkPanel
            languageMode={languageMode}
            terminalState={terminalState}
            onRunCommand={handleRunTerminalCommand}
            onRunAgent={handleRunTerminalAgent}
            onShowPopup={() => {
              setPopupVisible(true);
              refreshTerminalState();
            }}
          />
        )}

        {activeTab === 'automation' && (
          <AutomationPanel
            languageMode={languageMode}
            onSpeakDeepVoice={(txt) => speakDeepVoice(txt)}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'globe' && (
          <HoloGlobePanel
            pendingAction={pendingGlobeAction}
            onActionHandled={() => setPendingGlobeAction(null)}
          />
        )}

        {activeTab === 'circuit' && <CircuitHudPanel externalSchematic={activeCircuit} />}

        {activeTab === 'skills' && <SkillForgePanel />}

        {activeTab === 'smart-office' && <SmartHomeAndOfficePanel />}

        {activeTab === 'remote' && (
          <RemoteAndIdentityPanel
            onAssistantNameChanged={(name) =>
              setAppSettings(saveBrahmaSettings({ assistantName: name }))
            }
          />
        )}
      </main>

      {/* Android Mobile Bottom Navigation Bar */}
      <nav className="md:hidden shrink-0 bg-[#07080b]/95 border-t border-cyan-500/20 px-1 py-1.5 flex items-center justify-around overflow-x-auto z-30">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                navigator.vibrate?.(10);
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl min-w-[56px] transition cursor-pointer ${
                active ? 'text-cyan-300 bg-cyan-500/15' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-semibold tracking-tight">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <TerminalPopupWindow
        visible={popupVisible}
        onHide={() => setPopupVisible(false)}
        terminalState={terminalState}
        onRunCommand={handleRunTerminalCommand}
        onRunAgent={handleRunTerminalAgent}
        onClear={handleClearTerminal}
      />

      <SettingsModal
        open={settingsOpen}
        initialTab={settingsInitialTab}
        onClose={() => setSettingsOpen(false)}
        onSettingsChanged={(next) => {
          setAppSettings(next);
          setVoiceProfile(next.voiceProfile);
        }}
        onTriggerMood={(mood, speakDizzy) => {
          setForcedNotchMood({ mood, ts: Date.now() });
          if (speakDizzy && !appSettings.silentUntilUserSpeaks) {
            void speakDeepVoice('উফফ! আমার মাথা ঘুরছে! এতো জোরে আঙুল ঘোরাবেন না!');
          }
        }}
      />

      <OfflineIndicator />
    </div>
  );
}
