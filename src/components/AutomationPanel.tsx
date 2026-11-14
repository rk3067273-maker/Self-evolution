import React, { useEffect, useState } from 'react';
import {
  Workflow,
  Play,
  Sparkles,
  Trash2,
  Power,
  Clock,
  BatteryCharging,
  Mic,
  CheckCircle2,
  Volume2,
} from 'lucide-react';
import type {
  AutomationExecutionResult,
  AutomationWorkflow,
  BrahmaTab,
  LanguageMode,
} from '../types/brahma';
import { brahmaFetch } from '../lib/brahmaClient';

interface AutomationPanelProps {
  languageMode: LanguageMode;
  onSpeakDeepVoice: (text: string) => Promise<void>;
  onNavigate: (tab: BrahmaTab) => void;
}

export const AutomationPanel: React.FC<AutomationPanelProps> = ({
  languageMode,
  onSpeakDeepVoice,
  onNavigate,
}) => {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastExec, setLastExec] = useState<AutomationExecutionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [autoSchedulerActive, setAutoSchedulerActive] = useState(true);

  const loadWorkflows = async () => {
    try {
      const res = await brahmaFetch('/api/automations');
      const data = await res.json();
      if (Array.isArray(data.workflows)) setWorkflows(data.workflows);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadWorkflows();
    const nav = navigator as unknown as {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };
    nav.getBattery?.()
      .then((b) => setBatteryLevel(Math.round(b.level * 100)))
      .catch(() => {});
  }, []);

  const handleRun = async (wf: AutomationWorkflow) => {
    setRunningId(wf.id);
    setErrorMsg(null);
    navigator.vibrate?.([30, 40, 30]);
    try {
      const res = await brahmaFetch(`/api/automations/run/${wf.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languageMode }),
      });
      const data = await res.json();
      if (Array.isArray(data.workflows)) setWorkflows(data.workflows);
      if (data.result) {
        setLastExec(data.result);
        await onSpeakDeepVoice(data.result.spokenSummary);
        if (data.result.openModule && data.result.openModule !== 'automation') {
          onNavigate(data.result.openModule as BrahmaTab);
        }
      }
    } catch {
      setErrorMsg('অটোমেশন চালাতে সমস্যা হয়েছে।');
    } finally {
      setRunningId(null);
    }
  };

  const handleToggle = async (id: string) => {
    const res = await brahmaFetch(`/api/automations/toggle/${id}`, { method: 'POST' });
    const data = await res.json();
    if (Array.isArray(data.workflows)) setWorkflows(data.workflows);
  };

  const handleDelete = async (id: string) => {
    const res = await brahmaFetch(`/api/automations/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (Array.isArray(data.workflows)) setWorkflows(data.workflows);
  };

  const handleCreateAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const res = await brahmaFetch('/api/automations/create-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'অটোমেশন তৈরি করা যায়নি।');
      } else if (Array.isArray(data.workflows)) {
        setWorkflows(data.workflows);
        setPrompt('');
      }
    } catch {
      setErrorMsg('নেটওয়ার্ক ত্রুটি হয়েছে।');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#020305] overflow-hidden">
      {/* Header & AI Automation Builder */}
      <div className="p-4 bg-[#07080b] border-b border-cyan-500/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Workflow className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Autonomous Automation Engine
              </h2>
              <p className="text-[11px] text-slate-400">
                মাল্টি-স্টেপ ভয়েস ট্রিগার, স্মার্ট ডিভাইস চেইন ও সিডিউল অটোমেশন
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {batteryLevel !== null && (
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-emerald-300 inline-flex items-center gap-1">
                <BatteryCharging className="w-3.5 h-3.5" />
                {batteryLevel}%
              </span>
            )}
            <button
              type="button"
              onClick={() => setAutoSchedulerActive((v) => !v)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                autoSchedulerActive
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{autoSchedulerActive ? 'Auto-Daemon Active' : 'Daemon Paused'}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateAI} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="নতুন অটোমেশন লিখুন (যেমন: 'যখন বলব গেমিং মোড অন করো, লাইট ৩০% করে এসি ১৯ ডিগ্রি করবে এবং টিভি চালু করবে')"
            className="flex-1 min-w-[250px] bg-[#0d0f14] border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#020305] font-bold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{creating ? 'তৈরি হচ্ছে...' : 'AI অটোমেশন তৈরি করুন'}</span>
          </button>
        </form>

        {errorMsg && (
          <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Execution Banner */}
      {lastExec && (
        <div className="mx-4 mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>সম্পন্ন: {lastExec.workflowName}</span>
            </div>
            <div className="text-xs text-slate-200">{lastExec.spokenSummary}</div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {lastExec.executedSteps.map((st, idx) => (
                <span
                  key={idx}
                  className="text-[10px] px-2 py-0.5 rounded bg-black/40 border border-emerald-500/30 text-emerald-200"
                >
                  {st}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSpeakDeepVoice(lastExec.spokenSummary)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs inline-flex items-center gap-1 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" /> Replay Voice
          </button>
        </div>
      )}

      {/* Workflow Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={`rounded-2xl border p-4 bg-[#07080b] flex flex-col justify-between gap-3 transition ${
                wf.enabled ? 'border-cyan-500/30' : 'border-white/10 opacity-65'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">{wf.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{wf.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(wf.id)}
                      className={`p-1.5 rounded-lg border cursor-pointer ${
                        wf.enabled
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-slate-400'
                      }`}
                      title="Enable / Disable"
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    {!wf.id.startsWith('auto-night') && !wf.id.startsWith('auto-lab') && (
                      <button
                        type="button"
                        onClick={() => handleDelete(wf.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-1.5">
                  <Mic className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Voice Trigger: {wf.triggerPhrase}</span>
                </div>

                <div className="space-y-1">
                  {wf.steps.map((s, idx) => (
                    <div key={idx} className="text-[11px] text-slate-300 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/5 border border-white/10 text-[10px] flex items-center justify-center text-cyan-400">
                        {idx + 1}
                      </span>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">
                  Runs: {wf.runCount} · {wf.triggerType.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => handleRun(wf)}
                  disabled={runningId === wf.id}
                  className="px-4 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#020305] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{runningId === wf.id ? 'চলছে...' : 'Execute Chain'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
