import type {
  AutomationExecutionResult,
  AutomationWorkflow,
  BriefingData,
  CircuitSchematic,
  IdentityState,
  LanguageMode,
  MemoryItem,
  OrbState,
  SkillEntry,
  SmartDevice,
  TerminalState,
  VoiceGender,
  VoiceProfile,
} from '../types/brahma';

export interface VoiceOption {
  id: VoiceProfile;
  gender: VoiceGender;
  tone: 'hard' | 'soft';
  labelBn: string;
  labelEn: string;
  geminiVoice: 'Charon' | 'Fenrir' | 'Puck' | 'Kore' | 'Zephyr';
  nativePitch: number;
  nativeRate: number;
  stylePrompt: string;
}

export const VOICE_CATALOG: VoiceOption[] = [
  {
    id: 'male-deep-hard',
    gender: 'male',
    tone: 'hard',
    labelBn: 'বজ্রকণ্ঠ (ডিপ ও কঠিন গলা)',
    labelEn: 'Deep Hard Bass',
    geminiVoice: 'Charon',
    nativePitch: 0.66,
    nativeRate: 0.92,
    stylePrompt:
      'Speak like an authentic adult Bengali or Hindi man with a very deep, heavy, resonant, firm baritone voice. Use 100% natural native South Asian pronunciation, human pauses, and crisp consonants with zero English or Western accent.',
  },
  {
    id: 'male-commanding',
    gender: 'male',
    tone: 'hard',
    labelBn: 'সেনাপতি (ভারী ও দৃঢ় গলা)',
    labelEn: 'Commanding Firm Male',
    geminiVoice: 'Fenrir',
    nativePitch: 0.76,
    nativeRate: 0.95,
    stylePrompt:
      'Speak like a confident, serious native Bengali or Hindi man with a strong, gravelly, authoritative voice. Natural human cadence and completely native Bengali/Hindi articulation with zero foreign drawl.',
  },
  {
    id: 'male-soft-warm',
    gender: 'male',
    tone: 'soft',
    labelBn: 'সৌম্য (নরম ও মিষ্টি পুরুষ গলা)',
    labelEn: 'Soft Warm Male',
    geminiVoice: 'Puck',
    nativePitch: 0.94,
    nativeRate: 0.96,
    stylePrompt:
      'Speak like a kind, friendly, soft-spoken native Bengali or Hindi man with a gentle, warm, conversational human voice. Natural everyday Bengali/Hindi tone with zero English accent.',
  },
  {
    id: 'male-gentle',
    gender: 'male',
    tone: 'soft',
    labelBn: 'শান্ত (স্নিগ্ধ ও মৃদু পুরুষ গলা)',
    labelEn: 'Calm Gentle Male',
    geminiVoice: 'Charon',
    nativePitch: 0.88,
    nativeRate: 0.94,
    stylePrompt:
      'Speak like a calm, soothing, respectful native Bengali or Hindi gentleman with a soft, relaxed, natural human voice and pure native pronunciation.',
  },
  {
    id: 'female-deep-hard',
    gender: 'female',
    tone: 'hard',
    labelBn: 'রুদ্রাণী (ডিপ ও কঠিন নারী গলা)',
    labelEn: 'Deep Firm Female',
    geminiVoice: 'Kore',
    nativePitch: 0.86,
    nativeRate: 0.93,
    stylePrompt:
      'Speak like an adult native Bengali or Hindi woman with a deep, rich, firm, serious, commanding alto voice. 100% natural native Bengali/Hindi phonology and human expression with zero English accent.',
  },
  {
    id: 'female-commanding',
    gender: 'female',
    tone: 'hard',
    labelBn: 'শক্তি (গম্ভীর ও দৃঢ় নারী গলা)',
    labelEn: 'Bold Authoritative Female',
    geminiVoice: 'Kore',
    nativePitch: 0.92,
    nativeRate: 0.96,
    stylePrompt:
      'Speak like a bold, sharp, assertive native Bengali or Hindi woman with a strong, crisp, decisive voice. Completely authentic native accent and natural human pacing.',
  },
  {
    id: 'female-soft-sweet',
    gender: 'female',
    tone: 'soft',
    labelBn: 'কোমল (নরম ও মিষ্টি নারী গলা)',
    labelEn: 'Soft Sweet Female',
    geminiVoice: 'Zephyr',
    nativePitch: 1.12,
    nativeRate: 0.97,
    stylePrompt:
      'Speak like a warm, affectionate, soft-spoken native Bengali or Hindi woman with a melodious, gentle, natural human voice. Pure native South Asian accent with zero Western or English drawl.',
  },
  {
    id: 'female-warm-calm',
    gender: 'female',
    tone: 'soft',
    labelBn: 'স্নিগ্ধ (শান্ত ও স্বাভাবিক নারী গলা)',
    labelEn: 'Warm Natural Female',
    geminiVoice: 'Zephyr',
    nativePitch: 1.04,
    nativeRate: 0.96,
    stylePrompt:
      'Speak like a calm, friendly, natural native Bengali or Hindi woman having an everyday human conversation. Soft, clear, natural tone with zero English accent.',
  },
];

