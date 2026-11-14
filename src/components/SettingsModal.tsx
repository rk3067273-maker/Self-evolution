import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Mic,
  Camera,
  Accessibility,
  Layers,
  Bell,
  Download,
  HardDrive,
  Terminal,
  RefreshCw,
  Sparkles,
  Server,
  Smile,
  Frown,
  Flame,
  RotateCw,
  UserCheck,
  Maximize2,
  MapPinOff,
  VolumeX,
} from 'lucide-react';
import {
  brahmaFetch,
  getBrahmaNative,
  getPermissionStatuses,
  loadBrahmaSettings,
  requestPermissionByKey,
  saveBrahmaSettings,
  verifyServerConnection,
  type AndroidPermissionStatus,
  type BrahmaSettings,
} from '../lib/brahmaClient';
import type { NotchMood } from './DynamicNotchOverlay';

interface SettingsModalProps {
  open: boolean;
  initialTab?: 'api' | 'permissions' | 'notch';
  onClose: () => void;
  onSettingsChanged: (settings: BrahmaSettings) => void;
  onTriggerMood?: (mood: NotchMood, speakDizzy?: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  initialTab = 'api',
  onClose,
  onSettingsChanged,
  onTriggerMood,
}) => {
  const [subTab, setSubTab] = useState<'api' | 'permissions' | 'notch'>(initialTab);
  const [settings, setSettings] = useState<BrahmaSettings>(() => loadBrahmaSettings());

  const [testingServer, setTestingServer] = useState(false);
  const [serverStatus, setServerStatus] = useState<{ ok: boolean; geminiConfigured: boolean; msg: string } | null>(null);

  const [perms, setPerms] = useState<AndroidPermissionStatus | null>(null);
  const [refreshingPerms, setRefreshingPerms] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const checkServerStatus = useCallback(async (urlOverride?: string) => {
    setTestingServer(true);
    try {
      const res = await verifyServerConnection(urlOverride);
      setServerStatus({ ok: res.ok, geminiConfigured: res.geminiConfigured, msg: res.message });
    } finally {
      setTestingServer(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSubTab(initialTab);
      const current = loadBrahmaSettings();
      setSettings(current);
      if (initialTab === 'api') {
        void checkServerStatus(current.serverUrl);
      }
    }
  }, [initialTab, open, checkServerStatus]);

  const refreshPermissions = useCallback(async () => {
    setRefreshingPerms(true);
    try {
      const p = await getPermissionStatuses();
      setPerms(p);
    } finally {
      setRefreshingPerms(false);
    }
  }, []);

  useEffect(() => {
    if (open && subTab === 'permissions') {
      void refreshPermissions();
    }
  }, [open, subTab, refreshPermissions]);

  if (!open) return null;

  const updateField = <K extends keyof BrahmaSettings>(k: K, val: BrahmaSettings[K]) => {
    setSettings((prev) => {
      const next = saveBrahmaSettings({ ...prev, [k]: val });
      onSettingsChanged(next);
      if (k === 'notchScale' && typeof val === 'number') {
        getBrahmaNative()?.updateOverlayScale?.(val);
      }
      return next;
    });
  };

  const handleSaveAssistantName = async () => {
    const cleanName = settings.assistantName.trim() || 'ব্রহ্মা AI';
    updateField('assistantName', cleanName);
    try {
      await brahmaFetch('/api/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistant: {
            name: cleanName,
            application_name: cleanName,
            title: 'Android Companion',
          },
        }),
      });
    } catch {
      // local storage already saved
    }
    setSavedNotice(`অ্যাসিস্ট্যান্টের নতুন নাম "${cleanName}" সেভ করা হয়েছে।`);
    window.setTimeout(() => setSavedNotice(null), 2600);
  };

  const handleTestServer = async () => {
    const updated = saveBrahmaSettings(settings);
    onSettingsChanged(updated);
    await checkServerStatus(settings.serverUrl);
  };

  const handleRequestPerm = async (key: string) => {
    await requestPermissionByKey(key);
    window.setTimeout(() => {
      void refreshPermissions();
    }, 650);
  };

  const handleRequestAllPerms = async () => {
    const native = getBrahmaNative();
    if (native?.requestAllRuntimePermissions) {
      native.requestAllRuntimePermissions();
    } else {
      await requestPermissionByKey('microphone');
      await requestPermissionByKey('camera');
      await requestPermissionByKey('notifications');
    }
    window.setTimeout(() => {
      void refreshPermissions();
    }, 800);
  };

  const permissionItems: Array<{
    key: keyof Omit<AndroidPermissionStatus, 'isNativeAndroid'>;
    reqKey: string;
    title: string;
    desc: string;
    icon: typeof Mic;
    actionLabel: string;
  }> = [
    {
      key: 'microphone',
      reqKey: 'microphone',
      title: 'Microphone (মাইক্রোফোন পারমিশন)',
      desc: 'কন্টিনিউয়াস ভয়েস লিসেনিং, বাংলা/হিন্দি কথা বলা ও লাইভ ভিশন অডিওর জন্য।',
      icon: Mic,
      actionLabel: 'Allow Mic',
    },
    {
      key: 'camera',
      reqKey: 'camera',
      title: 'Camera (ক্যামেরা পারমিশন)',
      desc: 'লাইভ ভিডিও ভিশন ও সার্কিট বোর্ড স্ক্যান করার জন্য।',
      icon: Camera,
      actionLabel: 'Allow Camera',
    },
    {
      key: 'accessibility',
      reqKey: 'accessibility',
      title: 'Accessibility Service (অ্যাসেসিবিলিটি সার্ভিস)',
      desc: 'ভয়েস দিয়ে যেকোনো অ্যাপ খোলা, ব্যাক/হোম নেভিগেশন ও স্ক্রিন অটোমেশনের জন্য।',
      icon: Accessibility,
      actionLabel: 'Open Accessibility',
    },
    {
      key: 'overlay',
      reqKey: 'overlay',
      title: 'Display Over Apps (ডাইনামিক নচ ওভারলে)',
      desc: 'সব অ্যাপের ওপরে ফ্লোটিং চোখ, ইকুয়ালাইজার ও ডাইনামিক নচ দেখানোর জন্য।',
      icon: Layers,
      actionLabel: 'Allow Overlay',
    },
    {
      key: 'notifications',
      reqKey: 'notifications',
      title: 'Notifications (নোটিফিকেশন পারমিশন)',
      desc: 'অটোমেশন অ্যালার্ট ও ব্যাকগ্রাউন্ড ওভারলে সার্ভিস চালু রাখার জন্য।',
      icon: Bell,
      actionLabel: 'Allow Notify',
    },
    {
      key: 'installPackages',
      reqKey: 'installPackages',
      title: 'Install Unknown Apps (APK ইনস্টলার)',
      desc: 'ব্রহ্মার তৈরি নতুন Android অ্যাপ সরাসরি ফোনে ইনস্টল করার জন্য।',
      icon: Download,
      actionLabel: 'Allow Install',
    },
    {
      key: 'storage',
      reqKey: 'storage',
      title: 'Storage & Files (স্টোরেজ ও ফাইল)',
      desc: 'প্রজেক্ট, ডকুমেন্ট, ওয়েবসাইট ও APK ফাইল সেভ/শেয়ার করার জন্য।',
      icon: HardDrive,
      actionLabel: 'Allow Storage',
    },
    {
      key: 'termuxInstalled',
      reqKey: 'termux',
      title: 'Termux Bridge (টারমাক্স পারমিশন)',
      desc: 'ফোনের Termux অ্যাপে সরাসরি bash/node কমান্ড পাঠানোর জন্য।',
      icon: Terminal,
      actionLabel: 'Open Termux Setup',
    },
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#07090e] border border-cyan-500/35 shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-4 py-3 bg-[#0c1018] border-b border-white/10 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Brahma Evo Settings & Permissions</span>
            </h2>
            <p className="text-[11px] text-slate-400">
              সার্ভার কানেকশন, Android অ্যাক্সেসিবিলিটি পারমিশন ও ডাইনামিক নচ কন্ট্রোল
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dedicated Settings Sub-Tabs */}
        <div className="px-3 py-2 bg-[#090c12] border-b border-white/10 flex gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setSubTab('api');
              void checkServerStatus(settings.serverUrl);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap border transition cursor-pointer ${
              subTab === 'api'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-white/5 border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>নাম ও সার্ভার সংযোগ</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('permissions')}
            className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap border transition cursor-pointer ${
              subTab === 'permissions'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-white/5 border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>সব পারমিশন (Permissions)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('notch')}
            className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap border transition cursor-pointer ${
              subTab === 'notch'
                ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                : 'bg-white/5 border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ডাইনামিক নচ ও এক্সপ্রেশন</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {savedNotice && (
            <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200">
              {savedNotice}
            </div>
          )}

          {/* TAB 1: API KEYS, NAME & SERVER */}
          {subTab === 'api' && (
            <div className="space-y-4">
              {/* Custom Assistant Name Card */}
              <div className="p-4 rounded-2xl bg-[#0d111a] border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                    <UserCheck className="w-4 h-4 text-amber-400" />
                    <span>অ্যাসিস্ট্যান্টের নাম পরিবর্তন (Custom Name)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                    {settings.assistantName}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  আপনি নিজের পছন্দমতো ওর নাম রাখতে পারেন (যেমন: ব্রহ্মা, জার্ভিস, মিত্রা, আর্য বা যেকোনো নাম)।
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.assistantName}
                    onChange={(e) => updateField('assistantName', e.target.value)}
                    placeholder="যেমন: ব্রহ্মা AI / আর্য / মিত্রা"
                    className="flex-1 bg-[#06080c] border border-white/15 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveAssistantName()}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#020305] font-bold text-xs whitespace-nowrap cursor-pointer"
                  >
                    নাম সেভ করুন
                  </button>
                </div>
              </div>

              {/* Optional Server Backend URL (for Standalone Android APK) */}
              <div className="p-4 rounded-2xl bg-[#0d111a] border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span>Backend Server URL (Android APK রিমোট সিঙ্ক)</span>
                </div>
                <p className="text-xs text-slate-400">
                  ওয়েবে ব্যবহার করলে এটি ফাঁকা রাখুন। শুধুমাত্র Android APK থেকে আপনার হোস্ট করা ব্রহ্মা সার্ভারে যুক্ত হতে হলে নিচে সার্ভার URL দিন।
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={settings.serverUrl}
                    onChange={(e) => updateField('serverUrl', e.target.value)}
                    placeholder="https://your-brahma-server.run.app"
                    className="flex-1 bg-[#06080c] border border-white/15 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleTestServer()}
                    disabled={testingServer}
                    className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-[#020305] font-bold text-xs whitespace-nowrap cursor-pointer"
                  >
                    {testingServer ? 'Testing...' : 'Verify Server'}
                  </button>
                </div>

                {serverStatus && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                      serverStatus.ok && serverStatus.geminiConfigured
                        ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200'
                        : 'bg-amber-500/10 border-amber-400/40 text-amber-200'
                    }`}
                  >
                    {serverStatus.ok && serverStatus.geminiConfigured ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <span>{serverStatus.msg}</span>
                  </div>
                )}
              </div>

              {/* Smart Home & Weather Integration Keys */}
              <div className="p-4 rounded-2xl bg-[#0d111a] border border-white/10 space-y-3">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Extra Automation & Smart Home API (ঐচ্ছিক)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Smart Home / Home Assistant URL</label>
                    <input
                      type="text"
                      value={settings.smartHomeBridgeUrl}
                      onChange={(e) => updateField('smartHomeBridgeUrl', e.target.value)}
                      placeholder="http://homeassistant.local:8123"
                      className="w-full bg-[#06080c] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Smart Home / Tuya Access Token</label>
                    <input
                      type="password"
                      value={settings.smartHomeToken}
                      onChange={(e) => updateField('smartHomeToken', e.target.value)}
                      placeholder="Bearer token..."
                      className="w-full bg-[#06080c] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    saveBrahmaSettings(settings);
                    setSavedNotice('সব API ও ব্রিজ কনফিগারেশন ফোনে সেভ করা হয়েছে।');
                    window.setTimeout(() => setSavedNotice(null), 2600);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white cursor-pointer"
                >
                  Save Extra Config
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ALL PERMISSIONS */}
          {subTab === 'permissions' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-emerald-100">
                  ব্রহ্মার ভয়েস, ক্যামেরা, অ্যাক্সেসিবিলিটি অটোমেশন ও ফ্লোটিং নচ ব্যবহার করতে নিচের পারমিশনগুলো Allow করুন।
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshPermissions()}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingPerms ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRequestAllPerms()}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#020305] font-bold text-xs cursor-pointer"
                  >
                    Allow All Runtime
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {permissionItems.map((item) => {
                  const Icon = item.icon;
                  const granted = perms ? Boolean(perms[item.key]) : false;
                  return (
                    <div
                      key={item.reqKey}
                      className="p-3 rounded-xl bg-[#0d111a] border border-white/10 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`p-2 rounded-lg border shrink-0 ${
                            granted
                              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                              : 'bg-amber-500/10 border-amber-400/30 text-amber-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">{item.title}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                granted
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-200'
                              }`}
                            >
                              {granted ? 'Allowed' : 'Permission Needed'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleRequestPerm(item.reqKey)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition ${
                          granted
                            ? 'bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200'
                            : 'bg-cyan-400 hover:bg-cyan-300 text-[#020305]'
                        }`}
                      >
                        {granted ? 'Configure' : item.actionLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DYNAMIC NOTCH, SIZE, SILENCE & MOODS */}
          {subTab === 'notch' && (
            <div className="space-y-4">
              {/* Movable Cursor / Notch Size & Position Controls */}
              <div className="p-4 rounded-2xl bg-[#0d111a] border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                    <Maximize2 className="w-4 h-4 text-cyan-400" />
                    <span>কার্সার / ডাইনামিক নচ সাইজ ও পজিশন</span>
                  </div>
                  <span className="text-xs font-mono text-cyan-300 font-bold">
                    {Math.round(settings.notchScale * 100)}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  ডাইনামিক নচ/কার্সার আঙুল বা মাউস দিয়ে ধরে স্ক্রিনের যেকোনো কোণায় সরাতে পারবেন এবং নিচের স্লাইডার দিয়ে ছোট-বড় করতে পারবেন।
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateField('notchScale', Math.max(0.55, Number((settings.notchScale - 0.08).toFixed(2))))}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white cursor-pointer"
                  >
                    − ছোট
                  </button>
                  <input
                    type="range"
                    min={0.55}
                    max={1.35}
                    step={0.03}
                    value={settings.notchScale}
                    onChange={(e) => updateField('notchScale', parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('notchScale', Math.min(1.35, Number((settings.notchScale + 0.08).toFixed(2))))}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white cursor-pointer"
                  >
                    + বড়
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => updateField('notchScale', 0.82)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 cursor-pointer"
                  >
                    ডিফল্ট সাইজ (82%)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('notchPosition', null)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-[11px] text-cyan-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MapPinOff className="w-3.5 h-3.5" />
                    <span>পজিশন রিসেট (Top Center)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0d111a] border border-purple-500/30 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Voice Silence & Dynamic Notch Behaviour
                </h3>

                <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#06080c] border border-emerald-500/25 cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <VolumeX className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        শুধু আমি কথা বললেই উত্তর দেবে (Silent Until You Speak)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        চালু থাকলে নিজে থেকে একা একা কথা বলবে না — আপনি কথা বললে বা প্রশ্ন করলেই শুধু কথা বলবে, তার আগে চুপচাপ থাকবে।
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.silentUntilUserSpeaks}
                    onChange={(e) => updateField('silentUntilUserSpeaks', e.target.checked)}
                    className="w-4 h-4 accent-emerald-400"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#06080c] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-white">Natural Mood Expressions (Sad, Angry, Happy)</div>
                    <div className="text-[11px] text-slate-400">
                      মাঝেমধ্যে ডাইনামিক নচের চোখ ও ভ্রুতে স্যাড, রাগী ও খুশির এক্সপ্রেশন দেখাবে।
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notchExpressions}
                    onChange={(e) => updateField('notchExpressions', e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#06080c] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Dizzy Spin Reaction (চোখ ঘোরার এক্সপ্রেশন)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      স্ক্রিনে আঙুল রেখে দ্রুত গিজিমিজি করলে চোখে চক্কর দেখাবে।
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.dizzyReaction}
                    onChange={(e) => updateField('dizzyReaction', e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#06080c] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-white">Accessibility Voice Automation</div>
                    <div className="text-[11px] text-slate-400">
                      "অ্যাপ খোলো", "ব্যাক করো", "হোমে যাও" বললেই Android Accessibility দিয়ে অটোমেটিক কাজ করবে।
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.accessibilityAutomation}
                    onChange={(e) => updateField('accessibilityAutomation', e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>
              </div>

              {onTriggerMood && (
                <div className="p-4 rounded-2xl bg-[#0d111a] border border-white/10 space-y-2.5">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Test Dynamic Notch Expressions Live
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => onTriggerMood('happy')}
                      className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-xs text-cyan-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Smile className="w-3.5 h-3.5" />
                      <span>Happy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTriggerMood('sad')}
                      className="px-3 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 text-xs text-blue-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Frown className="w-3.5 h-3.5" />
                      <span>Sad</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTriggerMood('angry')}
                      className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-xs text-rose-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Angry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTriggerMood('dizzy', true)}
                      className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-xs text-amber-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Dizzy (মাথা ঘোরা)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
