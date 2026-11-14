import React, { useEffect, useRef, useState } from 'react';
import { Terminal, EyeOff, Trash2, ExternalLink, Download, Send, Play } from 'lucide-react';
import type { TerminalState } from '../types/brahma';

interface TerminalPopupWindowProps {
  visible: boolean;
  onHide: () => void;
  terminalState: TerminalState;
  onRunCommand: (cmd: string) => Promise<void>;
  onRunAgent: (task: string) => Promise<void>;
  onClear: () => Promise<void>;
}

export const TerminalPopupWindow: React.FC<TerminalPopupWindowProps> = ({
  visible,
  onHide,
  terminalState,
  onRunCommand,
  onRunAgent,
  onClear,
}) => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'agent' | 'shell'>('agent');
  const [busy, setBusy] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalState.lines, visible]);

  if (!visible) return null;

  const latestProject = terminalState.projects[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    setInput('');
    setBusy(true);
    try {
      if (mode === 'shell') {
        await onRunCommand(trimmed);
      } else {
        await onRunAgent(trimmed);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Brahma Termux Popup Display"
      className="fixed z-50 bottom-16 inset-x-2 sm:inset-x-auto sm:right-4 sm:bottom-5 sm:w-[520px] max-h-[68vh] flex flex-col bg-[#06080d]/95 backdrop-blur-xl border border-cyan-500/35 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden"
    >
      {/* Title Bar with Explicit Hide Button */}
      <div className="px-3.5 py-2.5 bg-[#0c1018] border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">
              Termux Live Window · {terminalState.cwd}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {terminalState.running || busy
                ? terminalState.currentTask || 'Executing autonomous workflow...'
                : 'বলুন "যে কাজটা করছো পপ-আপ উইন্ডোতে দেখাও" যেকোনো সময় খোলার জন্য'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void onClear()}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
            title="Clear Terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onHide}
            className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-xs font-semibold text-rose-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Hide</span>
          </button>
        </div>
      </div>

      {/* Latest Built Website/App Banner */}
      {latestProject && (
        <div className="px-3.5 py-2 bg-emerald-500/10 border-b border-emerald-400/25 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-emerald-200 truncate">
            Built: <strong className="text-white">{latestProject.name}</strong> ({latestProject.type})
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={latestProject.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-emerald-400 text-[#020305] font-bold text-[11px] inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open Live</span>
            </a>
            <a
              href={latestProject.downloadUrl}
              download={`${latestProject.slug}.zip`}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] inline-flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>ZIP</span>
            </a>
          </div>
        </div>
      )}

      {/* Real Terminal Scrollback */}
      <div className="flex-1 min-h-[180px] max-h-[320px] overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-1 bg-[#030407]">
        {terminalState.lines.map((line) => (
          <div
            key={line.id}
            className={
              line.kind === 'cmd'
                ? 'text-cyan-300 font-semibold'
                : line.kind === 'stderr'
                  ? 'text-rose-400'
                  : line.kind === 'success'
                    ? 'text-emerald-300 font-semibold'
                    : line.kind === 'info'
                      ? 'text-amber-300'
                      : 'text-slate-200'
            }
          >
            {line.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Mode Switch + Live Command Input */}
      <form onSubmit={handleSubmit} className="p-2.5 bg-[#0c1018] border-t border-white/10 flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-lg bg-[#05070c] border border-white/10 p-0.5">
          <button
            type="button"
            onClick={() => setMode('agent')}
            className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
              mode === 'agent' ? 'bg-cyan-500/25 text-cyan-200' : 'text-slate-400'
            }`}
          >
            AI Build
          </button>
          <button
            type="button"
            onClick={() => setMode('shell')}
            className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
              mode === 'shell' ? 'bg-emerald-500/25 text-emerald-200' : 'text-slate-400'
            }`}
          >
            Shell $
          </button>
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === 'shell'
              ? 'bash command (e.g. ls -la, node -v)...'
              : 'ওয়েবসাইট বা অ্যাপ বানানোর নির্দেশ দিন...'
          }
          className="flex-1 min-w-[150px] bg-[#05070c] border border-white/10 focus:border-cyan-400 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
        />

        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#020305] font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
        >
          {mode === 'shell' ? <Play className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
          <span>{busy ? '...' : 'Run'}</span>
        </button>
      </form>
    </div>
  );
};