export function normalizeVoiceProfile(raw?: string | null): VoiceProfile {
  if (!raw) return 'male-deep-hard';
  if (raw === 'deep-voinkor') return 'male-deep-hard';
  if (raw === 'commanding') return 'male-commanding';
  if (raw === 'calm-deep') return 'male-soft-warm';
  const match = VOICE_CATALOG.find((v) => v.id === raw);
  return match ? match.id : 'male-deep-hard';
}

export function getVoiceOption(profile?: string | null): VoiceOption {
  const id = normalizeVoiceProfile(profile);
  return VOICE_CATALOG.find((v) => v.id === id) || VOICE_CATALOG[0];
}

export interface BrahmaSettings {
  assistantName: string;
  voiceProfile: VoiceProfile;
  serverUrl: string;
  weatherApiKey: string;
  smartHomeBridgeUrl: string;
  smartHomeToken: string;
  notchExpressions: boolean;
  dizzyReaction: boolean;
  accessibilityAutomation: boolean;
  notchScale: number;
  notchPosition: { x: number; y: number } | null;
  silentUntilUserSpeaks: boolean;
}

export interface AndroidPermissionStatus {
  isNativeAndroid: boolean;
  microphone: boolean;
  camera: boolean;
  overlay: boolean;
  accessibility: boolean;
  notifications: boolean;
  installPackages: boolean;
  storage: boolean;
  termuxInstalled: boolean;
}

export interface BrahmaNativeBridge {
  isNativeAndroid?: () => boolean;
  startSystemOverlay?: () => void;
  stopSystemOverlay?: () => void;
  updateOverlayState?: (state: string, voiceLevel: number, lookX: number, lookY: number) => void;
  updateOverlayMood?: (mood: string) => void;
  updateOverlayScale?: (scale: number) => void;
  runInTermux?: (command: string) => boolean;
  installApkFile?: (fileName: string) => boolean;
  getPermissionStatusJson?: () => string;
  requestAllRuntimePermissions?: () => void;
  requestSinglePermission?: (key: string) => void;
  openAccessibilitySettings?: () => void;
  speakDeepVoice?: (text: string, lang: string, pitch: number, rate: number) => boolean;
  stopNativeVoice?: () => void;
  performAccessibilityAction?: (action: string) => boolean;
  clickTextOnScreen?: (text: string) => boolean;
  openAppByName?: (appName: string) => boolean;
  httpPostJson?: (url: string, jsonBody: string) => string;
  httpGet?: (url: string) => string;
}

const SETTINGS_STORAGE_KEY = 'brahma_settings_v1';
const SKILLS_STORAGE_KEY = 'brahma_local_skills_v1';
const AUTOMATIONS_STORAGE_KEY = 'brahma_local_automations_v1';
const SMART_HOME_STORAGE_KEY = 'brahma_local_devices_v1';
const MEMORY_STORAGE_KEY = 'brahma_local_memories_v1';
const IDENTITY_STORAGE_KEY = 'brahma_local_identity_v1';

const DEFAULT_SETTINGS: BrahmaSettings = {
  assistantName: 'ব্রহ্মা AI',
  voiceProfile: 'male-deep-hard',
  serverUrl: '',
  weatherApiKey: '',
  smartHomeBridgeUrl: '',
  smartHomeToken: '',
  notchExpressions: true,
  dizzyReaction: true,
  accessibilityAutomation: true,
  notchScale: 0.82,
  notchPosition: null,
  silentUntilUserSpeaks: true,
};

export function getBrahmaNative(): BrahmaNativeBridge | undefined {
  return (window as unknown as { BrahmaNative?: BrahmaNativeBridge }).BrahmaNative;
}

