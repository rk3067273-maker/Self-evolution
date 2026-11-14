export type BrahmaTab =
  | 'command'
  | 'voice'
  | 'vision'
  | 'terminal'
  | 'automation'
  | 'globe'
  | 'circuit'
  | 'skills'
  | 'smart-office'
  | 'remote';

export type OrbState =
  | 'IDLE'
  | 'ONLINE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'EXECUTING'
  | 'SCANNING';

export type LanguageMode = 'auto' | 'bn' | 'hi' | 'en';
export type VoiceGender = 'male' | 'female';
export type VoiceProfile =
  | 'male-deep-hard'
  | 'male-commanding'
  | 'male-soft-warm'
  | 'male-gentle'
  | 'female-deep-hard'
  | 'female-commanding'
  | 'female-soft-sweet'
  | 'female-warm-calm';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imagePreview?: string;
  tier?: number;
  intent?: string;
  latencyMs?: number;
  moduleToOpen?: string;
  popupAction?: 'show' | 'hide';
  automationExecuted?: AutomationExecutionResult;
  timestamp: string;
}

export interface AutomationActionStep {
  type: 'smart_home' | 'orb_state' | 'open_module' | 'memory_log' | 'speak_briefing';
  label: string;
  deviceId?: string;
  power?: boolean;
  level?: number;
  orbState?: OrbState;
  module?: BrahmaTab;
  message?: string;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  triggerPhrase: string;
  triggerType: 'voice' | 'schedule' | 'battery_low' | 'manual';
  intervalMinutes?: number;
  enabled: boolean;
  lastRunAt?: string;
  runCount: number;
  steps: AutomationActionStep[];
}

export interface AutomationExecutionResult {
  workflowId: string;
  workflowName: string;
  executedSteps: string[];
  spokenSummary: string;
  openModule?: BrahmaTab;
  timestamp: string;
}

export interface CircuitPin {
  name: string;
  badge?: string;
  color: string;
}

export interface CircuitComponent {
  id: string;
  name: string;
  subtitle: string;
  highlight?: boolean;
  left_pins: CircuitPin[];
  right_pins: CircuitPin[];
}

export interface CircuitWire {
  from: string;
  to: string;
  color: string;
  label: string;
  step?: number;
}

export interface CircuitSchematic {
  title: string;
  description: string;
  components: CircuitComponent[];
  wires: CircuitWire[];
  warnings: string[];
  steps: string[];
}

export interface SkillTestCase {
  input: string;
  expectedContains: string;
}

export interface SkillEntry {
  id: string;
  name: string;
  version: string;
  evolutionCount: number;
  category: 'built-in' | 'ultron-forged' | 'feature';
  description: string;
  trigger: string;
  status: 'active' | 'sandboxed';
  code: string;
  testsPassed: number;
  testsTotal: number;
  testCases?: SkillTestCase[];
  lastTestOutput?: string;
  executions: number;
  createdAt: string;
}

export interface SmartDevice {
  id: string;
  name: string;
  type: 'light' | 'ac' | 'fan' | 'plug' | 'tv';
  room: string;
  power: boolean;
  level: number;
  unit: string;
  image: string;
  provider: string;
}

export interface IdentityState {
  owner: {
    name: string;
    preferred_name: string;
    role: string;
    location: string;
    about: string;
  };
  assistant: {
    name: string;
    application_name: string;
    title: string;
  };
  behavior: {
    mode: 'professional' | 'concise' | 'creative' | 'technical';
    proactive: boolean;
    custom_instructions: string;
  };
}

export interface MemoryItem {
  id: string;
  category: 'preference' | 'project' | 'hardware' | 'rule';
  key: string;
  value: string;
  createdAt: string;
}

export interface BriefingData {
  weather: {
    location: string;
    tempC: number;
    condition: string;
    windKmh: number;
    humidity: number;
  };
  iss: {
    latitude: number;
    longitude: number;
    altitudeKm: number;
    velocityKmh: number;
  };
  stats: {
    activeSkills: number;
    onlineDevices: number;
    totalDevices: number;
    memoriesIndexed: number;
    activeAutomations: number;
  };
}

export interface RemoteLog {
  id: string;
  source: 'web' | 'mobile-remote' | 'voice' | 'automation';
  text: string;
  status: 'executed' | 'queued';
  timestamp: string;
}

export interface SharedFileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface TerminalLine {
  id: string;
  kind: 'cmd' | 'stdout' | 'stderr' | 'info' | 'success';
  text: string;
  timestamp: string;
}

export interface BuiltProject {
  id: string;
  name: string;
  slug: string;
  type: 'website' | 'android-apk';
  description: string;
  files: string[];
  previewUrl: string;
  downloadUrl: string;
  createdAt: string;
}

export interface TerminalState {
  running: boolean;
  currentTask: string;
  cwd: string;
  lines: TerminalLine[];
  projects: BuiltProject[];
}

