import React, { useEffect, useState } from 'react';
import {
  Terminal,
  Smartphone,
  ExternalLink,
  Download,
  Play,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Maximize2,
  FolderGit2,
} from 'lucide-react';
import type { LanguageMode, TerminalState } from '../types/brahma';
import { brahmaFetch } from '../lib/brahmaClient';

interface AndroidStatusData {
  readyForGithubApk: boolean;
  hasLocalAndroidSdk: boolean;
  packageId: string;
  workflowPath: string;
  fileChecks: Array<{ path: string; exists: boolean }>;
}

interface TermuxAndApkPanelProps {
  languageMode: LanguageMode;
  terminalState: TerminalState;
  onRunCommand: (cmd: string) => Promise<void>;
  onRunAgent: (task: string) => Promise<void>;
  onShowPopup: () => void;
}

export const TermuxAndApkPanel: React.FC<TermuxAndApkPanelProps> = ({
  terminalState,
  onRunCommand,
  onRunAgent,
  onShowPopup,
}) => {
  const [shellInput, setShellInput] = useState('');
  const [buildInput, setBuildInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [androidStatus, setAndroidStatus] = useState<AndroidStatusData | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    brahmaFetch('/api/android/status')
      .then((r) => r.json())
      .then((d) => setAndroidStatus(d as AndroidStatusData))
      .catch(() => {});
  }, []);

  const handleShell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shellInput.trim() || busy) return;
    const cmd = shellInput.trim();
    setShellInput('');
    setBusy(true);
    try {
      await onRunCommand(cmd);
    } finally {
      setBusy(false);
    }
  };

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildInput.trim() || busy) return;
    const task = buildInput.trim();
    setBuildInput('');
    setBusy(true);
    setStatusMessage(null);
    onShowPopup();
    try {
      await onRunAgent(task);
    } finally {
      setBusy(false);
    }
  };

  const handleInstallAction = (previewUrl: string, slug: string) => {
    const win = window as unknown as {
      BrahmaNative?: {
        isNativeAndroid?: () => boolean;
        runInTermux?: (cmd: string) => boolean;
      };
    };
    if (win.BrahmaNative?.isNativeAndroid?.()) {
      setStatusMessage('Native Android APK পরিবেশ শনাক্ত হয়েছে — প্রজেক্ট ওপেন করা হচ্ছে।');
    } else {
      setStatusMessage(
        `"${slug}" প্রজেক্টের লাইভ অ্যাপ ওপেন করে Chrome মেনু → "Install app / Add to Home screen" চাপলে ফোনে ইনস্টল হবে, অথবা GitHub Actions-এ ZIP পুশ করে APK বানান।`
      );
    }
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#020305] p-4 sm:p-6 space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <span>Brahma Termux Terminal & Android APK Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            আসল স্যান্ডবক্সড লিনাক্স/নোড টার্মিনাল, স্বয়ংক্রিয় ওয়েবসাইট ও অ্যাপ বিল্ডার এবং GitHub Actions Android APK প্রজেক্ট
          </p>
        </div>

        <button
          type="button"
          onClick={onShowPopup}
          className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#020305] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
          <span>Open Popup Display</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-xs text-cyan-200">
          {statusMessage}
        </div>
      )}

      {/* Autonomous App/Website Builder + Raw Termux Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form
          onSubmit={handleBuild}
          className="p-4 rounded-2xl bg-[#07080b] border border-cyan-500/25 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Autonomous Website / Android App Builder</span>
          </div>
          <p className="text-xs text-slate-400">
            যেকোনো ওয়েবসাইট, টুল বা মোবাইল অ্যাপ বানাতে বলুন — ব্রহ্মা নিজেই ফাইল লিখে টার্মিনালে যাচাই করবে এবং লাইভ প্রিভিউ ও ZIP দেবে।
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={buildInput}
              onChange={(e) => setBuildInput(e.target.value)}
              placeholder="যেমন: একটা আধুনিক বৈজ্ঞানিক ক্যালকুলেটর মোবাইল অ্যাপ বানাও"
              className="flex-1 bg-[#0d1017] border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !buildInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#020305] font-bold text-xs cursor-pointer"
            >
              {busy ? 'Building...' : 'Build'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              'একটা ডার্ক পোর্টফোলিও ওয়েবসাইট বানাও',
              'একটা সায়েন্টিফিক ক্যালকুলেটর অ্যান্ড্রয়েড অ্যাপ বানাও',
              'একটা স্নেক গেম ওয়েব অ্যাপ বানাও',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setBuildInput(sample)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>
        </form>

        <form
          onSubmit={handleShell}
          className="p-4 rounded-2xl bg-[#07080b] border border-emerald-500/25 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Direct Termux Shell ({terminalState.cwd})</span>
          </div>
          <p className="text-xs text-slate-400">
            সরাসরি bash/node কমান্ড চালান — প্রতিটি আউটপুট আসল সার্ভার প্রসেস থেকে আসে এবং পপ-আপ উইন্ডোতেও দেখা যায়।
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={shellInput}
              onChange={(e) => setShellInput(e.target.value)}
              placeholder="e.g. ls -la projects || node -v || pwd"
              className="flex-1 bg-[#0d1017] border border-white/15 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-200 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !shellInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-[#020305] font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Exec</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 font-mono">
            {['pwd && ls -la', 'node -v && npm -v', 'ls -la projects'].map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => void onRunCommand(cmd)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-300 cursor-pointer"
              >
                $ {cmd}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Built Projects List */}
      <div className="p-4 rounded-2xl bg-[#07080b] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Built Websites & Apps ({terminalState.projects.length})</h3>
          <span className="text-xs text-slate-400">Real disk builds served live</span>
        </div>

        {terminalState.projects.length === 0 ? (
          <div className="text-xs text-slate-400 py-4">
            এখনো কোনো প্রজেক্ট তৈরি হয়নি। উপরে বা ভয়েস কমান্ডে বলুন: "একটা ক্যালকুলেটর অ্যাপ বানাও" বা "একটা ওয়েবসাইট বানাও"।
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {terminalState.projects.map((p) => (
              <div key={p.id} className="p-3.5 rounded-xl bg-[#0d1017] border border-white/10 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{p.description}</div>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-300 uppercase">{p.type}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  Files: {p.files.join(', ')}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleInstallAction(p.previewUrl, p.slug)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-[#020305] font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open & Install</span>
                  </button>
                  <a
                    href={p.downloadUrl}
                    download={`${p.slug}.zip`}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download ZIP</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real Android APK & GitHub Actions Pipeline Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#07080b] border border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Android Native APK Source & GitHub Actions Builder
              </h3>
              <p className="text-xs text-slate-400">
                Package ID: <span className="font-mono text-cyan-300">{androidStatus?.packageId || 'com.brahma.evo'}</span> · System Overlay + Eye Tracking + Termux Bridge
              </p>
            </div>
          </div>

          <a
            href="/api/android/download-bundle"
            download="brahma-android-apk-project.zip"
            className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#020305] font-bold text-xs inline-flex items-center gap-1.5"
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Download Android APK Repo ZIP</span>
          </a>
        </div>

        {/* Honest Environment Reality Check */}
        <div className="p-3 rounded-xl bg-[#0d1017] border border-amber-400/25 text-xs text-amber-100 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <strong>সত্য ও স্বচ্ছ তথ্য:</strong> এই ক্লাউড ওয়েব-সার্ভার কন্টেইনারে Android SDK বা Gradle ইনস্টল করা নেই (<code>localSdk: {String(Boolean(androidStatus?.hasLocalAndroidSdk))}</code>), তাই এখানে সরাসরি <code>.apk</code> বাইনারি ফাইল তৈরি হয় না। কিন্তু পুরো নেটিভ Kotlin + Gradle প্রজেক্ট এবং GitHub Actions অটো-বিল্ড ওয়ার্কফ্লো (<code>.github/workflows/build-apk.yml</code>) তৈরি আছে — GitHub-এ push করলেই GitHub সার্ভার নিজে থেকে আসল ইনস্টলযোগ্য <strong>Brahma-AI-Evo-Android.apk</strong> বিল্ড করে দেবে।
          </div>
        </div>

        {androidStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {androidStatus.fileChecks.map((f) => (
              <div
                key={f.path}
                className="px-3 py-2 rounded-lg bg-[#0d1017] border border-white/10 flex items-center gap-2 text-[11px] font-mono text-slate-200"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${f.exists ? 'text-emerald-400' : 'text-rose-400'}`} />
                <span className="truncate">{f.path}</span>
              </div>
            ))}
          </div>
        )}

        <div className="p-3 rounded-xl bg-[#030407] border border-white/10 font-mono text-[11px] text-cyan-200 overflow-x-auto">
          git init &amp;&amp; git add . &amp;&amp; git commit -m "Brahma AI Evo Android APK" &amp;&amp; git push -u origin main
        </div>
      </div>
    </div>
  );
};