export function isNativeApkRuntime(): boolean {
  return Boolean(
    getBrahmaNative()?.isNativeAndroid?.() ||
      window.location.hostname === 'appassets.androidplatform.net' ||
      window.location.protocol === 'file:'
  );
}

function sanitizeSettingsObject(parsed: Partial<BrahmaSettings> & Record<string, unknown>): BrahmaSettings {
  const rest: Record<string, unknown> = { ...parsed };
  delete rest.geminiApiKey;
  delete rest.verifiedModel;
  return {
    ...DEFAULT_SETTINGS,
    ...(rest as Partial<BrahmaSettings>),
    voiceProfile: normalizeVoiceProfile(parsed.voiceProfile),
    assistantName: (parsed.assistantName || DEFAULT_SETTINGS.assistantName).trim() || DEFAULT_SETTINGS.assistantName,
    notchScale:
      typeof parsed.notchScale === 'number'
        ? Math.min(1.4, Math.max(0.55, parsed.notchScale))
        : DEFAULT_SETTINGS.notchScale,
  };
}

export function loadBrahmaSettings(): BrahmaSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<BrahmaSettings> & Record<string, unknown>;
    const clean = sanitizeSettingsObject(parsed);
    if ('geminiApiKey' in parsed || 'verifiedModel' in parsed) {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveBrahmaSettings(next: Partial<BrahmaSettings>): BrahmaSettings {
  const merged = sanitizeSettingsObject({
    ...loadBrahmaSettings(),
    ...next,
    voiceProfile: normalizeVoiceProfile(next.voiceProfile ?? loadBrahmaSettings().voiceProfile),
  });
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore quota errors
  }
  return merged;
}

export function getApiBaseUrl(): string {
  const cfg = loadBrahmaSettings();
  const custom = cfg.serverUrl.trim().replace(/\/+$/, '');
  if (custom && /^https?:\/\/.+/.test(custom)) return custom;
  return '';
}

export async function getPermissionStatuses(): Promise<AndroidPermissionStatus> {
  const native = getBrahmaNative();
  if (native?.getPermissionStatusJson) {
    try {
      const parsed = JSON.parse(native.getPermissionStatusJson()) as Partial<AndroidPermissionStatus>;
      return {
        isNativeAndroid: true,
        microphone: Boolean(parsed.microphone),
        camera: Boolean(parsed.camera),
        overlay: Boolean(parsed.overlay),
        accessibility: Boolean(parsed.accessibility),
        notifications: Boolean(parsed.notifications),
        installPackages: Boolean(parsed.installPackages),
        storage: Boolean(parsed.storage),
        termuxInstalled: Boolean(parsed.termuxInstalled),
      };
    } catch {
      // fall through
    }
  }

  let micGranted = false;
  let camGranted = false;
  try {
    if (navigator.permissions?.query) {
      const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      micGranted = mic.state === 'granted';
      const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
      camGranted = cam.state === 'granted';
    }
  } catch {
    // unsupported in some webviews
  }

  const notifGranted =
    typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false;

  return {
    isNativeAndroid: isNativeApkRuntime(),
    microphone: micGranted,
    camera: camGranted,
    overlay: false,
    accessibility: false,
    notifications: notifGranted,
    installPackages: false,
    storage: true,
    termuxInstalled: false,
  };
}

export async function requestPermissionByKey(key: string): Promise<boolean> {
  const native = getBrahmaNative();
  if (native?.requestSinglePermission) {
    native.requestSinglePermission(key);
    return true;
  }

  try {
    if (key === 'microphone') {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      return true;
    }
    if (key === 'camera') {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      return true;
    }
    if (key === 'notifications' && typeof Notification !== 'undefined') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
  } catch {
    return false;
  }
  return false;
}

