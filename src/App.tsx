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
  loadBrahmaSettings,
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
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>('deep-voinkor');
  const [continuousListening, setContinuousListening] = useState<boolean>(true);
  const [autoSpeakReply, setAutoSpeakReply] = useState<boolean>(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [activeCircuit, setActiveCircuit] = useState<CircuitSchematic | null>(null);
  const [pendingGlobeAction, setPendingGlobeAction] = useState<Record<string, unknown> | null>(null);
  const [voiceLevel, setVoiceLevel] = useState<number>(0.06);
  const [popupVisible, setPopupVisible] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'api' | 'permissions' | 'notch'>('api');
  const [appSettings, setAppSettings] = useState<BrahmaSettings>(() => loadBrahmaSettings());
  const [forcedNotchMood, setForcedNotchMood] = useState<{ mood: NotchMood; ts: number } | null>(null);
  const [terminalState, setTerminalState] = useState<TerminalState>({
    running: false,
    currentTask: '',
    cwd: '~',
    lines: [],
    projects: [],
  });

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const levelIntervalRef = useRef<number>(0);

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
      const pitch = voiceProfile === 'deep-voinkor' ? 0.68 : voiceProfile === 'commanding' ? 0.78 : 0.85;
      const native = getBrahmaNative();

      setOrbState('SPEAKING');
      onStart?.();
      levelIntervalRef.current = window.setInterval(() => {
        const lvl = 0.34 + Math.random() * 0.56;
        setVoiceLevel(lvl);
        onLevel?.(lvl);
      }, 80);

      if (native?.speakDeepVoice?.(clean, langTag, pitch, 0.94)) {
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
          const u = new SpeechSynthesisUtterance(clean);
          u.lang = langTag;
          u.pitch = pitch;
          u.rate = 0.94;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          window.speechSynthesis.speak(u);
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
        const data = await res.json();
        if (data.useNativeTts || !res.ok || !data.audioBase64) {
          await speakWithDeviceTts(clean, onStart, onEnd, onLevel);
          return;
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
    [languageMode, speakWithDeviceTts, stopSpeaking, voiceProfile]
  );

  const handleSendMessage = useCallback(
    async (
      text: string,
      imageBase64?: string,
      imageMimeType?: string,
      skipAutoSpeak = false
    ): Promise<string> => {
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
            imageBase64,
            imageMimeType,
            history: messages.slice(-8).map((m) => ({ role: m.role, text: m.text })),
          }),
        });
        const data = await res.json();
        const replyText = res.ok
          ? String(data.reply || 'নির্দেশ সম্পন্ন হয়েছে।')
          : String(data.error || 'Brahma Core encountered an error.');

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
    [autoSpeakReply, languageMode, messages, refreshBriefing, refreshTerminalState, speakDeepVoice]
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
        forcedMood={forcedNotchMood}
        onDizzyTriggered={(phrase) => {
          void speakDeepVoice(phrase);
        }}
        onTogglePopup={() => {
          setPopupVisible((v) => !v);
          refreshTerminalState();
        }}
      />

      {/* Reserved Top Notch Gutter so header controls never collide with Dynamic Notch */}
      <div className="shrink-0 h-11 bg-[#020305]" />

      {/* Top Android Companion Header */}
      <header className="shrink-0 h-14 px-3 sm:px-4 bg-[#07080b]/95 border-b border-cyan-500/20 flex items-center justify-between gap-2 z-30">
        <div className="flex items-center gap-2 shrink-0">
          <img
            src="/brahma-assets/brahma_evo_logo.png"
            alt="Brahma AI Evo"
            className="w-8 h-8 rounded-lg object-contain border border-cyan-500/30 bg-[#0d0f14] p-0.5"
          />
          <div>
            <div className="text-xs sm:text-sm font-extrabold tracking-widest uppercase text-white leading-none">
              BRAHMA <span className="text-cyan-400">EVO</span>
            </div>
            <div className="text-[9px] text-emerald-400 tracking-wider uppercase mt-0.5 font-semibold">
              Android Edition
            </div>
          </div>
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
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap border transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-200 shadow-[0_0_16px_rgba(0,229,255,0.15)]'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-cyan-400' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            onClick={() => {
              setSettingsInitialTab('api');
              setSettingsOpen(true);
            }}
            title="Settings, API Keys & Android Permissions"
            className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d0f14] border border-cyan-500/25">
            <span
              className={`w-2 h-2 rounded-full ${
                orbState === 'THINKING'
                  ? 'bg-amber-400 animate-pulse'
                  : orbState === 'SPEAKING'
                    ? 'bg-rose-400 animate-ping'
                    : orbState === 'EXECUTING'
                      ? 'bg-emerald-400 animate-ping'
                      : 'bg-cyan-400'
              }`}
            />
            <span className="text-[10px] font-mono tracking-wider text-cyan-200">{orbState}</span>
          </div>
        </div>
      </header>

      {/* Main Module Viewport */}
      <main className="flex-1 min-h-0 relative">
        {activeTab === 'command' && (
          <NeuralCommandCenter
            orbState={orbState}
            setOrbState={setOrbState}
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
            languageMode={languageMode}
            setLanguageMode={setLanguageMode}
            voiceProfile={voiceProfile}
            setVoiceProfile={setVoiceProfile}
            continuousListening={continuousListening}
            setContinuousListening={setContinuousListening}
            onSendMessage={(txt) => handleSendMessage(txt, undefined, undefined, true)}
            onSpeakDeepVoice={speakDeepVoice}
            onStopSpeaking={stopSpeaking}
            onVoiceLevel={setVoiceLevel}
          />
        )}

        {activeTab === 'vision' && (
          <LiveVisionPanel languageMode={languageMode} voiceProfile={voiceProfile} />
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

        {activeTab === 'remote' && <RemoteAndIdentityPanel />}
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
        onSettingsChanged={(next) => setAppSettings(next)}
        onTriggerMood={(mood, speakDizzy) => {
          setForcedNotchMood({ mood, ts: Date.now() });
          if (speakDizzy) {
            void speakDeepVoice('উফফ! আমার মাথা ঘুরছে! এতো জোরে আঙুল ঘোরাবেন না!');
          }
        }}
      />

      <OfflineIndicator />
    </div>
  );
}
