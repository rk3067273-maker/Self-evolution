import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Terminal,
  CheckCircle2,
  Trash2,
  Code2,
  ShieldCheck,
  Play,
  RefreshCw,
  BrainCircuit,
  FlaskConical,
  AlertCircle,
} from 'lucide-react';
import type { SkillEntry } from '../types/brahma';
import { brahmaFetch } from '../lib/brahmaClient';

interface TestDetail {
  input: string;
  expectedContains: string;
  actualOutput: string;
  pass: boolean;
}

export const SkillForgePanel: React.FC = () => {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'ultron-forged' | 'feature' | 'built-in'>('all');
  const [goal, setGoal] = useState('');
  const [forging, setForging] = useState(false);
  const [autoLearning, setAutoLearning] = useState(false);
  const [evolving, setEvolving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillEntry | null>(null);

  const [evolvePrompt, setEvolvePrompt] = useState('');
  const [runInput, setRunInput] = useState('');
  const [runOutput, setRunOutput] = useState<{ ok: boolean; output: string; latencyMs: number } | null>(null);
  const [testDetails, setTestDetails] = useState<TestDetail[] | null>(null);

  const syncSkill = (updated: SkillEntry, list?: SkillEntry[]) => {
    if (Array.isArray(list)) {
      setSkills(list);
    } else {
      setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    }
    setSelectedSkill(updated);
  };

  const loadSkills = async () => {
    try {
      const res = await brahmaFetch('/api/skills');
      const data = await res.json();
      if (Array.isArray(data.skills)) {
        setSkills(data.skills);
        if (!selectedSkill && data.skills.length > 0) {
          setSelectedSkill(data.skills[0]);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRunOutput(null);
    setTestDetails(null);
    if (selectedSkill?.testCases?.[0]?.input) {
      setRunInput(selectedSkill.testCases[0].input);
    } else {
      setRunInput('');
    }
  }, [selectedSkill?.id]);

  const handleForge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setForging(true);
    setErrorMsg(null);
    try {
      const res = await brahmaFetch('/api/skills/forge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Skill synthesis failed.');
      } else if (data.skill) {
        setSkills(Array.isArray(data.skills) ? data.skills : [data.skill, ...skills]);
        setSelectedSkill(data.skill);
        setGoal('');
      }
    } catch {
      setErrorMsg('Network error contacting Project Ultron.');
    } finally {
      setForging(false);
    }
  };

  const handleAutoLearn = async () => {
    setAutoLearning(true);
    setErrorMsg(null);
    try {
      const res = await brahmaFetch('/api/skills/auto-learn', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Auto-Learn failed.');
      } else if (data.skill) {
        setSkills(Array.isArray(data.skills) ? data.skills : [data.skill, ...skills]);
        setSelectedSkill(data.skill);
      }
    } catch {
      setErrorMsg('Network error running Auto-Learn.');
    } finally {
      setAutoLearning(false);
    }
  };

  const handleRunCrucibleTests = async (sk: SkillEntry) => {
    setTesting(true);
    setErrorMsg(null);
    try {
      const res = await brahmaFetch(`/api/skills/test/${sk.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Crucible test execution failed.');
      } else if (data.skill) {
        syncSkill(data.skill, data.skills);
        setTestDetails(data.report?.details || null);
      }
    } catch {
      setErrorMsg('Failed to contact VM Crucible.');
    } finally {
      setTesting(false);
    }
  };

  const handleRunSkill = async (sk: SkillEntry) => {
    setRunning(true);
    setErrorMsg(null);
    try {
      const res = await brahmaFetch(`/api/skills/run/${sk.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: runInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Execution failed.');
      } else {
        setRunOutput({ ok: Boolean(data.ok), output: String(data.output || ''), latencyMs: Number(data.latencyMs || 0) });
        if (data.skill) syncSkill(data.skill);
      }
    } catch {
      setErrorMsg('Failed to execute skill in Crucible.');
    } finally {
      setRunning(false);
    }
  };

  const handleEvolve = async (sk: SkillEntry) => {
    setEvolving(true);
    setErrorMsg(null);
    try {
      const res = await brahmaFetch(`/api/skills/evolve/${sk.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: evolvePrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Evolution failed.');
      } else if (data.skill) {
        syncSkill(data.skill, data.skills);
        setEvolvePrompt('');
        setTestDetails(null);
      }
    } catch {
      setErrorMsg('Network error evolving skill.');
    } finally {
      setEvolving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await brahmaFetch(`/api/skills/${id}`, { method: 'DELETE' });
    setSkills((prev) => prev.filter((s) => s.id !== id));
    if (selectedSkill?.id === id) setSelectedSkill(null);
  };

  const filtered = skills.filter((s) => (filter === 'all' ? true : s.category === filter));

  return (
    <div className="w-full h-full flex flex-col bg-[#020305] overflow-hidden">
      {/* Forge Prompt Bar */}
      <div className="p-4 bg-[#07080b] border-b border-cyan-500/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Project Ultron // Self-Evolving Skill Forge & VM Crucible
              </h2>
              <p className="text-[11px] text-slate-400">
                Real isolated Node VM sandbox, self-healing unit assertions, v+1 code mutation & live chat auto-dispatch
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleAutoLearn}
              disabled={autoLearning}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>{autoLearning ? 'Learning...' : 'Auto-Learn New Skill'}</span>
            </button>

            {(['all', 'ultron-forged', 'feature', 'built-in'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs border transition cursor-pointer ${
                  filter === cat
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleForge} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="নতুন স্কিল তৈরি করুন... (যেমন: 'Resistor color code ohm calculator' বা 'Password strength auditor')"
            className="flex-1 min-w-[260px] bg-[#0d0f14] border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={forging}
            className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#020305] font-bold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Terminal className="w-4 h-4" />
            <span>{forging ? 'Forging + Testing in VM...' : 'Forge & Verify'}</span>
          </button>
        </form>

        {errorMsg && (
          <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Split Skill List + Crucible Inspector */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 border-r border-white/10 overflow-y-auto p-4 space-y-2.5">
          {filtered.map((sk) => (
            <button
              key={sk.id}
              type="button"
              onClick={() => setSelectedSkill(sk)}
              className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                selectedSkill?.id === sk.id
                  ? 'bg-cyan-500/10 border-cyan-400/60'
                  : 'bg-[#07080b] border-white/10 hover:border-cyan-500/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-cyan-300">{sk.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30 text-cyan-200">
                    {sk.version || 'v1.0'}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                  {sk.category}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 line-clamp-2">{sk.description}</p>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {sk.testsPassed}/{sk.testsTotal || sk.testsPassed} Crucible Passed
                </span>
                <span className="text-slate-400 font-mono">
                  Runs: {sk.executions ?? 0} • Evo: {sk.evolutionCount ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-7 overflow-y-auto p-5 bg-[#04060a]">
          {selectedSkill ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Code2 className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-mono text-base font-bold text-white">{selectedSkill.name}</h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200">
                      {selectedSkill.version || 'v1.0'}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                      {selectedSkill.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{selectedSkill.description}</p>
                </div>
                {selectedSkill.category === 'ultron-forged' && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedSkill.id)}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 cursor-pointer"
                    title="Delete Skill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#07080b] border border-white/10 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Voice / Chat Auto-Triggers</div>
                  <div className="text-xs text-cyan-300 font-mono mt-1">{selectedSkill.trigger}</div>
                </div>
                <div className="bg-[#07080b] border border-white/10 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">VM Crucible Telemetry</div>
                  <div className="text-xs text-emerald-300 mt-1 inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    {selectedSkill.lastTestOutput ||
                      `${selectedSkill.testsPassed}/${selectedSkill.testsTotal || selectedSkill.testsPassed} assertions passed`}
                  </div>
                </div>
              </div>

              {/* Crucible Test & Live Execution Controls */}
              <div className="bg-[#07080b] border border-cyan-500/25 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white inline-flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4 text-cyan-400" />
                    VM Crucible Sandbox Runner & Self-Evolution
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRunCrucibleTests(selectedSkill)}
                      disabled={testing}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{testing ? 'Testing...' : 'Run Crucible Tests'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleEvolve(selectedSkill)}
                      disabled={evolving}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-xs font-bold text-amber-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${evolving ? 'animate-spin' : ''}`} />
                      <span>{evolving ? 'Mutating & Healing...' : 'Auto-Evolve v+1'}</span>
                    </button>
                  </div>
                </div>

                {/* Live Input Execution */}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={runInput}
                    onChange={(e) => setRunInput(e.target.value)}
                    placeholder="Test input for function run(input)..."
                    className="flex-1 min-w-[200px] bg-[#0d0f14] border border-white/10 focus:border-cyan-400 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRunSkill(selectedSkill)}
                    disabled={running}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#020305] font-bold text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{running ? 'Running...' : 'Execute'}</span>
                  </button>
                </div>

                {/* Optional Evolution Directive */}
                <input
                  type="text"
                  value={evolvePrompt}
                  onChange={(e) => setEvolvePrompt(e.target.value)}
                  placeholder="(Optional) Evolution instruction e.g. 'Add Bengali output & handle negative numbers'"
                  className="w-full bg-[#0d0f14] border border-white/10 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />

                {runOutput && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs font-mono ${
                      runOutput.ok
                        ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                        : 'bg-rose-500/10 border-rose-400/30 text-rose-200'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-75 mb-1">
                      VM Output ({runOutput.latencyMs}ms)
                    </div>
                    {runOutput.output}
                  </div>
                )}

                {testDetails && (
                  <div className="space-y-1.5 pt-1">
                    {testDetails.map((td, idx) => (
                      <div
                        key={idx}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex items-center justify-between gap-2 ${
                          td.pass
                            ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-200'
                            : 'bg-rose-500/10 border-rose-400/25 text-rose-200'
                        }`}
                      >
                        <span className="truncate">
                          [{td.pass ? 'PASS' : 'FAIL'}] in="{td.input}" → "{td.actualOutput}"
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#07080b] border border-cyan-500/20 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-[#0d0f14] border-b border-white/10 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Executable Crucible JS Source</span>
                  <span>function run(input)</span>
                </div>
                <pre className="p-4 text-xs font-mono text-cyan-100 overflow-x-auto leading-relaxed">
                  {selectedSkill.code}
                </pre>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Select a skill to inspect its manifest, run VM Crucible assertions, or evolve it to v+1.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