export async function verifyServerConnection(
  url?: string
): Promise<{ ok: boolean; latencyMs: number; geminiConfigured: boolean; message: string }> {
  const clean = (url || '').trim().replace(/\/+$/, '');
  const endpoint = clean ? `${clean}/api/health` : '/api/health';
  if (isNativeApkRuntime() && !clean) {
    return {
      ok: false,
      latencyMs: 0,
      geminiConfigured: false,
      message: 'Android APK মোডে সার্ভারের সাথে যুক্ত হতে আপনার সার্ভার URL দিন।',
    };
  }
  const t0 = Date.now();
  try {
    const res = await fetch(endpoint);
    const latencyMs = Date.now() - t0;
    const data = (await res.json()) as { ok?: boolean; geminiConfigured?: boolean };
    if (res.ok && data.ok) {
      const configured = Boolean(data.geminiConfigured);
      return {
        ok: true,
        latencyMs,
        geminiConfigured: configured,
        message: configured
          ? `Server Connected (${latencyMs}ms) · Gemini Neural Core Active`
          : `Server Connected (${latencyMs}ms) · ব্রেন চালু করতে AI Studio-র Settings > Secrets-এ GEMINI_API_KEY সেট করুন।`,
      };
    }
    return {
      ok: false,
      latencyMs,
      geminiConfigured: false,
      message: `Server returned HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      geminiConfigured: false,
      message: err instanceof Error ? err.message : 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।',
    };
  }
}

function getLocalStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalStore<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

const DEFAULT_LOCAL_DEVICES: SmartDevice[] = [
  {
    id: 'dev-light-1',
    name: 'Studio Ambient LED',
    type: 'light',
    room: 'Main Lab',
    power: true,
    level: 80,
    unit: '%',
    image: '/brahma-assets/smart_light.png',
    provider: 'Local Mesh',
  },
  {
    id: 'dev-ac-1',
    name: 'Climate Control AC',
    type: 'ac',
    room: 'Main Lab',
    power: true,
    level: 22,
    unit: '°C',
    image: '/brahma-assets/smart_ac.png',
    provider: 'Local Mesh',
  },
  {
    id: 'dev-fan-1',
    name: 'BLDC Smart Fan',
    type: 'fan',
    room: 'Workspace',
    power: false,
    level: 3,
    unit: 'spd',
    image: '/brahma-assets/smart_fan.png',
    provider: 'Local Mesh',
  },
];

const DEFAULT_LOCAL_AUTOMATIONS: AutomationWorkflow[] = [
  {
    id: 'auto-night-protocol',
    name: 'রাত্রি নিরাপত্তা প্রোটোকল',
    description: 'রাতের জন্য লাইট কমিয়ে সাইলেন্ট ও ডিভাইস সেফ মোড চালু করে।',
    triggerPhrase: 'রাত্রি নিরাপত্তা প্রোটোকল',
    triggerType: 'voice',
    enabled: true,
    runCount: 0,
    steps: [
      { type: 'smart_home', label: 'Studio LED ২০% সেট', deviceId: 'dev-light-1', power: true, level: 20 },
      { type: 'orb_state', label: 'Orb EXECUTING মোড', orbState: 'EXECUTING' },
      { type: 'speak_briefing', label: 'ভয়েস কনফার্মেশন', message: 'রাত্রি নিরাপত্তা প্রোটোকল সক্রিয় হয়েছে।' },
    ],
  },
  {
    id: 'auto-lab-mode',
    name: 'ইঞ্জিনিয়ারিং ল্যাব মোড',
    description: 'হাই-পারফরম্যান্স ল্যাব ও সার্কিট HUD চালু করে।',
    triggerPhrase: 'ল্যাব মোড চালু করো',
    triggerType: 'voice',
    enabled: true,
    runCount: 0,
    steps: [
      { type: 'smart_home', label: 'Studio LED ১০০%', deviceId: 'dev-light-1', power: true, level: 100 },
      { type: 'open_module', label: 'Circuit HUD ওপেন', module: 'circuit' },
    ],
  },
];

const DEFAULT_LOCAL_SKILLS: SkillEntry[] = [
  {
    id: 'sk-phone-ctrl',
    name: 'Android Accessibility Bridge',
    version: '2.0.0',
    evolutionCount: 1,
    category: 'built-in',
    description: 'অ্যাক্সেসিবিলিটি সার্ভিস দিয়ে ফোনের অ্যাপ খোলা, ব্যাক/হোম বা স্ক্রল নিয়ন্ত্রণ।',
    trigger: 'অ্যাপ খোলো / ব্যাক করো',
    status: 'active',
    code: 'return { status: "ready", bridge: "BrahmaAccessibilityService" };',
    testsPassed: 1,
    testsTotal: 1,
    executions: 0,
    createdAt: new Date().toISOString(),
  },
];

function executeAndroidIntentFromMessage(message: string): string | null {
  const native = getBrahmaNative();
  if (!native?.isNativeAndroid?.()) return null;
  const lower = message.toLowerCase();

  if (/\b(go back|ব্যাক|পেছনে যাও)\b/i.test(lower)) {
    const ok = native.performAccessibilityAction?.('BACK');
    return ok ? 'পিছনে (Back) নেভিগেট করা হয়েছে।' : 'অ্যাক্সেসিবিলিটি পারমিশন চালু থাকলে অটো-ব্যাক কাজ করবে — Settings → Permissions থেকে Allow করুন।';
  }
  if (/\b(go home|হোম স্ক্রিন|হোমে যাও)\b/i.test(lower)) {
    const ok = native.performAccessibilityAction?.('HOME');
    return ok ? 'ফোনের হোম স্ক্রিনে যাওয়া হয়েছে।' : 'Settings → Permissions থেকে অ্যাক্সেসিবিলিটি পারমিশন Allow করুন।';
  }
  if (/\b(recent apps|রিসেন্ট)\b/i.test(lower)) {
    const ok = native.performAccessibilityAction?.('RECENTS');
    return ok ? 'রিসেন্ট অ্যাপস খোলা হয়েছে।' : 'অ্যাক্সেসিবিলিটি পারমিশন প্রয়োজন।';
  }
  if (/\b(notification|নোটিফিকেশন নামাও|নোটিফিকেশন দেখাও)\b/i.test(lower)) {
    const ok = native.performAccessibilityAction?.('NOTIFICATIONS');
    return ok ? 'নোটিফিকেশন প্যানেল নামানো হয়েছে।' : 'অ্যাক্সেসিবিলিটি পারমিশন প্রয়োজন।';
  }
  if (/\b(screenshot|স্ক্রিনশট নাও)\b/i.test(lower)) {
    const ok = native.performAccessibilityAction?.('TAKE_SCREENSHOT');
    return ok ? 'স্ক্রিনশট নেওয়া হয়েছে।' : 'স্ক্রিনশট নেওয়ার জন্য অ্যাক্সেসিবিলিটি পারমিশন চালু করুন।';
  }

  const openMatch = message.match(/(?:open|launch|খোলো|চালু করো)\s+([a-zA-Z0-9\s]{2,24})/i);
  if (openMatch) {
    const appTarget = openMatch[1].trim();
    const ok = native.openAppByName?.(appTarget);
    if (ok) return `${appTarget} অ্যাপ খোলা হচ্ছে।`;
  }
  return null;
}

async function handleStandaloneFallback(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const bodyObj =
    typeof init?.body === 'string'
      ? (JSON.parse(init.body) as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const jsonRes = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  // 1. Health
  if (path === '/api/health') {
    return jsonRes({ ok: false, mode: 'offline-local', geminiConfigured: false });
  }

  // 2. Chat (Local device reflexes work offline; AI brain requires server connection)
  if (path === '/api/chat' && method === 'POST') {
    const t0 = Date.now();
    const message = String(bodyObj.message || '').trim();

    // Popup visibility voice triggers work offline too
    if (/(?:পপ\s*-?\s*আপ|উইন্ডো|ডিসপ্লে).*(?:দেখাও|খোলো|ওপেন|show|open)/i.test(message) || /show\s+popup/i.test(message)) {
      return jsonRes({
        reply: 'অবশ্যই, লাইভ টার্মিনাল পপ-আপ ডিসপ্লে স্ক্রিনে দেখানো হচ্ছে।',
        tier: 0,
        intent: 'popup_control',
        popupAction: 'show',
        orbState: 'EXECUTING',
        latencyMs: Date.now() - t0,
      });
    }
    if (/(?:পপ\s*-?\s*আপ|উইন্ডো|ডিসপ্লে).*(?:লুকাও|বন্ধ|হাইড|hide|close)/i.test(message) || /hide\s+popup/i.test(message)) {
      return jsonRes({
        reply: 'ঠিক আছে, পপ-আপ উইন্ডো হাইড করে দেওয়া হলো।',
        tier: 0,
        intent: 'popup_control',
        popupAction: 'hide',
        orbState: 'ONLINE',
        latencyMs: Date.now() - t0,
      });
    }

    // Native Android Accessibility command check
    const androidOutcome = executeAndroidIntentFromMessage(message);
    if (androidOutcome) {
      return jsonRes({
        reply: androidOutcome,
        tier: 1,
        intent: 'android_automation',
        orbState: 'EXECUTING',
        latencyMs: Date.now() - t0,
      });
    }

    return jsonRes(
      {
        error: isNativeApkRuntime()
          ? 'সার্ভারের সাথে সংযোগ নেই। অনুগ্রহ করে ⚙ Settings → নাম ও সার্ভার সংযোগ ট্যাবে গিয়ে আপনার সার্ভার URL যাচাই করুন।'
          : 'ব্রহ্মা AI সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে ইন্টারনেট বা সার্ভার স্ট্যাটাস চেক করুন।',
      },
      503
    );
  }

  // 3. TTS -> Fallback to Native Android / Browser TTS when server is unreachable offline
  if (path === '/api/tts' && method === 'POST') {
    return jsonRes({ useNativeTts: true });
  }

  // 4. Live Vision Single-Frame (requires server)
  if (path === '/api/vision/analyze-frame' && method === 'POST') {
    return jsonRes(
      {
        error: 'লাইভ ভিশন বিশ্লেষণের জন্য ব্রহ্মা সার্ভারের সাথে সংযোগ প্রয়োজন।',
      },
      503
    );
  }

  // 5. Automations
  if (path === '/api/automations' && method === 'GET') {
    return jsonRes({ workflows: getLocalStore(AUTOMATIONS_STORAGE_KEY, DEFAULT_LOCAL_AUTOMATIONS) });
  }
  if (path.startsWith('/api/automations/run/') && method === 'POST') {
    const id = path.split('/').pop();
    const list = getLocalStore(AUTOMATIONS_STORAGE_KEY, DEFAULT_LOCAL_AUTOMATIONS);
    const wf = list.find((w) => w.id === id);
    if (!wf) return jsonRes({ error: 'Not found' }, 404);
    wf.runCount += 1;
    wf.lastRunAt = new Date().toISOString();
    setLocalStore(AUTOMATIONS_STORAGE_KEY, list);
    const executedSteps = wf.steps.map((s) => s.label);
    const result: AutomationExecutionResult = {
      workflowId: wf.id,
      workflowName: wf.name,
      executedSteps,
      spokenSummary: `${wf.name} সম্পন্ন হয়েছে।`,
      openModule: wf.steps.find((s) => s.module)?.module,
      timestamp: new Date().toISOString(),
    };
    return jsonRes({ workflows: list, result });
  }
  if (path.startsWith('/api/automations/toggle/') && method === 'POST') {
    const id = path.split('/').pop();
    const list = getLocalStore(AUTOMATIONS_STORAGE_KEY, DEFAULT_LOCAL_AUTOMATIONS);
    const wf = list.find((w) => w.id === id);
    if (wf) wf.enabled = !wf.enabled;
    setLocalStore(AUTOMATIONS_STORAGE_KEY, list);
    return jsonRes({ workflows: list });
  }
  if (path.startsWith('/api/automations/') && method === 'DELETE') {
    const id = path.split('/').pop();
    const list = getLocalStore(AUTOMATIONS_STORAGE_KEY, DEFAULT_LOCAL_AUTOMATIONS).filter((w) => w.id !== id);
    setLocalStore(AUTOMATIONS_STORAGE_KEY, list);
    return jsonRes({ workflows: list });
  }
  if (path === '/api/automations/create-ai' && method === 'POST') {
    return jsonRes(
      { error: 'AI অটোমেশন তৈরি করতে ব্রহ্মা সার্ভারের সাথে সংযোগ প্রয়োজন।' },
      503
    );
  }

  // 6. Smart Home
  if (path === '/api/smart-home' && method === 'GET') {
    return jsonRes({ devices: getLocalStore(SMART_HOME_STORAGE_KEY, DEFAULT_LOCAL_DEVICES) });
  }
  if (path === '/api/smart-home/update' && method === 'POST') {
    const devices = getLocalStore(SMART_HOME_STORAGE_KEY, DEFAULT_LOCAL_DEVICES);
    const dev = devices.find((d) => d.id === bodyObj.id);
    if (dev) {
      if (typeof bodyObj.power === 'boolean') dev.power = bodyObj.power;
      if (typeof bodyObj.level === 'number') dev.level = bodyObj.level;
    }
    setLocalStore(SMART_HOME_STORAGE_KEY, devices);
    return jsonRes({ device: dev, devices });
  }

  // 7. Briefing
  if (path === '/api/briefing') {
    let weather = { location: 'Local Device', tempC: 28, condition: 'Clear Sky', windKmh: 10, humidity: 62 };
    let iss = { latitude: 22.57, longitude: 88.36, altitudeKm: 419, velocityKmh: 27580 };
    try {
      const wRes = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=22.5726&longitude=88.3639&current=temperature_2m,relative_humidity_2m,wind_speed_10m'
      );
      if (wRes.ok) {
        const wj = (await wRes.json()) as {
          current?: { temperature_2m?: number; relative_humidity_2m?: number; wind_speed_10m?: number };
        };
        if (wj.current) {
          weather = {
            ...weather,
            tempC: Math.round(wj.current.temperature_2m ?? 28),
            humidity: Math.round(wj.current.relative_humidity_2m ?? 62),
            windKmh: Math.round(wj.current.wind_speed_10m ?? 10),
          };
        }
      }
    } catch {
      // fallback
    }
    const devices = getLocalStore(SMART_HOME_STORAGE_KEY, DEFAULT_LOCAL_DEVICES);
    const skills = getLocalStore(SKILLS_STORAGE_KEY, DEFAULT_LOCAL_SKILLS);
    const memories = getLocalStore<MemoryItem[]>(MEMORY_STORAGE_KEY, []);
    const autos = getLocalStore(AUTOMATIONS_STORAGE_KEY, DEFAULT_LOCAL_AUTOMATIONS);
    const data: BriefingData = {
      weather,
      iss,
      stats: {
        activeSkills: skills.length,
        onlineDevices: devices.filter((d) => d.power).length,
        totalDevices: devices.length,
        memoriesIndexed: memories.length,
        activeAutomations: autos.filter((a) => a.enabled).length,
      },
    };
    return jsonRes(data);
  }

  // 8. Skills
  if (path === '/api/skills' && method === 'GET') {
    return jsonRes({ skills: getLocalStore(SKILLS_STORAGE_KEY, DEFAULT_LOCAL_SKILLS) });
  }
  if (path === '/api/skills/forge' && method === 'POST') {
    return jsonRes({ error: 'Skill Forge ব্যবহারের জন্য ব্রহ্মা সার্ভারের সাথে সংযোগ প্রয়োজন।' }, 503);
  }

  // 9. Identity & Memory
  if (path === '/api/identity') {
    const fallbackIdentity: IdentityState = {
      owner: { name: 'Commander', preferred_name: 'Boss', role: 'Creator', location: 'India', about: '' },
      assistant: { name: 'BRAHMA', application_name: 'Brahma AI Evo', title: 'Android Companion' },
      behavior: { mode: 'technical', proactive: true, custom_instructions: '' },
    };
    if (method === 'POST') {
      const cur = getLocalStore(IDENTITY_STORAGE_KEY, fallbackIdentity);
      const next = { ...cur, ...bodyObj };
      setLocalStore(IDENTITY_STORAGE_KEY, next);
      return jsonRes({ identity: next });
    }
    return jsonRes({ identity: getLocalStore(IDENTITY_STORAGE_KEY, fallbackIdentity) });
  }
  if (path.startsWith('/api/memory')) {
    let mems = getLocalStore<MemoryItem[]>(MEMORY_STORAGE_KEY, []);
    if (method === 'POST') {
      const item: MemoryItem = {
        id: `mem-${Date.now()}`,
        category: (bodyObj.category as MemoryItem['category']) || 'preference',
        key: String(bodyObj.key || 'note'),
        value: String(bodyObj.value || ''),
        createdAt: new Date().toISOString(),
      };
      mems.unshift(item);
      setLocalStore(MEMORY_STORAGE_KEY, mems);
      return jsonRes({ memory: item, memories: mems });
    }
    if (method === 'DELETE') {
      const id = path.split('/').pop();
      mems = mems.filter((m) => m.id !== id);
      setLocalStore(MEMORY_STORAGE_KEY, mems);
    }
    return jsonRes({ memories: mems });
  }

  // 10. Terminal & Android Status
  if (path === '/api/android/status') {
    const native = getBrahmaNative();
    return jsonRes({
      readyForGithubApk: true,
      hasLocalAndroidSdk: false,
      isNativeAndroid: Boolean(native?.isNativeAndroid?.()),
      packageId: 'com.brahma.evo',
      workflowPath: '.github/workflows/build-apk.yml',
      fileChecks: [
        { path: 'capacitor.config.ts', exists: true },
        { path: 'android/build.gradle', exists: true },
        { path: 'android/app/src/main/java/com/brahma/evo/MainActivity.kt', exists: true },
        { path: 'android/app/src/main/java/com/brahma/evo/BrahmaAccessibilityService.kt', exists: true },
        { path: 'android/app/src/main/java/com/brahma/evo/BrahmaOverlayService.kt', exists: true },
        { path: '.github/workflows/build-apk.yml', exists: true },
      ],
    });
  }
  if (path === '/api/terminal/state') {
    const state: TerminalState = {
      running: false,
      currentTask: '',
      cwd: isNativeApkRuntime() ? 'termux://' : '~',
      lines: [
        {
          id: 't-init',
          kind: 'info',
          text: isNativeApkRuntime()
            ? 'Native Android Termux Bridge Ready (Settings → Permissions থেকে Termux ও Storage Allow করুন)'
            : 'Brahma Terminal Ready',
          timestamp: new Date().toISOString(),
        },
      ],
      projects: [],
    };
    return jsonRes(state);
  }
  if (path === '/api/terminal/exec' && method === 'POST') {
    const cmd = String(bodyObj.command || '');
    const dispatched = getBrahmaNative()?.runInTermux?.(cmd);
    return jsonRes({
      ok: Boolean(dispatched),
      cwd: 'termux://',
      lines: [
        { id: `tc-${Date.now()}`, kind: 'cmd', text: `$ ${cmd}`, timestamp: new Date().toISOString() },
        {
          id: `to-${Date.now() + 1}`,
          kind: dispatched ? 'success' : 'stderr',
          text: dispatched
            ? 'Command dispatched to Termux app on this device.'
            : 'Termux app পাওয়া যায়নি অথবা RUN_COMMAND পারমিশন দেওয়া নেই।',
          timestamp: new Date().toISOString(),
        },
      ],
      projects: [],
    });
  }

  // 11. Circuit Presets / Solve / Office
  if (path === '/api/circuit/presets') {
    const fallbackCircuit: CircuitSchematic = {
      title: 'Connecting ESP32 to DHT11 Sensor',
      description: 'Standalone offline schematic preset.',
      components: [
        {
          id: 'esp32',
          name: 'ESP32 DevKit',
          subtitle: '3.3V MCU',
          highlight: true,
          left_pins: [],
          right_pins: [
            { name: '3V3', color: '#f97316' },
            { name: 'GND', color: '#f8fafc' },
            { name: 'GPIO4', badge: 'DATA', color: '#fbbf24' },
          ],
        },
        {
          id: 'dht11',
          name: 'DHT11 Sensor',
          subtitle: 'Temp & Humidity',
          left_pins: [
            { name: 'VCC', color: '#f97316' },
            { name: 'GND', color: '#f8fafc' },
            { name: 'DATA', color: '#fbbf24' },
          ],
          right_pins: [],
        },
      ],
      wires: [
        { from: 'esp32:right:3V3', to: 'dht11:left:VCC', color: '#f97316', label: '3.3V', step: 1 },
        { from: 'esp32:right:GND', to: 'dht11:left:GND', color: '#f8fafc', label: 'GND', step: 2 },
        { from: 'esp32:right:GPIO4', to: 'dht11:left:DATA', color: '#fbbf24', label: 'Signal', step: 3 },
      ],
      warnings: ['Use 3.3V logic on ESP32 GPIO pins.'],
      steps: ['Connect 3V3 to VCC', 'Connect GND to GND', 'Connect GPIO4 to DATA'],
    };
    return jsonRes({ presets: [{ id: 'esp-dht', title: fallbackCircuit.title, description: fallbackCircuit.description, data: fallbackCircuit }] });
  }
  if (path === '/api/circuit/solve' && method === 'POST') {
    return jsonRes({ error: 'কাস্টম সার্কিট সলভ করার জন্য ব্রহ্মা সার্ভারের সাথে সংযোগ প্রয়োজন।' }, 503);
  }
  if (path === '/api/office/generate' && method === 'POST') {
    return jsonRes({ error: 'Office Architect ব্যবহারের জন্য ব্রহ্মা সার্ভারের সাথে সংযোগ প্রয়োজন।' }, 503);
  }

  if (path === '/api/remote/state') {
    return jsonRes({ logs: [], files: [] });
  }

  return jsonRes({ error: `Route ${path} unavailable offline.` }, 503);
}

export async function brahmaFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = getApiBaseUrl();

  // Inside native Android APK with no custom serverUrl configured, use local device bridge
  if (isNativeApkRuntime() && !baseUrl) {
    return handleStandaloneFallback(path, init);
  }

  try {
    return await fetch(`${baseUrl}${path}`, init);
  } catch {
    if (baseUrl && !isNativeApkRuntime()) {
      try {
        return await fetch(path, init);
      } catch {
        // fall through to offline fallback
      }
    }
    return handleStandaloneFallback(path, init);
  }
}
