import http from 'http';
import fs from 'fs';
import vm from 'vm';
import zlib from 'zlib';
import { spawn } from 'child_process';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getServerGeminiKey(): string {
  const key = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return '';
  return key;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getServerGeminiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Built-in Hardware Presets (from Brahma actions/circuit_assembler.py)
// ---------------------------------------------------------------------------
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

const CIRCUIT_PRESETS: Record<string, CircuitSchematic> = {
  dht11_arduino: {
    title: 'Connecting DHT11 and Arduino Pro Mini',
    description:
      'To connect the DHT11 humidity and temperature sensor to the Arduino Pro Mini, wire power (VCC), ground (GND), and a data pin between the two boards. A pull-up resistor (4.7kΩ to 10kΩ) stabilizes the single-wire data line.',
    components: [
      {
        id: 'arduino',
        name: 'Arduino Pro Mini',
        subtitle: 'Atmega328, 5V',
        highlight: false,
        left_pins: [],
        right_pins: [
          { name: 'VCC', badge: '1', color: '#f97316' },
          { name: '2', badge: '2', color: '#fbbf24' },
          { name: 'GND', badge: '3', color: '#f8fafc' },
        ],
      },
      {
        id: 'dht11',
        name: 'Humidity Sensor',
        subtitle: 'DHT11 type',
        highlight: true,
        left_pins: [
          { name: 'VCC', color: '#f97316' },
          { name: 'DATA', color: '#fbbf24' },
          { name: 'GND', color: '#f8fafc' },
        ],
        right_pins: [
          { name: 'VCC', badge: '4', color: '#06b6d4' },
          { name: 'DATA', badge: '5', color: '#22c55e' },
        ],
      },
      {
        id: 'resistor',
        name: 'Resistor',
        subtitle: '4.7kΩ to 10kΩ',
        highlight: false,
        left_pins: [
          { name: 'p8', color: '#06b6d4' },
          { name: 'p9', color: '#22c55e' },
        ],
        right_pins: [],
      },
    ],
    wires: [
      { from: 'arduino:right:VCC', to: 'dht11:left:VCC', color: '#f97316', label: 'Power 5V', step: 1 },
      { from: 'arduino:right:2', to: 'dht11:left:DATA', color: '#fbbf24', label: 'Data (Pin 2)', step: 3 },
      { from: 'arduino:right:GND', to: 'dht11:left:GND', color: '#f8fafc', label: 'Ground', step: 2 },
      { from: 'dht11:right:VCC', to: 'resistor:left:p8', color: '#06b6d4', label: 'Pull-up VCC', step: 4 },
      { from: 'dht11:right:DATA', to: 'resistor:left:p9', color: '#22c55e', label: 'Pull-up DATA', step: 4 },
    ],
    warnings: [
      'Verify the pinout of your specific DHT11 module, as VCC/DATA/GND ordering varies across breakout boards.',
      'Using 5V on a 3.3V Arduino Pro Mini variant will permanently damage the microcontroller.',
    ],
    steps: [
      'Connect Arduino Pro Mini VCC to DHT11 VCC pin. [1]',
      'Connect Arduino Pro Mini GND to DHT11 GND pin. [2]',
      'Connect Arduino Digital Pin 2 to DHT11 DATA pin. [3]',
      'Bridge a 4.7kΩ–10kΩ pull-up resistor between DHT11 VCC and DATA. [4]',
    ],
  },
  hcsr04_esp32: {
    title: 'HC-SR04 Ultrasonic Sensor to ESP32',
    description:
      'Interfacing the 5V HC-SR04 ultrasonic distance sensor with a 3.3V ESP32 DevKit using a resistive voltage divider on ECHO to protect the GPIO input.',
    components: [
      {
        id: 'esp32',
        name: 'ESP32 DevKit V1',
        subtitle: '3.3V Logic, Wi-Fi/BLE',
        highlight: false,
        left_pins: [],
        right_pins: [
          { name: 'VIN (5V)', badge: '1', color: '#f97316' },
          { name: 'GPIO 5', badge: '2', color: '#00e5ff' },
          { name: 'GPIO 18', badge: '3', color: '#fbbf24' },
          { name: 'GND', badge: '4', color: '#f8fafc' },
        ],
      },
      {
        id: 'hcsr04',
        name: 'HC-SR04 Sensor',
        subtitle: 'Ultrasonic Rangefinder',
        highlight: true,
        left_pins: [
          { name: 'VCC', color: '#f97316' },
          { name: 'TRIG', color: '#00e5ff' },
          { name: 'ECHO', color: '#fbbf24' },
          { name: 'GND', color: '#f8fafc' },
        ],
        right_pins: [],
      },
    ],
    wires: [
      { from: 'esp32:right:VIN (5V)', to: 'hcsr04:left:VCC', color: '#f97316', label: '5V Supply', step: 1 },
      { from: 'esp32:right:GPIO 5', to: 'hcsr04:left:TRIG', color: '#00e5ff', label: 'Trigger Pulse', step: 2 },
      { from: 'esp32:right:GPIO 18', to: 'hcsr04:left:ECHO', color: '#fbbf24', label: 'Echo (1k/2k Divider)', step: 3 },
      { from: 'esp32:right:GND', to: 'hcsr04:left:GND', color: '#f8fafc', label: 'Common Ground', step: 4 },
    ],
    warnings: [
      'HC-SR04 ECHO outputs 5V! Use a 1kΩ + 2kΩ voltage divider before ESP32 GPIO 18 to step down to 3.3V.',
      'Ensure common ground between ESP32 and sensor.',
    ],
    steps: [
      'Wire ESP32 VIN (5V) to HC-SR04 VCC. [1]',
      'Wire ESP32 GPIO 5 to HC-SR04 TRIG. [2]',
      'Route HC-SR04 ECHO through a 1kΩ/2kΩ voltage divider into ESP32 GPIO 18. [3]',
      'Connect GND to common ground. [4]',
    ],
  },
  oled_uno: {
    title: 'SSD1306 I2C OLED Display & Arduino Uno',
    description:
      'Standard 4-wire I2C hookup for a 0.96" 128x64 SSD1306 OLED screen with an Arduino Uno (SDA on A4, SCL on A5).',
    components: [
      {
        id: 'uno',
        name: 'Arduino Uno R3',
        subtitle: 'ATmega328P, 5V',
        highlight: false,
        left_pins: [],
        right_pins: [
          { name: '5V', badge: '1', color: '#f97316' },
          { name: 'GND', badge: '2', color: '#f8fafc' },
          { name: 'A4 (SDA)', badge: '3', color: '#22c55e' },
          { name: 'A5 (SCL)', badge: '4', color: '#00e5ff' },
        ],
      },
      {
        id: 'oled',
        name: 'SSD1306 OLED',
        subtitle: '128x64 I2C (0x3C)',
        highlight: true,
        left_pins: [
          { name: 'VCC', color: '#f97316' },
          { name: 'GND', color: '#f8fafc' },
          { name: 'SDA', color: '#22c55e' },
          { name: 'SCL', color: '#00e5ff' },
        ],
        right_pins: [],
      },
    ],
    wires: [
      { from: 'uno:right:5V', to: 'oled:left:VCC', color: '#f97316', label: 'Power', step: 1 },
      { from: 'uno:right:GND', to: 'oled:left:GND', color: '#f8fafc', label: 'Ground', step: 2 },
      { from: 'uno:right:A4 (SDA)', to: 'oled:left:SDA', color: '#22c55e', label: 'I2C Data', step: 3 },
      { from: 'uno:right:A5 (SCL)', to: 'oled:left:SCL', color: '#00e5ff', label: 'I2C Clock', step: 4 },
    ],
    warnings: [
      'Check if your OLED module accepts 5V; bare panels without onboard LDO regulator require 3.3V.',
      'Default I2C address is usually 0x3C (occasionally 0x3D).',
    ],
    steps: [
      'Connect Arduino 5V to OLED VCC. [1]',
      'Connect Arduino GND to OLED GND. [2]',
      'Connect Arduino A4 (SDA) to OLED SDA. [3]',
      'Connect Arduino A5 (SCL) to OLED SCL. [4]',
    ],
  },
};

// ---------------------------------------------------------------------------
// In-Memory State (Memory Cortex, Identity, Skills, Smart Home, Automations)
// ---------------------------------------------------------------------------
interface IdentityState {
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

const identityState: IdentityState = {
  owner: {
    name: 'Operator',
    preferred_name: 'কমান্ডার',
    role: 'Systems Architect & Builder',
    location: 'Kolkata, IN',
    about: 'Building autonomous AI workflows, embedded hardware, and mobile automation.',
  },
  assistant: {
    name: 'ব্রহ্মা (Brahma)',
    application_name: 'Brahma AI Evo Android Edition',
    title: 'স্বয়ংক্রিয় নিউরাল কমান্ডার',
  },
  behavior: {
    mode: 'professional',
    proactive: true,
    custom_instructions:
      'Speak with deep, commanding authority. Use pure, natural, native Bengali or Hindi without English accent or awkward English filler words.',
  },
};

interface MemoryItem {
  id: string;
  category: 'preference' | 'project' | 'hardware' | 'rule';
  key: string;
  value: string;
  createdAt: string;
}

const memoryStore: MemoryItem[] = [
  {
    id: 'mem-1',
    category: 'preference',
    key: 'ভয়েস প্রোফাইল',
    value: 'গভীর, গম্ভীর ও শক্তিশালী কণ্ঠস্বর — শুদ্ধ বাংলা ও হিন্দি উচ্চারণ',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mem-2',
    category: 'project',
    key: 'Brahma AI Evo Android',
    value: 'Continuous listening, autonomous automation pipelines & deep voice engine',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mem-3',
    category: 'hardware',
    key: 'Microcontroller Stack',
    value: 'Arduino Pro Mini 5V, ESP32 DevKit V1, DHT11, HC-SR04',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mem-4',
    category: 'rule',
    key: 'Safety Sentry',
    value: 'Always warn when interfacing 5V sensors with 3.3V logic pins',
    createdAt: new Date().toISOString(),
  },
];

interface SkillTestCase {
  input: string;
  expectedContains: string;
}

interface SkillEntry {
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
  testCases: SkillTestCase[];
  lastTestOutput?: string;
  executions: number;
  createdAt: string;
}

const skillsStore: SkillEntry[] = [
  {
    id: 'sk-circuit',
    name: 'circuit_pinout_guard',
    version: 'v1.0',
    evolutionCount: 0,
    category: 'feature',
    description: 'Validates voltage safety (3.3V vs 5V) and wiring pinouts for Arduino, ESP32, DHT11, and HC-SR04.',
    trigger: 'voltage check, pinout guard, সার্কিট ভোল্টেজ, ভোল্টেজ চেক',
    status: 'active',
    testsPassed: 3,
    testsTotal: 3,
    executions: 4,
    lastTestOutput: '3/3 Crucible assertions passed (1ms)',
    createdAt: '2026-03-01T10:00:00Z',
    testCases: [
      { input: 'esp32 hc-sr04 5v', expectedContains: 'voltage divider' },
      { input: 'dht11 arduino', expectedContains: '4.7k' },
      { input: 'oled i2c', expectedContains: '0x3C' },
    ],
    code: `function run(input) {
  const q = String(input || '').toLowerCase();
  if (q.includes('esp32') && (q.includes('hc-sr04') || q.includes('5v'))) {
    return 'SAFETY ALERT: ESP32 GPIO is 3.3V max. Use a 1kΩ/2kΩ voltage divider on HC-SR04 ECHO.';
  }
  if (q.includes('dht11')) {
    return 'DHT11 Pinout: VCC (3.3V-5V), DATA (Digital Pin + 4.7kΩ pull-up resistor), GND.';
  }
  if (q.includes('oled') || q.includes('ssd1306')) {
    return 'SSD1306 I2C: SDA->A4, SCL->A5 (Uno) or GPIO21/22 (ESP32), default I2C address 0x3C.';
  }
  return 'Pinout Guard Ready: Specify ESP32, DHT11, HC-SR04, or OLED to audit voltage logic.';
}`,
  },
  {
    id: 'sk-security',
    name: 'security_auditor',
    version: 'v1.0',
    evolutionCount: 0,
    category: 'built-in',
    description: 'Static vulnerability scanner for XSS (innerHTML), eval() injection, and leaked secret tokens.',
    trigger: 'audit security, scan code, কোড স্ক্যান, নিরাপত্তা চেক',
    status: 'active',
    testsPassed: 3,
    testsTotal: 3,
    executions: 6,
    lastTestOutput: '3/3 Crucible assertions passed (1ms)',
    createdAt: '2026-02-18T08:00:00Z',
    testCases: [
      { input: 'el.innerHTML = userInput', expectedContains: 'XSS' },
      { input: 'eval(payload)', expectedContains: 'Code Injection' },
      { input: 'const x = 42;', expectedContains: 'CLEAN' },
    ],
    code: `function run(input) {
  const src = String(input || '');
  const findings = [];
  if (/innerHTML\\s*=|dangerouslySetInnerHTML/i.test(src)) findings.push('HIGH: Potential XSS sink detected');
  if (/\\beval\\s*\\(|new Function\\s*\\(/i.test(src)) findings.push('CRITICAL: Dynamic Code Injection risk');
  if (/AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,}/.test(src)) findings.push('CRITICAL: Hardcoded API key leaked');
  if (findings.length === 0) return 'CLEAN: Zero critical static vulnerabilities detected.';
  return findings.join(' | ');
}`,
  },
  {
    id: 'sk-android-battery',
    name: 'android_power_optimizer',
    version: 'v1.0',
    evolutionCount: 0,
    category: 'ultron-forged',
    description: 'Analyzes Android battery telemetry & recommends autonomous power-saving actions.',
    trigger: 'battery check, power audit, ব্যাটারি চেক, পাওয়ার মোড',
    status: 'active',
    testsPassed: 3,
    testsTotal: 3,
    executions: 2,
    lastTestOutput: '3/3 Crucible assertions passed (1ms)',
    createdAt: '2026-03-05T09:15:00Z',
    testCases: [
      { input: 'battery 12%', expectedContains: 'CRITICAL' },
      { input: 'battery 45%', expectedContains: 'BALANCED' },
      { input: 'battery 90%', expectedContains: 'OPTIMAL' },
    ],
    code: `function run(input) {
  const match = String(input || '').match(/(\\d{1,3})/);
  const pct = match ? Math.min(100, Math.max(0, Number(match[1]))) : 75;
  if (pct <= 20) return 'CRITICAL (' + pct + '%): Enable Ultra Power Shield, dim Studio Light to 20%, pause background scans.';
  if (pct <= 55) return 'BALANCED (' + pct + '%): Moderate consumption, continuous wake listener active at low CPU duty.';
  return 'OPTIMAL (' + pct + '%): Full neural speed & Live Vision streaming authorized.';
}`,
  },
];

function sanitizeSkillCode(rawCode: string): string {
  return rawCode
    .replace(/```(?:javascript|typescript|js|ts)?\n?/gi, '')
    .replace(/```/g, '')
    .replace(/\bexport\s+default\s+/g, '')
    .replace(/\bexport\s+(async\s+)?function\s+/g, 'function ')
    .replace(/\bexport\s+(const|let|var)\s+/g, '$1 ')
    .trim();
}

function runSkillInCrucible(code: string, input: string): { ok: boolean; output: string; latencyMs: number } {
  const start = Date.now();
  const clean = sanitizeSkillCode(code);
  try {
    const sandbox = {
      __input: String(input ?? ''),
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      parseInt,
      parseFloat,
      isNaN,
      console: { log: () => {}, warn: () => {}, error: () => {} },
    };
    const context = vm.createContext(sandbox);
    const wrapped = `${clean}\n;if (typeof run !== 'function') { throw new Error('Skill must define function run(input)'); }\nrun(__input);`;
    const result = vm.runInContext(wrapped, context, { timeout: 1200 });
    const output = typeof result === 'string' ? result : JSON.stringify(result);
    return { ok: true, output: String(output ?? ''), latencyMs: Date.now() - start };
  } catch (err: unknown) {
    return {
      ok: false,
      output: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}

function testSkillInCrucible(skill: SkillEntry): {
  passed: number;
  total: number;
  details: Array<{ input: string; expectedContains: string; actualOutput: string; pass: boolean }>;
  latencyMs: number;
} {
  const start = Date.now();
  const cases = Array.isArray(skill.testCases) && skill.testCases.length > 0
    ? skill.testCases
    : [{ input: 'health check', expectedContains: '' }];

  const details = cases.map((tc) => {
    const exec = runSkillInCrucible(skill.code, tc.input);
    const expected = String(tc.expectedContains || '').trim().toLowerCase();
    const actual = exec.output;
    const pass = exec.ok && (expected === '' ? actual.length > 0 : actual.toLowerCase().includes(expected));
    return {
      input: tc.input,
      expectedContains: tc.expectedContains,
      actualOutput: actual,
      pass,
    };
  });

  const passed = details.filter((d) => d.pass).length;
  const total = details.length;
  const latencyMs = Date.now() - start;

  skill.testsPassed = passed;
  skill.testsTotal = total;
  skill.status = passed === total ? 'active' : 'sandboxed';
  skill.lastTestOutput = `${passed}/${total} Crucible assertions passed (${latencyMs}ms)`;

  return { passed, total, details, latencyMs };
}

interface SmartDevice {
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

const smartDevices: SmartDevice[] = [
  {
    id: 'dev-light',
    name: 'Studio Ambient Light',
    type: 'light',
    room: 'Command Desk',
    power: true,
    level: 82,
    unit: '%',
    image: '/brahma-assets/light.jpg',
    provider: 'Tuya Local Mesh',
  },
  {
    id: 'dev-ac',
    name: 'Climate Inverter AC',
    type: 'ac',
    room: 'Lab Suite',
    power: true,
    level: 22,
    unit: '°C',
    image: '/brahma-assets/ac.jpg',
    provider: 'Home Assistant',
  },
  {
    id: 'dev-fan',
    name: 'Atomberg BLDC Fan',
    type: 'fan',
    room: 'Lab Suite',
    power: false,
    level: 3,
    unit: 'SPD',
    image: '/brahma-assets/fan.jpg',
    provider: 'Atomberg Cloud IoT',
  },
  {
    id: 'dev-plug',
    name: 'Workstation Smart Plug',
    type: 'plug',
    room: 'Command Desk',
    power: true,
    level: 145,
    unit: 'W',
    image: '/brahma-assets/plug.jpg',
    provider: 'TP-Link Kasa',
  },
  {
    id: 'dev-tv',
    name: 'HUD Display Panel TV',
    type: 'tv',
    room: 'Lounge',
    power: false,
    level: 28,
    unit: 'VOL',
    image: '/brahma-assets/tv.jpg',
    provider: 'DLNA / CEC Bridge',
  },
];

// ---------------------------------------------------------------------------
// Autonomous Automation Engine
// ---------------------------------------------------------------------------
interface AutomationActionStep {
  type: 'smart_home' | 'orb_state' | 'open_module' | 'memory_log' | 'speak_briefing';
  label: string;
  deviceId?: string;
  power?: boolean;
  level?: number;
  orbState?: string;
  module?: string;
  message?: string;
}

interface AutomationWorkflow {
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

const automationWorkflows: AutomationWorkflow[] = [
  {
    id: 'auto-night-sentinel',
    name: 'রাত্রিকালীন নিরাপত্তা প্রোটোকল (Night Sentinel)',
    description: 'রুমের লাইট ও টিভি বন্ধ করে, এসি ২২ ডিগ্রিতে স্থির করে এবং সুরক্ষা মোড সক্রিয় করে।',
    triggerPhrase: 'night sentinel, রাত্রি প্রোটোকল, রাতের নিরাপত্তা, night protocol, सो जाओ',
    triggerType: 'voice',
    enabled: true,
    runCount: 2,
    steps: [
      { type: 'smart_home', label: 'Studio Light বন্ধ করা হয়েছে', deviceId: 'dev-light', power: false, level: 0 },
      { type: 'smart_home', label: 'Climate AC ২২°C-তে সেট করা হয়েছে', deviceId: 'dev-ac', power: true, level: 22 },
      { type: 'smart_home', label: 'Lounge TV বন্ধ করা হয়েছে', deviceId: 'dev-tv', power: false },
      { type: 'orb_state', label: 'নিউরাল অর্ব EXECUTING মোডে স্থাপিত', orbState: 'EXECUTING' },
      {
        type: 'memory_log',
        label: 'মেমোরি কর্টেক্সে নিরাপত্তা লগ সংরক্ষিত',
        message: 'Night Sentinel Protocol executed autonomously',
      },
      {
        type: 'speak_briefing',
        label: 'ভয়েস কনফার্মেশন',
        message: 'রাত্রিকালীন নিরাপত্তা প্রোটোকল সম্পূর্ণ হয়েছে। আলোকসজ্জা ও ডিসপ্লে বন্ধ, কক্ষের তাপমাত্রা বাইশ ডিগ্রিতে স্থির রাখা হয়েছে।',
      },
    ],
  },
  {
    id: 'auto-lab-ignition',
    name: 'হার্ডওয়্যার ল্যাব ইগনিশন (Lab Ignition)',
    description: 'ওয়ার্কস্টেশন পাওয়ার সক্রিয় করে এবং সার্কিট অ্যাসেম্বলার HUD ওপেন করে।',
    triggerPhrase: 'hardware lab, ল্যাব চালু করো, lab mode, সার্কিট মোড, लैब शुरू करो',
    triggerType: 'voice',
    enabled: true,
    runCount: 1,
    steps: [
      { type: 'smart_home', label: 'Workstation Smart Plug চালু করা হয়েছে', deviceId: 'dev-plug', power: true },
      { type: 'smart_home', label: 'Studio Light ১০০%-এ উজ্জ্বল করা হয়েছে', deviceId: 'dev-light', power: true, level: 100 },
      { type: 'open_module', label: 'Circuit Assembler HUD খোলা হয়েছে', module: 'circuit' },
      {
        type: 'speak_briefing',
        label: 'ভয়েস কনফার্মেশন',
        message: 'হার্ডওয়্যার ল্যাব সক্রিয় করা হয়েছে। ওয়ার্কস্টেশন পাওয়ার চালু এবং সার্কিট অ্যাসেম্বলার প্রস্তুত।',
      },
    ],
  },
  {
    id: 'auto-deep-focus',
    name: 'ডিপ ফোকাস ও স্টাডি গার্ড (Deep Focus Shield)',
    description: 'মনোযোগ বাড়াতে লাইট ৩৫%-এ নামিয়ে ফ্যান মিডিয়াম স্পিডে চালায় এবং টিভি বন্ধ রাখে।',
    triggerPhrase: 'focus mode, ডিপ ফোকাস, পড়াশোনা মোড, study guard, फोकस मोड',
    triggerType: 'voice',
    enabled: true,
    runCount: 0,
    steps: [
      { type: 'smart_home', label: 'Studio Light ৩৫% ডিম করা হয়েছে', deviceId: 'dev-light', power: true, level: 35 },
      { type: 'smart_home', label: 'Atomberg Fan স্পিড ৩-এ চালু', deviceId: 'dev-fan', power: true, level: 3 },
      { type: 'smart_home', label: 'Lounge TV বন্ধ করা হয়েছে', deviceId: 'dev-tv', power: false },
      {
        type: 'speak_briefing',
        label: 'ভয়েস কনফার্মেশন',
        message: 'ডিপ ফোকাস শিল্ড সক্রিয় হয়েছে। সমস্ত অপ্রয়োজনীয় ডিসপ্লে নীরব করা হয়েছে।',
      },
    ],
  },
  {
    id: 'auto-orbital-scan',
    name: 'অরবিটাল ও আবহাওয়া স্ক্যান (Orbital Scan)',
    description: 'নিয়মিত আন্তর্জাতিক মহাকাশ স্টেশন ও গ্লোব রাডার স্ক্যান পরিচালনা করে।',
    triggerPhrase: 'orbital scan, অরবিটাল স্ক্যান, মহাকাশ স্ক্যান, ग्लोब स्कैन',
    triggerType: 'schedule',
    intervalMinutes: 30,
    enabled: true,
    runCount: 4,
    steps: [
      { type: 'orb_state', label: 'নিউরাল অর্ব SCANNING মোডে রূপান্তরিত', orbState: 'SCANNING' },
      { type: 'open_module', label: 'HoloGlobe 3D ওপেন করা হয়েছে', module: 'globe' },
      {
        type: 'speak_briefing',
        label: 'ভয়েস কনফার্মেশন',
        message: 'হোলোগ্লোব এবং অরবিটাল রাডার স্ক্যান সক্রিয় করা হয়েছে। কক্ষপথের তথ্য পর্যবেক্ষণ করা হচ্ছে।',
      },
    ],
  },
];

function executeWorkflow(workflow: AutomationWorkflow, langHint: string = 'bn') {
  const executedSteps: string[] = [];
  let openModule: string | undefined;
  let spokenSummary = `${workflow.name} সম্পন্ন হয়েছে।`;

  for (const step of workflow.steps) {
    if (step.type === 'smart_home' && step.deviceId) {
      const dev = smartDevices.find((d) => d.id === step.deviceId);
      if (dev) {
        if (typeof step.power === 'boolean') dev.power = step.power;
        if (typeof step.level === 'number') dev.level = step.level;
        executedSteps.push(`${dev.name}: ${dev.power ? 'চালু' : 'বন্ধ'} (${dev.level}${dev.unit})`);
      }
    } else if (step.type === 'open_module' && step.module) {
      openModule = step.module;
      executedSteps.push(step.label);
    } else if (step.type === 'memory_log' && step.message) {
      memoryStore.unshift({
        id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        category: 'rule',
        key: workflow.name,
        value: step.message,
        createdAt: new Date().toISOString(),
      });
      executedSteps.push(step.label);
    } else if (step.type === 'speak_briefing' && step.message) {
      spokenSummary = step.message;
      executedSteps.push(step.label);
    } else {
      executedSteps.push(step.label);
    }
  }

  workflow.runCount += 1;
  workflow.lastRunAt = new Date().toISOString();

  remoteLogs.unshift({
    id: `rc-${Date.now()}`,
    source: 'automation',
    text: `Automation executed: ${workflow.name}`,
    status: 'executed',
    timestamp: new Date().toISOString(),
  });
  if (remoteLogs.length > 35) remoteLogs.pop();

  if (langHint === 'hi' && !/[\u0900-\u097F]/.test(spokenSummary)) {
    spokenSummary = `${workflow.name} सफलतापूर्वक निष्पादित हो चुका है। सभी उपकरण अद्यतन कर दिए गए हैं।`;
  }

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    executedSteps,
    spokenSummary,
    openModule,
    timestamp: new Date().toISOString(),
  };
}

interface RemoteCommandLog {
  id: string;
  source: 'web' | 'mobile-remote' | 'voice' | 'automation';
  text: string;
  status: 'executed' | 'queued';
  timestamp: string;
}

const remoteLogs: RemoteCommandLog[] = [
  {
    id: 'rc-1',
    source: 'voice',
    text: 'ব্রহ্মা অ্যানড্রয়েড এডিশন সক্রিয় ও ডিপ ভয়েস ইঞ্জিন প্রস্তুত।',
    status: 'executed',
    timestamp: new Date(Date.now() - 180000).toISOString(),
  },
];

interface UploadedFileEntry {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  contentBase64: string;
  uploadedAt: string;
}

const sharedFiles: UploadedFileEntry[] = [
  {
    id: 'file-1',
    name: 'brahma_circuit_notes.txt',
    size: 184,
    mimeType: 'text/plain',
    contentBase64: Buffer.from(
      'Brahma AI Evo Hardware Pinout Notes:\n- DHT11 VCC -> 5V\n- DHT11 DATA -> D2 (with 4.7k pull-up)\n- DHT11 GND -> GND\n'
    ).toString('base64'),
    uploadedAt: new Date().toISOString(),
  },
];

const intentPhraseCache = new Map<string, { intent: string; moduleToOpen?: string; reply: string }>();

// ---------------------------------------------------------------------------
// 11.5 Real Sandboxed Termux Workspace, ZIP Archive Builder & Agent Engine
// ---------------------------------------------------------------------------
const WORKSPACE_ROOT = '/tmp/brahma_workspace';
const PROJECTS_ROOT = path.join(WORKSPACE_ROOT, 'projects');
fs.mkdirSync(PROJECTS_ROOT, { recursive: true });

interface TerminalLineEntry {
  id: string;
  kind: 'cmd' | 'stdout' | 'stderr' | 'info' | 'success';
  text: string;
  timestamp: string;
}

interface BuiltProjectEntry {
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

const terminalLines: TerminalLineEntry[] = [
  {
    id: 'tl-init-1',
    kind: 'info',
    text: `Brahma Termux Core initialized in ${WORKSPACE_ROOT}`,
    timestamp: new Date().toISOString(),
  },
];
const builtProjects: BuiltProjectEntry[] = [];
let terminalRunning = false;
let terminalCurrentTask = '';
let currentTerminalCwd = WORKSPACE_ROOT;

function pushTerminalLine(kind: TerminalLineEntry['kind'], text: string) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  for (const l of lines) {
    if (l.length === 0 && lines.length > 1) continue;
    terminalLines.push({
      id: `tl-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      kind,
      text: l,
      timestamp: new Date().toISOString(),
    });
  }
  while (terminalLines.length > 350) {
    terminalLines.shift();
  }
}

function isDangerousShellCommand(cmd: string): string | null {
  const lower = cmd.toLowerCase();
  if (/rm\s+-[rf]*\s+\/($|\s|\*)/.test(lower)) return 'Blocked destructive root deletion.';
  if (/(mkfs\.|dd\s+if=|:\(\)\s*\{|shutdown|reboot|halt|poweroff)/.test(lower)) {
    return 'Blocked restricted system/destructive command.';
  }
  return null;
}

async function executeRealShellCommand(rawCmd: string): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number }> {
  const cmd = rawCmd.trim();
  if (!cmd) return { ok: true, stdout: '', stderr: '', exitCode: 0 };

  pushTerminalLine('cmd', `brahma@android:${currentTerminalCwd.replace(WORKSPACE_ROOT, '~') || '~'}$ ${cmd}`);

  const blockedReason = isDangerousShellCommand(cmd);
  if (blockedReason) {
    pushTerminalLine('stderr', blockedReason);
    return { ok: false, stdout: '', stderr: blockedReason, exitCode: 126 };
  }

  // Handle simple "cd ..." cleanly inside workspace sandbox
  const cdMatch = cmd.match(/^cd\s+(.+)$/);
  if (cdMatch && !cmd.includes('&&') && !cmd.includes(';')) {
    const targetRaw = cdMatch[1].trim().replace(/^["']|["']$/g, '');
    const resolved =
      targetRaw === '~'
        ? WORKSPACE_ROOT
        : path.resolve(currentTerminalCwd, targetRaw);
    if (!resolved.startsWith(WORKSPACE_ROOT)) {
      const msg = `Sandbox confined to ${WORKSPACE_ROOT}`;
      pushTerminalLine('stderr', msg);
      return { ok: false, stdout: '', stderr: msg, exitCode: 1 };
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      const msg = `cd: no such directory: ${targetRaw}`;
      pushTerminalLine('stderr', msg);
      return { ok: false, stdout: '', stderr: msg, exitCode: 1 };
    }
    currentTerminalCwd = resolved;
    return { ok: true, stdout: '', stderr: '', exitCode: 0 };
  }

  return await new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('bash', ['-lc', cmd], {
      cwd: currentTerminalCwd,
      env: {
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        HOME: WORKSPACE_ROOT,
        TERM: 'xterm-256color',
      },
    });

    const timeout = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      stderr += '\nCommand timed out after 20s';
    }, 20000);

    child.stdout.on('data', (chunk) => {
      const str = chunk.toString();
      stdout += str;
      pushTerminalLine('stdout', str);
    });
    child.stderr.on('data', (chunk) => {
      const str = chunk.toString();
      stderr += str;
      pushTerminalLine('stderr', str);
    });
    child.on('error', (err) => {
      clearTimeout(timeout);
      pushTerminalLine('stderr', err.message);
      resolve({ ok: false, stdout, stderr: err.message, exitCode: 1 });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0 });
    });
  });
}

// Pure Node.js PKZIP archive generator (CRC32 + store/deflate)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createZipBuffer(entries: Array<{ name: string; content: Buffer | string }>): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/^\/+/, ''), 'utf8');
    const rawBuf = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, 'utf8');
    const compressed = zlib.deflateRawSync(rawBuf);
    const crc = crc32(rawBuf);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(rawBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    localChunks.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(rawBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralChunks.push(central, nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDir, eocd]);
}

async function runAutonomousTerminalAgent(task: string, languageMode: string): Promise<{
  ok: boolean;
  mode: 'shell' | 'website' | 'android-apk';
  summary: string;
  project?: BuiltProjectEntry;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is required to run Brahma Autonomous Terminal Agent.');
  }

  terminalRunning = true;
  terminalCurrentTask = task;
  pushTerminalLine('info', `[AGENT] Planning autonomous task: ${task}`);

  try {
    const wantsApkOrApp = /(apk|android app|মোবাইল অ্যাপ|এপিকে|অ্যাপ বানা|ऐप बना|app bnao|app banao)/i.test(task);
    const planRes = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are Brahma Autonomous Terminal & App Architect running inside a real Linux/Node sandbox (${WORKSPACE_ROOT}).
User Task: "${task}"

Decide carefully:
- If the user wants a website, web tool, dashboard, game, calculator, portfolio, or Android mobile app/APK, set mode to "${wantsApkOrApp ? 'android-apk' : 'website'}", choose a clean kebab-case slug, and synthesize a COMPLETE, polished, self-contained HTML5/CSS/JS app (index.html with clean CSS and working vanilla JS inside, plus manifest.json if helpful). Make the generated app genuinely functional, responsive for mobile phones, with rich interactivity and zero placeholder TODOs.
- If the user wants you to run shell/terminal commands (inspect files, check node/git, run node scripts, list directories), set mode to "shell" and provide 1-3 safe bash commands.

Write summary strictly in ${
        languageMode === 'hi'
          ? 'pure natural Hindi (हिन्दी)'
          : languageMode === 'en'
            ? 'concise authoritative English'
            : 'pure natural Bengali (বাংলা)'
      }. Be 100% honest: if android-apk is requested, note that the installable PWA & complete GitHub Actions APK build project are prepared honestly (never claim a fake binary .apk was compiled locally if Gradle/Android SDK is not present).`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mode: { type: Type.STRING },
            projectName: { type: Type.STRING },
            slug: { type: Type.STRING },
            description: { type: Type.STRING },
            commands: { type: Type.ARRAY, items: { type: Type.STRING } },
            files: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  path: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ['path', 'content'],
              },
            },
            summary: { type: Type.STRING },
          },
          required: ['mode', 'summary'],
        },
      },
    });

    const plan = JSON.parse(planRes.text || '{}') as {
      mode?: string;
      projectName?: string;
      slug?: string;
      description?: string;
      commands?: string[];
      files?: Array<{ path: string; content: string }>;
      summary?: string;
    };

    if (plan.mode === 'shell' && Array.isArray(plan.commands) && plan.commands.length > 0) {
      for (const c of plan.commands.slice(0, 4)) {
        await executeRealShellCommand(c);
      }
      pushTerminalLine('success', `[AGENT] Completed ${plan.commands.length} command(s).`);
      return {
        ok: true,
        mode: 'shell',
        summary: String(plan.summary || 'টার্মিনাল কমান্ড সফলভাবে সম্পন্ন হয়েছে।'),
      };
    }

    const mode: 'website' | 'android-apk' = plan.mode === 'android-apk' || wantsApkOrApp ? 'android-apk' : 'website';
    const rawSlug = String(plan.slug || plan.projectName || `brahma-app-${Date.now()}`)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '') || `app-${Date.now()}`;
    const uniqueSlug = `${rawSlug}-${String(Date.now()).slice(-4)}`;
    const projDir = path.join(PROJECTS_ROOT, uniqueSlug);
    fs.mkdirSync(projDir, { recursive: true });

    const writtenFiles: string[] = [];
    const generatedFiles = Array.isArray(plan.files) ? plan.files : [];
    for (const f of generatedFiles) {
      const safeRel = String(f.path || 'index.html').replace(/\.\./g, '').replace(/^\/+/, '');
      const fullPath = path.join(projDir, safeRel);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, String(f.content || ''), 'utf8');
      writtenFiles.push(safeRel);
    }

    if (!writtenFiles.includes('index.html')) {
      const fallbackHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${plan.projectName || uniqueSlug}</title></head><body style="background:#050608;color:#fff;font-family:sans-serif;padding:24px"><h1>${plan.projectName || uniqueSlug}</h1><p>${plan.description || task}</p></body></html>`;
      fs.writeFileSync(path.join(projDir, 'index.html'), fallbackHtml, 'utf8');
      writtenFiles.push('index.html');
    }

    if (mode === 'android-apk') {
      const appTitle = String(plan.projectName || uniqueSlug);
      const manifestObj = {
        name: appTitle,
        short_name: appTitle.slice(0, 12),
        start_url: './index.html',
        display: 'standalone',
        background_color: '#020305',
        theme_color: '#00e5ff',
      };
      fs.writeFileSync(path.join(projDir, 'manifest.json'), JSON.stringify(manifestObj, null, 2), 'utf8');
      writtenFiles.push('manifest.json');

      const capCfg = `export default {\n  appId: 'com.brahma.${rawSlug.replace(/-/g, '')}',\n  appName: '${appTitle.replace(/'/g, '')}',\n  webDir: '.'\n};\n`;
      fs.writeFileSync(path.join(projDir, 'capacitor.config.ts'), capCfg, 'utf8');
      writtenFiles.push('capacitor.config.ts');

      const ghYaml = `name: Build Android APK\non: [push, workflow_dispatch]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-java@v4\n        with: { distribution: temurin, java-version: 17 }\n      - uses: android-actions/setup-android@v3\n      - run: echo "Bundle generated for ${appTitle}"\n`;
      const wfDir = path.join(projDir, '.github', 'workflows');
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, 'build-apk.yml'), ghYaml, 'utf8');
      writtenFiles.push('.github/workflows/build-apk.yml');
    }

    // Run real verification commands inside Termux shell so output is 100% genuine
    await executeRealShellCommand(`ls -lh "projects/${uniqueSlug}"`);
    await executeRealShellCommand(
      `node -e "const fs=require('fs'); const html=fs.readFileSync('projects/${uniqueSlug}/index.html','utf8'); console.log('Verified index.html bytes:', html.length);"`
    );

    const entry: BuiltProjectEntry = {
      id: `proj-${Date.now()}`,
      name: String(plan.projectName || uniqueSlug),
      slug: uniqueSlug,
      type: mode,
      description: String(plan.description || task),
      files: writtenFiles,
      previewUrl: `/preview-apps/${uniqueSlug}/index.html`,
      downloadUrl: `/api/terminal/download/${uniqueSlug}`,
      createdAt: new Date().toISOString(),
    };
    builtProjects.unshift(entry);
    pushTerminalLine('success', `[BUILD READY] Live preview at ${entry.previewUrl}`);

    return {
      ok: true,
      mode,
      project: entry,
      summary: String(plan.summary || `প্রজেক্ট "${entry.name}" তৈরি হয়ে লাইভ প্রিভিউ ও ডাউনলোডের জন্য প্রস্তুত।`),
    };
  } finally {
    terminalRunning = false;
    terminalCurrentTask = '';
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.use('/brahma-assets', express.static(path.join(__dirname, 'public', 'brahma-assets')));
  app.use('/preview-apps', express.static(PROJECTS_ROOT));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'Brahma AI Evo Android Edition Core',
      geminiConfigured: Boolean(getGeminiClient()),
      models: {
        chat: 'gemini-4-hydrogen',
        tts: 'gemini-3.8-flash-tts',
        live: 'gemini-3.8-live',
        transcribe: 'gemini-3.5-transcribe',
      },
      uptimeSec: Math.round(process.uptime()),
    });
  });

  // -------------------------------------------------------------------------
  // 1. Conversational AI Brain + Multilingual Intent & Automation Dispatcher
  // -------------------------------------------------------------------------
  app.post('/api/chat', async (req, res) => {
    const start = Date.now();
    const message = String(req.body?.message || '').trim();
    const languageMode = String(req.body?.languageMode || 'auto'); // 'auto' | 'bn' | 'hi' | 'en'
    const customAssistantName = String(req.body?.assistantName || '').trim();
    const activeAssistantName = customAssistantName || identityState.assistant.name;
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const imageBase64 = req.body?.imageBase64 ? String(req.body.imageBase64) : null;
    const imageMimeType = req.body?.imageMimeType ? String(req.body.imageMimeType) : 'image/png';

    if (!message && !imageBase64) {
      return res.status(400).json({ error: 'Message or image input is required.' });
    }

    const lower = message.toLowerCase();

    // Tier 0: Terminal Popup Window Display Show / Hide Commands
    if (!imageBase64) {
      const wantsHidePopup =
        /(hide popup|close popup|hide terminal|পপ.?আপ.*(লুকা|বন্ধ)|টার্মিনাল.*(লুকা|বন্ধ)|लुक|छुपा|बंद)/i.test(lower) &&
        /(popup|পপ|টার্মিনাল|terminal|window|ডিসপ্লে|উইন্ডো|पॉपअप|टर्मिनल)/i.test(lower);
      if (wantsHidePopup) {
        const reply =
          languageMode === 'hi'
            ? 'पॉप-अप टर्मिनल डिस्प्ले अब छिपा दिया गया है। वापस देखने के लिए बस बोलें कि काम पॉप-अप विंडो में दिखाओ।'
            : languageMode === 'en'
              ? 'Terminal popup window hidden. Ask me anytime to show what I am working on.'
              : 'পপ-আপ টার্মিনাল ডিসপ্লে লুকানো হয়েছে। আবার দেখতে চাইলে শুধু বলবেন, যে কাজটা করছো সেটা পপ-আপ উইন্ডোতে দেখাও।';
        return res.json({
          tier: 1,
          intent: 'terminal_popup_hide',
          popupAction: 'hide',
          orbState: 'ONLINE',
          latencyMs: Date.now() - start,
          reply,
        });
      }

      const wantsShowPopup =
        (/(popup|pop.?up|pop up window|পপ.?আপ|টার্মিনাল|উইন্ডো ডিসপ্লে|पॉप.?अप|टर्मिनल)/i.test(lower) &&
          /(show|open|display|dhakau|dekhao|দেখা|খোল|दिखा)/i.test(lower)) ||
        /(jai kaj ta korcho|যে কাজটা করছ|কাজ দেখাও|কী করছ দেখাও|जो काम कर रहे)/.test(lower);
      if (wantsShowPopup) {
        const reply =
          languageMode === 'hi'
            ? 'पॉप-अप टर्मिनल विंडो डिस्प्ले सक्रिय कर दी गई है। चल रहे सभी टर्मिनल कार्य अब स्क्रीन पर लाइव दिखाई दे रहे हैं।'
            : languageMode === 'en'
              ? 'Popup terminal display opened. All live terminal actions are now visible.'
              : 'পপ-আপ উইন্ডো ডিসপ্লে খুলে দেওয়া হয়েছে। টার্মিনালে চলা সমস্ত কাজ এখন সরাসরি দেখতে পাচ্ছেন।';
        return res.json({
          tier: 1,
          intent: 'terminal_popup_show',
          popupAction: 'show',
          orbState: 'EXECUTING',
          latencyMs: Date.now() - start,
          reply,
        });
      }

      // Tier 0.5: Autonomous App / Website / Terminal Builder Command
      const wantsBuildOrTerminal =
        /(বানাও|তৈরি করো|বানিয়ে দাও|बनाओ|तैयार करो|build|create|generate)/i.test(lower) &&
        /(website|web app|site|app|apk|portfolio|calculator|game|ওয়েবসাইট|ওয়েবসাইট|অ্যাপ|এপিকে|वेबसाइट|ऐप)/i.test(lower);
      if (wantsBuildOrTerminal) {
        try {
          const agentRes = await runAutonomousTerminalAgent(message, languageMode);
          const extra = agentRes.project
            ? `\n\n• Live Preview: ${agentRes.project.previewUrl}\n• Files: ${agentRes.project.files.join(', ')}`
            : '';
          return res.json({
            tier: 1,
            intent: 'terminal_agent_build',
            moduleToOpen: 'terminal',
            popupAction: 'show',
            orbState: 'EXECUTING',
            latencyMs: Date.now() - start,
            reply: `${agentRes.summary}${extra}`,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return res.status(500).json({ error: `Terminal Agent failed: ${msg}` });
        }
      }

      // Tier 0: Direct Automation Workflow Trigger Match (supports Bengali, Hindi & English phrases)
      for (const wf of automationWorkflows) {
        if (!wf.enabled) continue;
        const triggers = wf.triggerPhrase
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        if (triggers.some((t) => lower.includes(t))) {
          const execRes = executeWorkflow(wf, languageMode);
          return res.json({
            tier: 1,
            intent: 'automation_workflow',
            moduleToOpen: execRes.openModule || 'automation',
            automationExecuted: execRes,
            orbState: 'EXECUTING',
            latencyMs: Date.now() - start,
            reply: `${execRes.spokenSummary}\n\n• ${execRes.executedSteps.join('\n• ')}`,
          });
        }
      }

      // Tier 1: Hardware Circuit Reflex
      if (
        /(dht11|arduino|circuit|wiring|schematic|resistor|esp32|oled|ultrasonic|সার্কিট|सर्किट)/.test(lower) &&
        /(connect|wire|how|show|circuit|schematic|pin|সংযোগ|जोड़)/.test(lower)
      ) {
        let preset = CIRCUIT_PRESETS.dht11_arduino;
        if (lower.includes('esp32') || lower.includes('ultrasonic') || lower.includes('hc-sr04')) {
          preset = CIRCUIT_PRESETS.hcsr04_esp32;
        } else if (lower.includes('oled') || lower.includes('ssd1306')) {
          preset = CIRCUIT_PRESETS.oled_uno;
        }
        const reply =
          languageMode === 'hi'
            ? `होलोग्राफ़िक सर्किट आरेख लोड कर दिया गया है: **${preset.title}**। पिन-टू-पिन वायरिंग और वोल्टेज सुरक्षा चेतावनी अब स्क्रीन पर दिखाई जा रही है।`
            : languageMode === 'en'
              ? `Loaded holographic schematic: **${preset.title}**. Opening Circuit Assembler HUD with pin-to-pin wiring and voltage safety checks.`
              : `হোলোগ্রাফিক সার্কিট ডায়াগ্রাম লোড করা হয়েছে: **${preset.title}**। পিন-টু-পিন ওয়্যারিং ও ভোল্টেজ সতর্কতাসহ সার্কিট হাব চালু করা হলো।`;

        return res.json({
          tier: 1,
          intent: 'circuit_assembler',
          moduleToOpen: 'circuit',
          toolPayload: preset,
          orbState: 'EXECUTING',
          latencyMs: Date.now() - start,
          reply,
        });
      }

      // Tier 1: HoloGlobe Reflex
      if (
        /(iss|space station|flight|route|mumbai|london|tokyo|earthquakes|globe|map|hospital|মহাকাশ|গ্লোব|अंतरिक्ष|ग्लोब)/.test(
          lower
        ) &&
        /(track|show|fly|route|find|where|open|globe|map|দেখাও|ট্র্যাক|दिखाओ|ट्रैक)/.test(lower)
      ) {
        const globeAction =
          lower.includes('iss') || lower.includes('space station') || lower.includes('মহাকাশ') || lower.includes('अंतरिक्ष')
            ? { type: 'iss' }
            : lower.includes('earthquake')
              ? { type: 'earthquakes' }
              : lower.includes('mumbai') && lower.includes('london')
                ? { type: 'route', orig: [19.076, 72.8777], dest: [51.5074, -0.1278], label: 'Mumbai → London' }
                : { type: 'focus', query: message };

        const reply =
          languageMode === 'hi'
            ? `होलोग्लोब 3D अर्थ टेलीमेट्री सक्रिय कर दी गई है। निर्देश: "${message}"।`
            : languageMode === 'en'
              ? `Routing telemetry to **HoloGlobe 3D Earth**. Executing geospatial command: "${message}".`
              : `হোলোগ্লোব থ্রি-ডি আর্থ টেলিমেট্রি সক্রিয় করা হয়েছে। আপনার নির্দেশ অনুযায়ী মানচিত্র আপডেট করা হচ্ছে।`;

        return res.json({
          tier: 1,
          intent: 'holo_globe',
          moduleToOpen: 'globe',
          toolPayload: globeAction,
          orbState: 'SCANNING',
          latencyMs: Date.now() - start,
          reply,
        });
      }

      // Tier 1: Smart Home Reflex (Bengali, Hindi & English)
      if (/(light|ac|fan|plug|tv|লাইট|আলো|এসি|ফ্যান|টিভি|लाइट|पंखा|टीवी|एसी)/.test(lower)) {
        const turnOn = /(turn on|switch on|enable|start|চালু|অন|জ্বালাও|जलाओ|चालू|ऑन)/.test(lower);
        const turnOff = /(turn off|switch off|disable|stop|বন্ধ|অফ|নেভাও|बंद|ऑफ)/.test(lower);
        if (turnOn || turnOff) {
          const matched = smartDevices.find((d) => {
            if (d.type === 'light' && /(light|লাইট|আলো|लाइट)/.test(lower)) return true;
            if (d.type === 'ac' && /(ac|এসি|एसी)/.test(lower)) return true;
            if (d.type === 'fan' && /(fan|ফ্যান|পাখা|पंखा)/.test(lower)) return true;
            if (d.type === 'plug' && /(plug|প্লাগ|प्लग)/.test(lower)) return true;
            if (d.type === 'tv' && /(tv|টিভি|टीवी)/.test(lower)) return true;
            return false;
          });
          if (matched) {
            matched.power = turnOff ? false : true;
            const reply =
              languageMode === 'hi'
                ? `स्मार्ट होम निर्देश पूर्ण: **${matched.name}** को अब **${matched.power ? 'चालू' : 'बंद'}** कर दिया गया है।`
                : languageMode === 'en'
                  ? `Smart Home Mesh updated: **${matched.name}** (${matched.room}) is now **${matched.power ? 'ONLINE' : 'OFF'}**.`
                  : `স্মার্ট হোম নির্দেশ কার্যকর হয়েছে: **${matched.name}** এখন **${matched.power ? 'চালু' : 'বন্ধ'}** করা হয়েছে।`;
            return res.json({
              tier: 1,
              intent: 'smart_home',
              moduleToOpen: 'smart-office',
              toolPayload: { device: matched },
              orbState: 'EXECUTING',
              latencyMs: Date.now() - start,
              reply,
            });
          }
        }
      }

      // Tier 1.5: Evolved & Crucible-Verified Skill Execution
      for (const sk of skillsStore) {
        if (sk.status !== 'active') continue;
        const triggers = sk.trigger
          .split(/[,/|]/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        if (triggers.some((t) => lower.includes(t))) {
          const exec = runSkillInCrucible(sk.code, message);
          if (exec.ok) {
            sk.executions += 1;
            remoteLogs.unshift({
              id: `rc-${Date.now()}`,
              source: 'automation',
              text: `Executed Skill ${sk.name} (${sk.version}): ${exec.output.slice(0, 120)}`,
              status: 'executed',
              timestamp: new Date().toISOString(),
            });
            if (remoteLogs.length > 35) remoteLogs.pop();

            const reply =
              languageMode === 'hi'
                ? `स्व-विकसित कौशल **${sk.name} (${sk.version})** सफलतापूर्वक निष्पादित हुआ:\n\n${exec.output}`
                : languageMode === 'en'
                  ? `Executed Evolved Skill **${sk.name} (${sk.version})**:\n\n${exec.output}`
                  : `স্বয়ংক্রিয় স্কিল **${sk.name} (${sk.version})** সফলভাবে চালানো হয়েছে:\n\n${exec.output}`;
            return res.json({
              tier: 1,
              intent: 'evolved_skill',
              moduleToOpen: 'skills',
              toolPayload: { skillId: sk.id, skillName: sk.name, version: sk.version, output: exec.output },
              orbState: 'EXECUTING',
              latencyMs: Date.now() - start,
              reply,
            });
          }
        }
      }
    }

    // Tier 2: Learned Phrase Cache (skip any empty/legacy placeholder phrases)
    const normalizedKey = `${languageMode}::${lower.replace(/[^\p{L}\p{N}\s]/gu, '').trim()}`;
    if (!imageBase64 && intentPhraseCache.has(normalizedKey)) {
      const cached = intentPhraseCache.get(normalizedKey)!;
      if (
        cached.reply &&
        !/^নির্দেশ (সম্পন্ন|সম্পূর্ণ) হয়েছে[।.]?$/.test(cached.reply.trim())
      ) {
        return res.json({
          tier: 2,
          intent: cached.intent,
          moduleToOpen: cached.moduleToOpen,
          orbState: 'SPEAKING',
          latencyMs: Date.now() - start,
          reply: cached.reply,
        });
      }
      intentPhraseCache.delete(normalizedKey);
    }

    // Tier 3: Gemini 4 Hydrogen Brain with Pure Native Bengali / Hindi Enforcement
    const ai = getGeminiClient();
    if (!ai) {
      const noKeyReply =
        languageMode === 'hi'
          ? 'सर्वर पर Gemini Neural Key सेट नहीं है। कृपया AI Studio के Settings > Secrets पैनल में GEMINI_API_KEY जोड़ें।'
          : languageMode === 'en'
            ? 'Server Gemini Neural Core is not configured yet. Please add GEMINI_API_KEY in AI Studio Settings > Secrets.'
            : 'সার্ভারে Gemini Neural Core এখনও কনফিগার করা হয়নি। অনুগ্রহ করে AI Studio-র Settings > Secrets প্যানেলে GEMINI_API_KEY সেট করুন।';
      return res.status(503).json({
        error: noKeyReply,
      });
    }

    const extractReplyText = (resp: unknown): string => {
      const r = resp as {
        text?: string;
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
        }>;
      };
      const direct = typeof r?.text === 'string' ? r.text.trim() : '';
      if (direct) return direct;
      const parts = r?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        return parts
          .filter((p) => typeof p?.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('')
          .trim();
      }
      return '';
    };

    try {
      const langDirective =
        languageMode === 'bn'
          ? 'STRICT LANGUAGE RULE: Always reply ONLY in pure, natural, everyday conversational Bengali script (বাংলা) like a real warm human friend/assistant. Avoid stiff textbook language or robotic templates.'
          : languageMode === 'hi'
            ? 'STRICT LANGUAGE RULE: Always reply ONLY in pure, natural, everyday conversational Hindi Devanagari script (हिन्दी) like a real warm human friend/assistant. Avoid stiff textbook language or robotic templates.'
            : languageMode === 'en'
              ? 'Reply clearly, warmly, and naturally like a real human conversational partner in English.'
              : 'LANGUAGE ADAPTATION RULE: Detect the user language automatically. If the user writes or speaks in Bengali or Banglish, reply strictly in pure, natural conversational Bengali script (বাংলা). If the user writes or speaks in Hindi or Hinglish, reply strictly in pure, natural conversational Hindi Devanagari script (हिन्दी). Keep tone genuinely human.';

      const systemPrompt = `You are ${activeAssistantName}, an intelligent, perceptive, genuinely human-like AI companion. Always refer to yourself as "${activeAssistantName}" when asked your name.
Owner: ${identityState.owner.preferred_name} (${identityState.owner.location}).
Persona: Expressive, warm, attentive, thoughtful, and natural — never give generic robotic one-liners. Engage meaningfully with whatever the user asks or says.
${langDirective}
Keep voice-ready replies natural like spoken human conversation, and free of raw markdown symbols unless structured lists are explicitly requested.`;

      const contents: Array<Record<string, unknown>> = [];
      for (const h of history.slice(-8)) {
        if (h?.text) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: String(h.text) }],
          });
        }
      }

      const currentParts: Array<Record<string, unknown>> = [];
      if (imageBase64) {
        currentParts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
          },
        });
      }
      currentParts.push({ text: message || 'Analyze this image thoroughly.' });
      contents.push({ role: 'user', parts: currentParts });

      let reply = '';
      let primaryErr = '';
      try {
        const primaryResp = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction: systemPrompt,
          },
        });
        reply = extractReplyText(primaryResp);
      } catch (err: unknown) {
        primaryErr = err instanceof Error ? err.message : String(err);
      }

      if (!reply) {
        const fallbackResp = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            systemInstruction: systemPrompt,
          },
        });
        reply = extractReplyText(fallbackResp);
      }

      if (!reply) {
        return res.status(502).json({
          error: primaryErr
            ? `Brahma Neural Core error: ${primaryErr}`
            : 'Gemini মডেল থেকে কোনো টেক্সট উত্তর আসেনি। অনুগ্রহ করে আবার চেষ্টা করুন।',
        });
      }

      if (!imageBase64 && message.length < 90) {
        intentPhraseCache.set(normalizedKey, { intent: 'general_conversation', reply });
      }

      remoteLogs.unshift({
        id: `rc-${Date.now()}`,
        source: 'web',
        text: message,
        status: 'executed',
        timestamp: new Date().toISOString(),
      });
      if (remoteLogs.length > 35) remoteLogs.pop();

      return res.json({
        tier: 3,
        intent: 'general_conversation',
        orbState: 'SPEAKING',
        latencyMs: Date.now() - start,
        reply,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Brahma Neural Core error: ${msg}` });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Deep Formidable Native Multilingual TTS (Gemini 3.8 TTS)
  // -------------------------------------------------------------------------
  app.post('/api/tts', async (req, res) => {
    const rawText = String(req.body?.text || '').trim();
    const voiceProfile = String(req.body?.voiceProfile || 'deep-voinkor');
    const languageMode = String(req.body?.languageMode || 'auto');

    if (!rawText) {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is required for Gemini Neural TTS.' });
    }

    // Strip markdown artifacts so TTS speaks clean prose
    const cleanText = rawText
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*_`#>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);

    const hasBengali = /[\u0980-\u09FF]/.test(cleanText);
    const hasHindi = /[\u0900-\u097F]/.test(cleanText);
    const langDesc =
      languageMode === 'bn' || hasBengali
        ? 'pure native Bengali (Bangla)'
        : languageMode === 'hi' || hasHindi
          ? 'pure native Hindi'
          : 'natural authoritative speech';

    const styleMap: Record<string, { voice: string; style: string }> = {
      'male-deep-hard': {
        voice: 'Charon',
        style: `Speak like a real adult native ${langDesc} man with a very deep, heavy, resonant, firm baritone voice. Use natural human pauses, authentic South Asian ${langDesc} phonology, and crisp articulation with zero English or Western accent.`,
      },
      'male-commanding': {
        voice: 'Fenrir',
        style: `Speak like a strong, serious, commanding native ${langDesc} man with a hard, gravelly baritone voice. Completely natural native rhythm and zero English accent.`,
      },
      'male-soft-warm': {
        voice: 'Puck',
        style: `Speak like a kind, warm, soft-spoken native ${langDesc} man having a natural human conversation. Gentle, soothing, everyday ${langDesc} cadence with zero foreign accent.`,
      },
      'male-gentle': {
        voice: 'Charon',
        style: `Speak like a calm, respectful, gentle-voiced native ${langDesc} man with a soft, relaxed, natural human tone and pure native pronunciation.`,
      },
      'female-deep-hard': {
        voice: 'Kore',
        style: `Speak like a real adult native ${langDesc} woman with a deep, resonant, firm, serious alto voice. Authentic native South Asian ${langDesc} pronunciation and natural human expression with zero English accent.`,
      },
      'female-commanding': {
        voice: 'Kore',
        style: `Speak like a bold, confident, assertive native ${langDesc} woman with a strong, crisp, hard-edged voice. 100% pure native ${langDesc} accent and natural human pacing.`,
      },
      'female-soft-sweet': {
        voice: 'Zephyr',
        style: `Speak like a warm, gentle, soft-spoken native ${langDesc} woman with a sweet, natural, human conversational voice. Pure native South Asian ${langDesc} intonation with zero English drawl.`,
      },
      'female-warm-calm': {
        voice: 'Zephyr',
        style: `Speak like a calm, friendly, soft-hearted native ${langDesc} woman speaking naturally in everyday ${langDesc}. Warm human rhythm and zero English accent.`,
      },
      // Legacy aliases
      'deep-voinkor': {
        voice: 'Charon',
        style: `Speak like a real adult native ${langDesc} man with a very deep, firm baritone voice and 100% pure native pronunciation with zero English accent.`,
      },
      commanding: {
        voice: 'Fenrir',
        style: `Deep, strong, commanding native ${langDesc} male baritone voice with zero foreign accent.`,
      },
      'calm-deep': {
        voice: 'Puck',
        style: `Soft, warm, natural native ${langDesc} male voice with zero English accent.`,
      },
    };

    const chosen = styleMap[voiceProfile] || styleMap['male-deep-hard'];

    const aiAlpha = new GoogleGenAI({
      apiKey: getServerGeminiKey(),
      apiVersion: 'v1alpha',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const attempts: Array<{ client: GoogleGenAI; model: string; useSpeechConfig: boolean; useStyle: boolean }> = [
      { client: ai, model: 'gemini-3.8-flash-tts', useSpeechConfig: true, useStyle: true },
      { client: ai, model: 'gemini-3.8-flash-lite-tts', useSpeechConfig: true, useStyle: true },
      { client: aiAlpha, model: 'gemini-3.8-flash-tts', useSpeechConfig: true, useStyle: true },
      { client: aiAlpha, model: 'gemini-3.8-flash-lite-tts', useSpeechConfig: true, useStyle: true },
      { client: ai, model: 'gemini-3.8-flash-lite-tts', useSpeechConfig: true, useStyle: false },
    ];

    let lastErr = 'No TTS attempt succeeded';
    for (const attempt of attempts) {
      try {
        const config: Record<string, unknown> = {
          responseModalities: ['AUDIO'],
        };
        if (attempt.useSpeechConfig) {
          config.speechConfig = {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: chosen.voice,
              },
            },
          };
        }

        const partPayload: Record<string, unknown> = { text: cleanText };
        if (attempt.useStyle) {
          partPayload.speechMetadata = {
            style: `${chosen.style} Sound genuinely human with natural breath pauses, emotional inflection, and zero robotic monotony.`,
          };
        }

        const response = await attempt.client.models.generateContent({
          model: attempt.model,
          contents: [
            {
              role: 'user',
              parts: [partPayload],
            },
          ],
          config,
        });

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const audioPart = parts.find((p) => p?.inlineData?.data);
        const base64Audio = audioPart?.inlineData?.data;
        if (base64Audio) {
          return res.json({
            audioBase64: base64Audio,
            mimeType: audioPart?.inlineData?.mimeType || 'audio/wav',
            voiceName: chosen.voice,
            modelUsed: attempt.model,
          });
        }
      } catch (err: unknown) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
    }

    console.error('[Brahma /api/tts] All attempts failed:', lastErr);
    return res.status(500).json({ error: `Gemini TTS failed: ${lastErr}` });
  });

  // -------------------------------------------------------------------------
  // 3. Multilingual Audio Transcription Fallback (gemini-3.5-transcribe)
  // -------------------------------------------------------------------------
  app.post('/api/transcribe', async (req, res) => {
    const audioBase64 = String(req.body?.audioBase64 || '').trim();
    const mimeType = String(req.body?.mimeType || 'audio/webm');
    const languageMode = String(req.body?.languageMode || 'auto');

    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is required for audio transcription.' });
    }

    try {
      const cleanB64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const hint =
        languageMode === 'bn'
          ? 'Transcribe accurately in Bengali script (বাংলা). Return ONLY the spoken transcript text.'
          : languageMode === 'hi'
            ? 'Transcribe accurately in Hindi Devanagari script (हिन्दी). Return ONLY the spoken transcript text.'
            : 'Transcribe accurately in the exact spoken language (Bengali, Hindi, or English). Return ONLY the spoken transcript text.';

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType, data: cleanB64 } },
            { text: hint },
          ],
        },
      });
      return res.json({ text: (response.text || '').trim() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Transcription error: ${msg}` });
    }
  });

  // -------------------------------------------------------------------------
  // 4. Autonomous Automation Workflows API
  // -------------------------------------------------------------------------
  app.get('/api/automations', (_req, res) => {
    res.json({ workflows: automationWorkflows });
  });

  app.post('/api/automations/run/:id', (req, res) => {
    const wf = automationWorkflows.find((w) => w.id === req.params.id);
    if (!wf) return res.status(404).json({ error: 'Automation workflow not found.' });
    const lang = String(req.body?.languageMode || 'bn');
    const result = executeWorkflow(wf, lang);
    res.json({ result, workflows: automationWorkflows, devices: smartDevices });
  });

  app.post('/api/automations/toggle/:id', (req, res) => {
    const wf = automationWorkflows.find((w) => w.id === req.params.id);
    if (!wf) return res.status(404).json({ error: 'Automation workflow not found.' });
    wf.enabled = !wf.enabled;
    res.json({ workflow: wf, workflows: automationWorkflows });
  });

  app.delete('/api/automations/:id', (req, res) => {
    const idx = automationWorkflows.findIndex((w) => w.id === req.params.id);
    if (idx !== -1) automationWorkflows.splice(idx, 1);
    res.json({ ok: true, workflows: automationWorkflows });
  });

  app.post('/api/automations/create-ai', async (req, res) => {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'Describe the automation workflow you want.' });

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is required to synthesize AI automations.' });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a structured autonomous automation rule for Brahma AI Evo from this request: "${prompt}".
Available Smart Home device IDs:
- "dev-light" (Studio Ambient Light, level 0-100)
- "dev-ac" (Climate Inverter AC, level 16-30)
- "dev-fan" (Atomberg BLDC Fan, level 1-5)
- "dev-plug" (Workstation Smart Plug)
- "dev-tv" (HUD Display Panel TV, level 0-100)
Available modules: "command", "voice", "automation", "globe", "circuit", "skills", "smart-office", "remote".
Return pure Bengali or Hindi name/description/speak_briefing matching the user's language, plus comma-separated voice triggerPhrases.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              triggerPhrase: { type: Type.STRING },
              triggerType: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    label: { type: Type.STRING },
                    deviceId: { type: Type.STRING },
                    power: { type: Type.BOOLEAN },
                    level: { type: Type.INTEGER },
                    module: { type: Type.STRING },
                    message: { type: Type.STRING },
                  },
                  required: ['type', 'label'],
                },
              },
            },
            required: ['name', 'description', 'triggerPhrase', 'steps'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const validTypes = ['voice', 'schedule', 'battery_low', 'manual'];
      const wf: AutomationWorkflow = {
        id: `auto-${Date.now()}`,
        name: String(parsed.name || 'Custom Neural Automation'),
        description: String(parsed.description || prompt),
        triggerPhrase: String(parsed.triggerPhrase || prompt),
        triggerType: validTypes.includes(parsed.triggerType) ? parsed.triggerType : 'voice',
        enabled: true,
        runCount: 0,
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      };
      automationWorkflows.unshift(wf);
      return res.json({ workflow: wf, workflows: automationWorkflows });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Automation synthesizer failed: ${msg}` });
    }
  });

  // -------------------------------------------------------------------------
  // 5. Circuit Assembler & Hardware Vision Solver
  // -------------------------------------------------------------------------
  app.get('/api/circuit/presets', (_req, res) => {
    res.json({
      presets: Object.entries(CIRCUIT_PRESETS).map(([id, data]) => ({
        id,
        title: data.title,
        description: data.description,
        data,
      })),
    });
  });

  app.post('/api/circuit/solve', async (req, res) => {
    const query = String(req.body?.query || '').trim();
    const imageBase64 = req.body?.imageBase64 ? String(req.body.imageBase64) : null;
    const imageMimeType = req.body?.imageMimeType ? String(req.body.imageMimeType) : 'image/png';

    if (!query && !imageBase64) {
      return res.status(400).json({ error: 'Provide component names, a wiring question, or a hardware photo.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is required for custom AI circuit synthesis.',
      });
    }

    try {
      const parts: Array<Record<string, unknown>> = [];
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
          },
        });
      }
      parts.push({
        text: `Design a clean, accurate pin-to-pin electronic wiring schematic for: "${query || 'Identify components in the photo and wire them safely'}".
Rules:
- Arrange 2 to 4 components left-to-right.
- Every wire "from" and "to" MUST strictly follow "<component.id>:<left|right>:<pin.name>" matching exact component ids and pin names.
- Use vibrant hex colors (#f97316 for VCC/5V, #f8fafc for GND, #fbbf24 for DATA/SDA, #00e5ff for CLK/TRIG, #22c55e for GPIO/PWM).
- Include practical voltage-level safety warnings and numbered assembly steps.`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              components: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    highlight: { type: Type.BOOLEAN },
                    left_pins: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          badge: { type: Type.STRING },
                          color: { type: Type.STRING },
                        },
                        required: ['name', 'color'],
                      },
                    },
                    right_pins: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          badge: { type: Type.STRING },
                          color: { type: Type.STRING },
                        },
                        required: ['name', 'color'],
                      },
                    },
                  },
                  required: ['id', 'name', 'subtitle', 'left_pins', 'right_pins'],
                },
              },
              wires: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    from: { type: Type.STRING },
                    to: { type: Type.STRING },
                    color: { type: Type.STRING },
                    label: { type: Type.STRING },
                    step: { type: Type.INTEGER },
                  },
                  required: ['from', 'to', 'color', 'label'],
                },
              },
              warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['title', 'description', 'components', 'wires', 'warnings', 'steps'],
          },
        },
      });

      return res.json({ schematic: JSON.parse(response.text || '{}') });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Circuit solver failed: ${msg}` });
    }
  });

  // -------------------------------------------------------------------------
  // 5.5 Live Vision Single-Frame Analyzer Fallback
  // -------------------------------------------------------------------------
  app.post('/api/vision/analyze-frame', async (req, res) => {
    const imageBase64 = String(req.body?.imageBase64 || '').trim();
    const mimeType = String(req.body?.mimeType || 'image/jpeg');
    const prompt = String(req.body?.prompt || '').trim();
    const languageMode = String(req.body?.languageMode || 'bn');

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 frame is required.' });
    }
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is required for Live Vision analysis.' });
    }

    try {
      const langRule =
        languageMode === 'hi'
          ? 'उत्तर केवल शुद्ध, स्वाभाविक हिन्दी (देवनागरी) में दें।'
          : languageMode === 'en'
            ? 'Reply concisely and commandingly in English.'
            : 'উত্তর শুধুমাত্র শুদ্ধ, স্বাভাবিক বাংলায় দিন (কোনো অপ্রয়োজনীয় ইংরেজি টান ছাড়া)।';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
              },
            },
            {
              text: `${prompt || 'Analyze this live mobile screen or camera frame. Identify what is shown, detect any problems, buttons, objects or code, and advise clearly.'}\n${langRule}`,
            },
          ],
        },
      });
      return res.json({ analysis: (response.text || '').trim() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Vision frame analysis failed: ${msg}` });
    }
  });

  // -------------------------------------------------------------------------
  // 6. Project Ultron — Self-Evolving Skill Forge & VM Crucible
  // -------------------------------------------------------------------------
  app.get('/api/skills', (_req, res) => {
    res.json({ skills: skillsStore });
  });

  async function synthesizeAndVerifySkill(
    ai: GoogleGenAI,
    goal: string,
    existing?: SkillEntry
  ): Promise<SkillEntry> {
    const prompt = existing
      ? `You are Project Ultron (Autonomous Self-Evolving Engine). Evolve and upgrade the existing skill "${existing.name}" (${existing.version}) based on this directive: "${goal}".
Current code:
${existing.code}
Current test output: ${existing.lastTestOutput || 'none'}
Requirements:
1. Write pure synchronous JavaScript (NO import, export, require, fetch, async, or DOM APIs).
2. MUST define "function run(input) { ... }" returning a clear string result.
3. Expand functionality, handle edge cases, and provide 3-4 deterministic testCases ({ input, expectedContains }) that verify run(input).
4. Include multilingual trigger keywords (comma-separated in English, Bengali, and Hindi).`
      : `You are Project Ultron (Autonomous Self-Evolving Skill Forge). Synthesize a real executable JavaScript skill for this request: "${goal}".
Requirements:
1. Write pure synchronous JavaScript (NO import, export, require, fetch, async, or DOM APIs).
2. MUST define "function run(input) { ... }" taking a string input and returning a clear string result.
3. Provide 3 deterministic testCases ({ input, expectedContains }) where expectedContains is an exact substring present in run(input).
4. Include comma-separated trigger keywords (English, Bengali, Hindi).`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        trigger: { type: Type.STRING },
        code: { type: Type.STRING },
        testCases: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              input: { type: Type.STRING },
              expectedContains: { type: Type.STRING },
            },
            required: ['input', 'expectedContains'],
          },
        },
      },
      required: ['name', 'description', 'trigger', 'code', 'testCases'],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: schema },
    });

    const forged = JSON.parse(response.text || '{}');
    const nextVersionNum = existing ? Number(existing.version.replace(/[^\d]/g, '') || 1) + 1 : 1;

    const candidate: SkillEntry = {
      id: existing ? existing.id : `sk-${Date.now()}`,
      name: String(forged.name || existing?.name || 'evolved_skill')
        .replace(/\s+/g, '_')
        .toLowerCase(),
      version: `v${nextVersionNum}.0`,
      evolutionCount: existing ? existing.evolutionCount + 1 : 0,
      category: existing ? existing.category : 'ultron-forged',
      description: String(forged.description || existing?.description || goal),
      trigger: String(forged.trigger || existing?.trigger || goal),
      status: 'sandboxed',
      code: sanitizeSkillCode(String(forged.code || existing?.code || 'function run(input){ return String(input); }')),
      testsPassed: 0,
      testsTotal: 0,
      testCases: Array.isArray(forged.testCases) && forged.testCases.length > 0
        ? forged.testCases
        : existing?.testCases || [{ input: 'test', expectedContains: '' }],
      executions: existing ? existing.executions : 0,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };

    let report = testSkillInCrucible(candidate);

    // Self-healing pass if any Crucible test failed
    if (report.passed < report.total) {
      const healRes = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Crucible VM tests failed (${report.passed}/${report.total}) for skill "${candidate.name}".
Code:
${candidate.code}
Failures:
${JSON.stringify(report.details.filter((d) => !d.pass))}
Fix the pure JavaScript "function run(input)" and/or testCases so 100% of assertions pass deterministically without external APIs.`,
        config: { responseMimeType: 'application/json', responseSchema: schema },
      });
      const healed = JSON.parse(healRes.text || '{}');
      if (healed.code) candidate.code = sanitizeSkillCode(String(healed.code));
      if (Array.isArray(healed.testCases) && healed.testCases.length > 0) {
        candidate.testCases = healed.testCases;
      }
      report = testSkillInCrucible(candidate);
      candidate.lastTestOutput = `${report.passed}/${report.total} passed after Self-Heal (${report.latencyMs}ms)`;
    }

    return candidate;
  }

  app.post('/api/skills/forge', async (req, res) => {
    const goal = String(req.body?.goal || '').trim();
    if (!goal) return res.status(400).json({ error: 'Describe the capability or skill you want Brahma to synthesize.' });

    const ai = getGeminiClient();
    if (!ai) return res.status(503).json({ error: 'GEMINI_API_KEY is required to run Project Ultron Skill Forge.' });

    try {
      const newSkill = await synthesizeAndVerifySkill(ai, goal);
      skillsStore.unshift(newSkill);
      return res.json({ skill: newSkill, skills: skillsStore });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Skill Forge error: ${msg}` });
    }
  });

  app.post('/api/skills/test/:id', (req, res) => {
    const sk = skillsStore.find((s) => s.id === req.params.id);
    if (!sk) return res.status(404).json({ error: 'Skill not found.' });
    const report = testSkillInCrucible(sk);
    return res.json({ skill: sk, report, skills: skillsStore });
  });

  app.post('/api/skills/run/:id', (req, res) => {
    const sk = skillsStore.find((s) => s.id === req.params.id);
    if (!sk) return res.status(404).json({ error: 'Skill not found.' });
    const input = String(req.body?.input || '');
    const exec = runSkillInCrucible(sk.code, input);
    if (exec.ok) {
      sk.executions += 1;
    }
    return res.json({ ...exec, skill: sk });
  });

  app.post('/api/skills/evolve/:id', async (req, res) => {
    const idx = skillsStore.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Skill not found.' });

    const ai = getGeminiClient();
    if (!ai) return res.status(503).json({ error: 'GEMINI_API_KEY is required to evolve skills.' });

    const current = skillsStore[idx];
    const instruction =
      String(req.body?.instruction || '').trim() ||
      'Make this skill smarter, faster, more accurate, handle Bengali/Hindi/English edge cases, and add stronger Crucible verification tests.';

    try {
      const evolved = await synthesizeAndVerifySkill(ai, instruction, current);
      skillsStore[idx] = evolved;
      memoryStore.unshift({
        id: `mem-${Date.now()}`,
        category: 'rule',
        key: `Skill Evolved: ${evolved.name}`,
        value: `Upgraded to ${evolved.version} (${evolved.testsPassed}/${evolved.testsTotal} Crucible tests passed)`,
        createdAt: new Date().toISOString(),
      });
      return res.json({ skill: evolved, skills: skillsStore });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Self-Evolution failed: ${msg}` });
    }
  });

  app.post('/api/skills/auto-learn', async (_req, res) => {
    const ai = getGeminiClient();
    if (!ai) return res.status(503).json({ error: 'GEMINI_API_KEY is required for autonomous learning.' });

    try {
      const existingNames = skillsStore.map((s) => s.name).join(', ');
      const recentSignals = remoteLogs.slice(0, 6).map((l) => l.text).join('; ');
      const recentMemories = memoryStore.slice(0, 5).map((m) => `${m.key}: ${m.value}`).join('; ');

      const ideaRes = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Inspect recent operator activity (${recentSignals || 'general Android assistant use'}) and memory (${recentMemories}).
Existing skills: ${existingNames}.
Propose ONE brand new, genuinely practical executable skill (e.g. unit/currency converter, resistor color code decoder, password strength auditor, study timer planner, or JSON validator) that does NOT duplicate existing skills. Reply in one short goal sentence.`,
      });
      const goal = (ideaRes.text || 'Build a 4-band resistor color code ohm calculator').trim();
      const learnedSkill = await synthesizeAndVerifySkill(ai, goal);
      skillsStore.unshift(learnedSkill);
      return res.json({ skill: learnedSkill, goalDiscovered: goal, skills: skillsStore });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Auto-Learn failed: ${msg}` });
    }
  });

  app.delete('/api/skills/:id', (req, res) => {
    const idx = skillsStore.findIndex((s) => s.id === req.params.id);
    if (idx !== -1) skillsStore.splice(idx, 1);
    res.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // 7. Smart Home Hub
  // -------------------------------------------------------------------------
  app.get('/api/smart-home', (_req, res) => {
    res.json({ devices: smartDevices });
  });

  app.post('/api/smart-home/update', (req, res) => {
    const { id, power, level } = req.body || {};
    const dev = smartDevices.find((d) => d.id === id);
    if (!dev) return res.status(404).json({ error: 'Device not found' });
    if (typeof power === 'boolean') dev.power = power;
    if (typeof level === 'number' && Number.isFinite(level)) dev.level = level;
    res.json({ device: dev, devices: smartDevices });
  });

  // -------------------------------------------------------------------------
  // 8. Autonomous Office & Document Architect
  // -------------------------------------------------------------------------
  app.post('/api/office/generate', async (req, res) => {
    const docType = String(req.body?.docType || 'spreadsheet');
    const topic = String(req.body?.topic || '').trim();
    if (!topic) return res.status(400).json({ error: 'Topic or prompt is required.' });

    const ai = getGeminiClient();
    if (!ai) return res.status(503).json({ error: 'GEMINI_API_KEY is required for Office Document Architect.' });

    try {
      if (docType === 'spreadsheet') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Create a professional multi-column Excel-ready spreadsheet dataset for: "${topic}". Include headers, 6-10 realistic rows, and a summary insight.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
              },
              required: ['title', 'summary', 'headers', 'rows'],
            },
          },
        });
        return res.json({ docType, result: JSON.parse(response.text || '{}') });
      }

      if (docType === 'presentation') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Create a 6-slide executive PowerPoint deck structure for: "${topic}". Each slide needs a punchy title, 3-4 concise bullet points, and speaker notes.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                slides: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      slideNumber: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                      speakerNotes: { type: Type.STRING },
                    },
                    required: ['slideNumber', 'title', 'bullets', 'speakerNotes'],
                  },
                },
              },
              required: ['title', 'subtitle', 'slides'],
            },
          },
        });
        return res.json({ docType, result: JSON.parse(response.text || '{}') });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Write a structured professional executive document / report in clean Markdown for: "${topic}".`,
      });
      return res.json({
        docType: 'document',
        result: { title: topic, markdown: (response.text || '').trim() },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Office Architect error: ${msg}` });
    }
  });

  // -------------------------------------------------------------------------
  // 9. Identity & Adaptive Memory Cortex
  // -------------------------------------------------------------------------
  app.get('/api/identity', (_req, res) => {
    res.json({ identity: identityState });
  });

  app.post('/api/identity', (req, res) => {
    const { owner, assistant, behavior } = req.body || {};
    if (owner) Object.assign(identityState.owner, owner);
    if (assistant) Object.assign(identityState.assistant, assistant);
    if (behavior) Object.assign(identityState.behavior, behavior);
    res.json({ identity: identityState });
  });

  app.get('/api/memory', (_req, res) => {
    res.json({ memories: memoryStore });
  });

  app.post('/api/memory', (req, res) => {
    const { category = 'preference', key, value } = req.body || {};
    if (!key || !value) return res.status(400).json({ error: 'Both key and value are required.' });
    const item: MemoryItem = {
      id: `mem-${Date.now()}`,
      category,
      key: String(key),
      value: String(value),
      createdAt: new Date().toISOString(),
    };
    memoryStore.unshift(item);
    res.json({ memory: item, memories: memoryStore });
  });

  app.delete('/api/memory/:id', (req, res) => {
    const idx = memoryStore.findIndex((m) => m.id === req.params.id);
    if (idx !== -1) memoryStore.splice(idx, 1);
    res.json({ ok: true, memories: memoryStore });
  });

  // -------------------------------------------------------------------------
  // 10. Daily Briefing & Live Telemetry (Weather + ISS)
  // -------------------------------------------------------------------------
  app.get('/api/briefing', async (_req, res) => {
    let weather = {
      location: identityState.owner.location || 'Kolkata',
      tempC: 28,
      condition: 'Clear Neural Sky',
      windKmh: 11,
      humidity: 64,
    };
    let iss = { latitude: 22.57, longitude: 88.36, altitudeKm: 419, velocityKmh: 27580 };

    try {
      const wRes = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=22.5726&longitude=88.3639&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code'
      );
      if (wRes.ok) {
        const wJson = (await wRes.json()) as {
          current?: { temperature_2m?: number; relative_humidity_2m?: number; wind_speed_10m?: number };
        };
        if (wJson.current) {
          weather = {
            ...weather,
            tempC: Math.round(wJson.current.temperature_2m ?? 28),
            humidity: Math.round(wJson.current.relative_humidity_2m ?? 64),
            windKmh: Math.round(wJson.current.wind_speed_10m ?? 11),
          };
        }
      }
    } catch {
      // fallback
    }

    try {
      const iRes = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      if (iRes.ok) {
        const iJson = (await iRes.json()) as {
          latitude?: number;
          longitude?: number;
          altitude?: number;
          velocity?: number;
        };
        iss = {
          latitude: Number((iJson.latitude ?? 22.57).toFixed(2)),
          longitude: Number((iJson.longitude ?? 88.36).toFixed(2)),
          altitudeKm: Math.round(iJson.altitude ?? 419),
          velocityKmh: Math.round(iJson.velocity ?? 27580),
        };
      }
    } catch {
      // fallback
    }

    res.json({
      weather,
      iss,
      stats: {
        activeSkills: skillsStore.length,
        onlineDevices: smartDevices.filter((d) => d.power).length,
        totalDevices: smartDevices.length,
        memoriesIndexed: memoryStore.length,
        activeAutomations: automationWorkflows.filter((a) => a.enabled).length,
      },
    });
  });

  // -------------------------------------------------------------------------
  // 11. Remote Dashboard & File Transfer
  // -------------------------------------------------------------------------
  app.get('/api/remote/state', (_req, res) => {
    res.json({
      logs: remoteLogs,
      files: sharedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        uploadedAt: f.uploadedAt,
      })),
    });
  });

  app.post('/api/remote/action', (req, res) => {
    const { type, action, text } = req.body || {};
    const label = text ? `Type: ${text}` : `${type}: ${action}`;
    remoteLogs.unshift({
      id: `rc-${Date.now()}`,
      source: 'mobile-remote',
      text: label,
      status: 'executed',
      timestamp: new Date().toISOString(),
    });
    if (remoteLogs.length > 35) remoteLogs.pop();
    res.json({ ok: true, logs: remoteLogs });
  });

  app.post('/api/remote/upload', (req, res) => {
    const { name, mimeType, contentBase64, size } = req.body || {};
    if (!name || !contentBase64) {
      return res.status(400).json({ error: 'File name and contentBase64 are required.' });
    }
    const entry: UploadedFileEntry = {
      id: `file-${Date.now()}`,
      name: String(name),
      size: Number(size || Buffer.from(contentBase64, 'base64').length),
      mimeType: String(mimeType || 'application/octet-stream'),
      contentBase64: String(contentBase64),
      uploadedAt: new Date().toISOString(),
    };
    sharedFiles.unshift(entry);
    res.json({
      file: {
        id: entry.id,
        name: entry.name,
        size: entry.size,
        mimeType: entry.mimeType,
        uploadedAt: entry.uploadedAt,
      },
    });
  });

  app.get('/api/remote/files/:id', (req, res) => {
    const entry = sharedFiles.find((f) => f.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'File not found' });
    const buf = Buffer.from(entry.contentBase64, 'base64');
    res.setHeader('Content-Type', entry.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${entry.name}"`);
    res.send(buf);
  });

  // -------------------------------------------------------------------------
  // 11.5 Real Termux Terminal, App Builder & Android APK GitHub Status APIs
  // -------------------------------------------------------------------------
  app.get('/api/terminal/state', (_req, res) => {
    res.json({
      running: terminalRunning,
      currentTask: terminalCurrentTask,
      cwd: currentTerminalCwd.replace(WORKSPACE_ROOT, '~') || '~',
      lines: terminalLines.slice(-150),
      projects: builtProjects,
    });
  });

  app.post('/api/terminal/clear', (_req, res) => {
    terminalLines.splice(0, terminalLines.length, {
      id: `tl-${Date.now()}`,
      kind: 'info',
      text: `Terminal cleared (${WORKSPACE_ROOT})`,
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true, lines: terminalLines });
  });

  app.post('/api/terminal/exec', async (req, res) => {
    const command = String(req.body?.command || '').trim();
    if (!command) return res.status(400).json({ error: 'Command is required.' });
    terminalRunning = true;
    terminalCurrentTask = command;
    try {
      const result = await executeRealShellCommand(command);
      return res.json({
        ...result,
        cwd: currentTerminalCwd.replace(WORKSPACE_ROOT, '~') || '~',
        lines: terminalLines.slice(-150),
        projects: builtProjects,
      });
    } finally {
      terminalRunning = false;
      terminalCurrentTask = '';
    }
  });

  app.post('/api/terminal/agent', async (req, res) => {
    const task = String(req.body?.task || '').trim();
    const languageMode = String(req.body?.languageMode || 'bn');
    if (!task) return res.status(400).json({ error: 'Task description is required.' });
    try {
      const agentRes = await runAutonomousTerminalAgent(task, languageMode);
      return res.json({
        ...agentRes,
        cwd: currentTerminalCwd.replace(WORKSPACE_ROOT, '~') || '~',
        lines: terminalLines.slice(-150),
        projects: builtProjects,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: msg });
    }
  });

  app.get('/api/terminal/download/:slug', (req, res) => {
    const slug = String(req.params.slug || '').replace(/[^a-z0-9-]/gi, '');
    const projDir = path.join(PROJECTS_ROOT, slug);
    if (!fs.existsSync(projDir)) return res.status(404).json({ error: 'Project not found.' });

    const entries: Array<{ name: string; content: Buffer }> = [];
    const walk = (dir: string, prefix = '') => {
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const rel = prefix ? `${prefix}/${item}` : item;
        if (fs.statSync(full).isDirectory()) {
          walk(full, rel);
        } else {
          entries.push({ name: rel, content: fs.readFileSync(full) });
        }
      }
    };
    walk(projDir);
    const zipBuf = createZipBuffer(entries);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);
    res.send(zipBuf);
  });

  app.get('/api/android/status', async (_req, res) => {
    const requiredFiles = [
      'capacitor.config.ts',
      'android/build.gradle',
      'android/settings.gradle',
      'android/app/build.gradle',
      'android/app/src/main/AndroidManifest.xml',
      'android/app/src/main/res/xml/accessibility_service_config.xml',
      'android/app/src/main/java/com/brahma/evo/MainActivity.kt',
      'android/app/src/main/java/com/brahma/evo/BrahmaOverlayService.kt',
      'android/app/src/main/java/com/brahma/evo/BrahmaAccessibilityService.kt',
      '.github/workflows/build-apk.yml',
    ];
    const fileChecks = requiredFiles.map((f) => ({
      path: f,
      exists: fs.existsSync(path.join(__dirname, f)),
    }));
    const hasLocalAndroidSdk = fs.existsSync('/usr/bin/gradle') || fs.existsSync('/usr/local/bin/gradle');

    res.json({
      readyForGithubApk: fileChecks.every((c) => c.exists),
      hasLocalAndroidSdk,
      packageId: 'com.brahma.evo',
      workflowPath: '.github/workflows/build-apk.yml',
      fileChecks,
    });
  });

  app.get('/api/android/download-bundle', (_req, res) => {
    const entries: Array<{ name: string; content: Buffer }> = [];
    const addPath = (rel: string) => {
      const full = path.join(__dirname, rel);
      if (!fs.existsSync(full)) return;
      if (fs.statSync(full).isDirectory()) {
        for (const item of fs.readdirSync(full)) {
          addPath(`${rel}/${item}`);
        }
      } else {
        entries.push({ name: rel, content: fs.readFileSync(full) });
      }
    };
    addPath('capacitor.config.ts');
    addPath('android');
    addPath('.github/workflows/build-apk.yml');

    const zipBuf = createZipBuffer(entries);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="brahma-android-apk-project.zip"');
    res.send(zipBuf);
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        allowedHosts: true,
        ws: {
          server: httpServer,
          path: '/vite-hmr',
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // -------------------------------------------------------------------------
  // 12. Ultra-Low-Latency Live Screen & Camera Video WebSocket (/ws/live-vision)
  // -------------------------------------------------------------------------
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const { pathname } = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (pathname === '/ws/live-vision') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      // ignore malformed upgrade URLs
    }
  });

  wss.on('connection', async (clientWs, req) => {
    const apiKey = getServerGeminiKey();
    if (!apiKey) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }));
      clientWs.close();
      return;
    }

    const aiLive = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1alpha',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const reqUrl = new URL(req.url || '/ws/live-vision', `http://${req.headers.host || 'localhost'}`);
    const langParam = reqUrl.searchParams.get('lang') || 'bn';
    const voiceParam = reqUrl.searchParams.get('voice') || 'Charon';
    const modeParam = reqUrl.searchParams.get('mode') || 'vision';
    const assistantNameParam = (reqUrl.searchParams.get('name') || identityState.assistant.name || 'ব্রহ্মা AI').trim();
    const silentParam = reqUrl.searchParams.get('silent') !== 'false';
    const allowedVoices = ['Charon', 'Fenrir', 'Puck', 'Kore', 'Zephyr'];
    const voiceName = allowedVoices.includes(voiceParam) ? voiceParam : 'Charon';

    const langRule =
      langParam === 'hi'
        ? 'Speak ONLY in 100% pure, natural, human-like native Hindi (हिन्दी) with zero English accent, zero foreign drawl, and no Hinglish.'
        : langParam === 'en'
          ? 'Speak naturally and clearly in concise human English.'
          : 'Speak ONLY in 100% pure, natural, human-like native Bengali (বাংলা) with zero English accent, zero Western drawl, and no Banglish.';

    const silenceRule = silentParam
      ? 'CRITICAL SILENCE RULE: Stay completely silent and do NOT speak on your own first. Wait quietly and ONLY speak when the user actually speaks to you or sends a text question.'
      : 'Respond promptly when spoken to.';

    const systemInstruction =
      modeParam === 'voice'
        ? `You are ${assistantNameParam}, a deeply intelligent, warm, genuinely human-like AI voice companion.
${silenceRule}
Speak just like a real human conversational partner — natural pacing, soft human warmth, expressive intonation, never robotic. ${langRule}`
        : `You are ${assistantNameParam}, a natural human-like AI companion with ultra-low-latency Live Vision.
You are watching the user's live mobile screen share or camera feed.
${silenceRule}
Keep responses crisp, warm, natural like a real human speaker. ${langRule}`;

    let liveSession: Awaited<ReturnType<typeof aiLive.live.connect>> | null = null;
    let closed = false;

    try {
      liveSession = await aiLive.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            if (!closed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ ready: true, model: 'gemini-3.8-live', voice: voiceName }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (closed || clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(JSON.stringify({ inputTranscript: content.inputTranscription.text }));
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(JSON.stringify({ outputTranscript: content.outputTranscription.text }));
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err) => {
            if (!closed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({ error: err instanceof Error ? err.message : 'Live Vision stream error' })
              );
            }
          },
          onclose: () => {
            if (!closed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ sessionClosed: true }));
            }
          },
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: `Failed to connect Gemini Live Vision: ${msg}` }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw) => {
      if (closed || !liveSession) return;
      try {
        const msg = JSON.parse(raw.toString()) as { video?: string; audio?: string; text?: string };
        if (msg.video) {
          liveSession.sendRealtimeInput({
            video: { data: msg.video.replace(/^data:image\/\w+;base64,/, ''), mimeType: 'image/jpeg' },
          });
        }
        if (msg.audio) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
        if (msg.text) {
          liveSession.sendRealtimeInput({ text: String(msg.text) });
        }
      } catch {
        // ignore malformed packets
      }
    });

    clientWs.on('close', () => {
      closed = true;
      try {
        liveSession?.close();
      } catch {
        // ignore
      }
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Brahma AI Evo Android Edition] Server + Live Vision WS listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
