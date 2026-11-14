import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Cpu, ImagePlus, Sparkles, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { CircuitSchematic } from '../types/brahma';
import { brahmaFetch } from '../lib/brahmaClient';

interface CircuitHudPanelProps {
  externalSchematic?: CircuitSchematic | null;
}

interface PresetOption {
  id: string;
  title: string;
  description: string;
  data: CircuitSchematic;
}

interface WirePathCoords {
  d: string;
  color: string;
  label: string;
  step?: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const CircuitHudPanel: React.FC<CircuitHudPanelProps> = ({ externalSchematic }) => {
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [activeCircuit, setActiveCircuit] = useState<CircuitSchematic | null>(externalSchematic ?? null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [imagePreview, setImagePreview] = useState<{ dataUrl: string; mimeType: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [wirePaths, setWirePaths] = useState<WirePathCoords[]>([]);

  const stageRef = useRef<HTMLDivElement>(null);
  const pinElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    brahmaFetch('/api/circuit/presets')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.presets)) {
          setPresets(data.presets);
          if (!activeCircuit && data.presets.length > 0) {
            setActiveCircuit(data.presets[0].data);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (externalSchematic) {
      setActiveCircuit(externalSchematic);
      setSelectedStep(null);
    }
  }, [externalSchematic]);

  const computeWires = useCallback(() => {
    if (!activeCircuit || !stageRef.current) {
      setWirePaths([]);
      return;
    }
    const stageRect = stageRef.current.getBoundingClientRect();
    const paths: WirePathCoords[] = [];

    for (const wire of activeCircuit.wires || []) {
      const fromEl = pinElsRef.current.get(wire.from);
      const toEl = pinElsRef.current.get(wire.to);
      if (!fromEl || !toEl) continue;

      const r1 = fromEl.getBoundingClientRect();
      const r2 = toEl.getBoundingClientRect();

      const x1 = r1.left + r1.width / 2 - stageRect.left;
      const y1 = r1.top + r1.height / 2 - stageRect.top;
      const x2 = r2.left + r2.width / 2 - stageRect.left;
      const y2 = r2.top + r2.height / 2 - stageRect.top;

      const dx = Math.abs(x2 - x1);
      const offset = Math.max(45, dx * 0.45);
      const cx1 = x1 < x2 ? x1 + offset : x1 - offset;
      const cx2 = x1 < x2 ? x2 - offset : x2 + offset;

      paths.push({
        d: `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`,
        color: /^#[0-9a-fA-F]{3,8}$/.test(wire.color) ? wire.color : '#00e5ff',
        label: wire.label,
        step: wire.step,
        x1,
        y1,
        x2,
        y2,
      });
    }
    setWirePaths(paths);
  }, [activeCircuit]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(computeWires);
    window.addEventListener('resize', computeWires);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', computeWires);
    };
  }, [computeWires]);

  const handleSolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() && !imagePreview) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await brahmaFetch('/api/circuit/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          imageBase64: imagePreview?.dataUrl,
          imageMimeType: imagePreview?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to synthesize schematic.');
      } else if (data.schematic) {
        setActiveCircuit(data.schematic);
        setSelectedStep(null);
      }
    } catch {
      setErrorMsg('Network error reaching Brahma Circuit Solver.');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview({ dataUrl: reader.result, mimeType: file.type || 'image/png', name: file.name });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#070c18] text-slate-100 overflow-y-auto">
      {/* Solver & Preset Top Bar */}
      <div className="p-4 bg-[#0b1222] border-b border-cyan-500/20 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Holographic Hardware Circuit Assembler
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveCircuit(p.data);
                  setSelectedStep(null);
                  setErrorMsg(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs border transition cursor-pointer ${
                  activeCircuit?.title === p.title
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {p.title.replace('Connecting ', '')}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSolve} className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ImagePlus className="w-4 h-4 text-cyan-400" />
            <span>{imagePreview ? imagePreview.name : 'Upload Board Photo'}</span>
          </button>

          {imagePreview && (
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe components to wire (e.g. 'ESP32 with BMP280 I2C pressure sensor and 0.96 OLED')"
            className="flex-1 min-w-[240px] bg-[#070c18] border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#020305] font-bold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{loading ? 'Synthesizing...' : 'Generate Schematic'}</span>
          </button>
        </form>

        {errorMsg && (
          <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Main Schematic Stage */}
      {activeCircuit && (
        <div className="p-5 space-y-5 max-w-6xl w-full mx-auto">
          <div>
            <h3 className="text-lg font-bold text-white">{activeCircuit.title}</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{activeCircuit.description}</p>
          </div>

          {/* Interactive SVG Wire + Hardware Cards Canvas */}
          <div
            ref={stageRef}
            className="relative rounded-2xl bg-[#040812] border border-cyan-500/25 p-6 md:p-10 min-h-[300px] flex flex-wrap items-center justify-around gap-8 overflow-x-auto"
            style={{
              backgroundImage:
                'radial-gradient(rgba(0, 240, 255, 0.12) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {/* SVG Wire Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
              <defs>
                <filter id="wire-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {wirePaths.map((w, idx) => {
                const dimmed = selectedStep !== null && w.step !== selectedStep;
                return (
                  <g key={idx} opacity={dimmed ? 0.16 : 1}>
                    <path
                      d={w.d}
                      fill="none"
                      stroke={w.color}
                      strokeWidth={selectedStep === w.step ? 4 : 2.5}
                      strokeLinecap="round"
                      filter="url(#wire-glow)"
                    />
                    <circle cx={w.x1} cy={w.y1} r="4.5" fill={w.color} />
                    <circle cx={w.x2} cy={w.y2} r="4.5" fill={w.color} />
                  </g>
                );
              })}
            </svg>

            {/* Hardware Component Cards */}
            {activeCircuit.components.map((comp) => (
              <div
                key={comp.id}
                className={`relative z-20 min-w-[200px] rounded-xl bg-[#0c1426]/95 border transition shadow-xl ${
                  comp.highlight
                    ? 'border-cyan-400 shadow-[0_0_24px_rgba(0,229,255,0.2)]'
                    : 'border-cyan-500/30'
                }`}
              >
                <div className="px-3.5 py-2.5 bg-[#122849] rounded-t-xl border-b border-cyan-500/20">
                  <div className="text-sm font-bold text-white">{comp.name}</div>
                  <div className="text-[11px] text-cyan-300/80">{comp.subtitle}</div>
                </div>

                <div className="p-3 flex justify-between gap-6">
                  {/* Left Pins */}
                  <div className="space-y-2">
                    {(comp.left_pins || []).map((pin) => {
                      const key = `${comp.id}:left:${pin.name}`;
                      return (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <div
                            ref={(el) => {
                              if (el) pinElsRef.current.set(key, el);
                              else pinElsRef.current.delete(key);
                            }}
                            className="w-3 h-3 rounded-full border-2 border-[#0c1426]"
                            style={{ backgroundColor: pin.color }}
                          />
                          <span className="font-mono text-slate-200">{pin.name}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Pins */}
                  <div className="space-y-2 ml-auto">
                    {(comp.right_pins || []).map((pin) => {
                      const key = `${comp.id}:right:${pin.name}`;
                      return (
                        <div key={key} className="flex items-center justify-end gap-2 text-xs">
                          <span className="font-mono text-slate-200">{pin.name}</span>
                          {pin.badge && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                              {pin.badge}
                            </span>
                          )}
                          <div
                            ref={(el) => {
                              if (el) pinElsRef.current.set(key, el);
                              else pinElsRef.current.delete(key);
                            }}
                            className="w-3 h-3 rounded-full border-2 border-[#0c1426]"
                            style={{ backgroundColor: pin.color }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Steps + Safety Warnings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0c1426] border border-cyan-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Assembly Steps (Click to Highlight Wire)
                </h4>
                {selectedStep !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedStep(null)}
                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    Show All
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {activeCircuit.steps.map((stepText, idx) => {
                  const stepNum = idx + 1;
                  const active = selectedStep === stepNum;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedStep(active ? null : stepNum)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition cursor-pointer ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="font-bold text-cyan-400 mr-2">0{stepNum}.</span>
                      {stepText}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#0c1426] border border-amber-500/25 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-3">
                <AlertTriangle className="w-4 h-4" />
                Hardware Safety Warnings
              </h4>
              <ul className="space-y-2">
                {activeCircuit.warnings.map((w, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-amber-100/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed"
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
