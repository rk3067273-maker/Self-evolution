import React, { useEffect, useState } from 'react';
import { Home, FileSpreadsheet, FileText, Presentation, Power, Download, Sparkles } from 'lucide-react';
import type { SmartDevice } from '../types/brahma';
import { brahmaFetch } from '../lib/brahmaClient';

interface SpreadsheetResult {
  title: string;
  summary: string;
  headers: string[];
  rows: string[][];
}

interface PresentationResult {
  title: string;
  subtitle: string;
  slides: { slideNumber: number; title: string; bullets: string[]; speakerNotes: string }[];
}

interface DocumentResult {
  title: string;
  markdown: string;
}

export const SmartHomeAndOfficePanel: React.FC = () => {
  const [subTab, setSubTab] = useState<'smart-home' | 'office'>('smart-home');
  const [devices, setDevices] = useState<SmartDevice[]>([]);

  // Office Architect State
  const [docType, setDocType] = useState<'spreadsheet' | 'document' | 'presentation'>('spreadsheet');
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [officeError, setOfficeError] = useState<string | null>(null);
  const [officeResult, setOfficeResult] = useState<
    | { docType: 'spreadsheet'; result: SpreadsheetResult }
    | { docType: 'presentation'; result: PresentationResult }
    | { docType: 'document'; result: DocumentResult }
    | null
  >(null);

  useEffect(() => {
    brahmaFetch('/api/smart-home')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.devices)) setDevices(d.devices);
      })
      .catch(() => {});
  }, []);

  const updateDevice = async (id: string, patch: { power?: boolean; level?: number }) => {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    try {
      const res = await brahmaFetch('/api/smart-home/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (Array.isArray(data.devices)) setDevices(data.devices);
    } catch {
      // keep optimistic
    }
  };

  const handleGenerateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    setOfficeError(null);
    try {
      const res = await brahmaFetch('/api/office/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOfficeError(data.error || 'Document generation failed.');
      } else {
        setOfficeResult(data);
      }
    } catch {
      setOfficeError('Network error contacting Office Architect.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = (sheet: SpreadsheetResult) => {
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [sheet.headers.map(escape).join(','), ...sheet.rows.map((r) => r.map(escape).join(','))];
    downloadFile(`${sheet.title.toLowerCase().replace(/\s+/g, '_')}.csv`, lines.join('\n'), 'text/csv');
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#020305] overflow-hidden">
      {/* Sub-navigation */}
      <div className="px-4 py-3 bg-[#07080b] border-b border-cyan-500/20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('smart-home')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition cursor-pointer ${
            subTab === 'smart-home'
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Smart Home Hub</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('office')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition cursor-pointer ${
            subTab === 'office'
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Office Document Architect</span>
        </button>
      </div>

      {subTab === 'smart-home' ? (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((dev) => {
              const min = dev.type === 'ac' ? 16 : dev.type === 'fan' ? 1 : 0;
              const max = dev.type === 'ac' ? 30 : dev.type === 'fan' ? 5 : dev.type === 'plug' ? 300 : 100;
              return (
                <div
                  key={dev.id}
                  className={`rounded-2xl overflow-hidden border transition bg-[#07080b] ${
                    dev.power ? 'border-cyan-400/50 shadow-[0_0_24px_rgba(0,229,255,0.1)]' : 'border-white/10 opacity-80'
                  }`}
                >
                  <div className="relative h-36 overflow-hidden">
                    <img src={dev.image} alt={dev.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07080b] via-[#07080b]/40 to-transparent" />
                    <div className="absolute top-3 right-3">
                      <button
                        type="button"
                        onClick={() => updateDevice(dev.id, { power: !dev.power })}
                        className={`p-2 rounded-full border backdrop-blur-md transition cursor-pointer ${
                          dev.power
                            ? 'bg-cyan-400 text-[#020305] border-cyan-300'
                            : 'bg-black/60 text-slate-300 border-white/20 hover:text-white'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-3 left-3.5">
                      <div className="text-[10px] uppercase tracking-wider text-cyan-300">{dev.room} · {dev.provider}</div>
                      <div className="text-sm font-bold text-white">{dev.name}</div>
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Status: {dev.power ? 'ONLINE' : 'STANDBY'}</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {dev.level} {dev.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      value={dev.level}
                      disabled={!dev.power || dev.type === 'plug'}
                      onChange={(e) => updateDevice(dev.id, { level: Number(e.target.value) })}
                      className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-5xl mx-auto space-y-5">
            <form onSubmit={handleGenerateOffice} className="bg-[#07080b] border border-cyan-500/25 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'spreadsheet', label: 'Excel / CSV Model', icon: FileSpreadsheet },
                  { id: 'document', label: 'Word / Executive Report', icon: FileText },
                  { id: 'presentation', label: 'PowerPoint Deck', icon: Presentation },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDocType(opt.id as 'spreadsheet' | 'document' | 'presentation')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition cursor-pointer ${
                        docType === opt.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Describe deliverable (e.g. 'Q3 SaaS Revenue Roadmap', 'Arduino IoT Lab BOM Cost Sheet')"
                  className="flex-1 min-w-[240px] bg-[#0d0f14] border border-white/15 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#020305] font-bold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{generating ? 'Architecting...' : 'Generate Deliverable'}</span>
                </button>
              </div>

              {officeError && (
                <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                  {officeError}
                </div>
              )}
            </form>

            {/* Rendered Deliverable Preview */}
            {officeResult?.docType === 'spreadsheet' && (
              <div className="bg-[#07080b] border border-cyan-500/25 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{officeResult.result.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{officeResult.result.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportCsv(officeResult.result)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export .CSV</span>
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0d0f14] text-cyan-300 uppercase">
                      <tr>
                        {officeResult.result.headers.map((h, i) => (
                          <th key={i} className="px-4 py-2.5 border-b border-white/10">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {officeResult.result.rows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-white/5">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-4 py-2.5 text-slate-200">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {officeResult?.docType === 'presentation' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-[#07080b] border border-cyan-500/25 rounded-2xl p-4">
                  <div>
                    <h3 className="text-base font-bold text-white">{officeResult.result.title}</h3>
                    <p className="text-xs text-slate-400">{officeResult.result.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        `${officeResult.result.title.toLowerCase().replace(/\s+/g, '_')}_deck.md`,
                        officeResult.result.slides
                          .map(
                            (s) =>
                              `## Slide ${s.slideNumber}: ${s.title}\n${s.bullets.map((b) => `- ${b}`).join('\n')}\n\n> Speaker Notes: ${s.speakerNotes}\n`
                          )
                          .join('\n---\n\n'),
                        'text/markdown'
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Deck (.MD)</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {officeResult.result.slides.map((slide) => (
                    <div
                      key={slide.slideNumber}
                      className="bg-[#07080b] border border-white/10 rounded-2xl p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-[10px] font-mono uppercase text-cyan-400 mb-1">
                          Slide 0{slide.slideNumber}
                        </div>
                        <h4 className="text-sm font-bold text-white mb-2">{slide.title}</h4>
                        <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                          {slide.bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-3 pt-2 border-t border-white/10 text-[11px] text-slate-400 italic">
                        Notes: {slide.speakerNotes}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {officeResult?.docType === 'document' && (
              <div className="bg-[#07080b] border border-cyan-500/25 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">{officeResult.result.title}</h3>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        `${officeResult.result.title.toLowerCase().replace(/\s+/g, '_')}.md`,
                        officeResult.result.markdown,
                        'text/markdown'
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .MD</span>
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-slate-200 leading-relaxed font-sans bg-[#0d0f14] border border-white/10 rounded-xl p-4">
                  {officeResult.result.markdown}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
