import React, { useEffect, useRef, useState } from 'react';
import {
  Smartphone,
  Brain,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Upload,
  Download,
  Plus,
  Trash2,
  Save,
  Search,
} from 'lucide-react';
import type { IdentityState, MemoryItem, RemoteLog, SharedFileItem } from '../types/brahma';
import { brahmaFetch } from '../lib/brahmaClient';

interface RemoteAndIdentityPanelProps {
  onAssistantNameChanged?: (name: string) => void;
}

export const RemoteAndIdentityPanel: React.FC<RemoteAndIdentityPanelProps> = ({
  onAssistantNameChanged,
}) => {
  const [subTab, setSubTab] = useState<'remote' | 'identity'>('remote');

  // Remote Console State
  const [logs, setLogs] = useState<RemoteLog[]>([]);
  const [files, setFiles] = useState<SharedFileItem[]>([]);
  const [trackpadDelta, setTrackpadDelta] = useState({ x: 0, y: 0 });
  const [remoteText, setRemoteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identity & Memory State
  const [identity, setIdentity] = useState<IdentityState | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memSearch, setMemSearch] = useState('');
  const [newMemKey, setNewMemKey] = useState('');
  const [newMemVal, setNewMemVal] = useState('');
  const [newMemCat, setNewMemCat] = useState<'preference' | 'project' | 'hardware' | 'rule'>('preference');
  const [savedNotice, setSavedNotice] = useState(false);

  const loadAll = async () => {
    try {
      const [remRes, idRes, memRes] = await Promise.all([
        brahmaFetch('/api/remote/state').then((r) => r.json()),
        brahmaFetch('/api/identity').then((r) => r.json()),
        brahmaFetch('/api/memory').then((r) => r.json()),
      ]);
      if (Array.isArray(remRes.logs)) setLogs(remRes.logs);
      if (Array.isArray(remRes.files)) setFiles(remRes.files);
      if (idRes.identity) setIdentity(idRes.identity);
      if (Array.isArray(memRes.memories)) setMemories(memRes.memories);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const dispatchRemoteAction = async (payload: { type: string; action?: string; text?: string }) => {
    const res = await brahmaFetch('/api/remote/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (Array.isArray(data.logs)) setLogs(data.logs);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      const res = await brahmaFetch('/api/remote/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          contentBase64: base64,
        }),
      });
      const data = await res.json();
      if (data.file) setFiles((prev) => [data.file, ...prev]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveIdentity = async () => {
    if (!identity) return;
    await brahmaFetch('/api/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(identity),
    });
    if (identity.assistant?.name?.trim()) {
      onAssistantNameChanged?.(identity.assistant.name.trim());
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemKey.trim() || !newMemVal.trim()) return;
    const res = await brahmaFetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: newMemCat, key: newMemKey.trim(), value: newMemVal.trim() }),
    });
    const data = await res.json();
    if (Array.isArray(data.memories)) setMemories(data.memories);
    setNewMemKey('');
    setNewMemVal('');
  };

  const handleDeleteMemory = async (id: string) => {
    const res = await brahmaFetch(`/api/memory/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (Array.isArray(data.memories)) setMemories(data.memories);
  };

  const filteredMemories = memories.filter(
    (m) =>
      m.key.toLowerCase().includes(memSearch.toLowerCase()) ||
      m.value.toLowerCase().includes(memSearch.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#020305] overflow-hidden">
      <div className="px-4 py-3 bg-[#07080b] border-b border-cyan-500/20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('remote')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition cursor-pointer ${
            subTab === 'remote'
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Brahma Remote & Files</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('identity')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition cursor-pointer ${
            subTab === 'identity'
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Identity & Memory Cortex</span>
        </button>
      </div>

      {subTab === 'remote' ? (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Virtual Trackpad & Media Controls */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-[#07080b] border border-cyan-500/25 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Virtual Touch Trackpad
                  </h3>
                  <span className="font-mono text-[11px] text-slate-400">
                    Δ ({trackpadDelta.x}, {trackpadDelta.y})
                  </span>
                </div>
                <div
                  onPointerMove={(e) => {
                    if (e.buttons === 1) {
                      setTrackpadDelta({
                        x: Math.round(e.movementX),
                        y: Math.round(e.movementY),
                      });
                    }
                  }}
                  onClick={() => dispatchRemoteAction({ type: 'mouse_click', action: 'left' })}
                  className="h-44 rounded-xl bg-[#0d0f14] border border-dashed border-cyan-500/35 flex items-center justify-center text-xs text-slate-400 select-none cursor-crosshair"
                >
                  Drag across surface · Click to send left click
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => dispatchRemoteAction({ type: 'mouse_click', action: 'left' })}
                    className="py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs cursor-pointer"
                  >
                    Left Click
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchRemoteAction({ type: 'mouse_click', action: 'double' })}
                    className="py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs cursor-pointer"
                  >
                    Double Click
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchRemoteAction({ type: 'mouse_click', action: 'right' })}
                    className="py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs cursor-pointer"
                  >
                    Right Click
                  </button>
                </div>
              </div>

              <div className="bg-[#07080b] border border-cyan-500/25 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Media & Remote Type Bridge
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => dispatchRemoteAction({ type: 'media', action: 'prev' })}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <SkipBack className="w-3.5 h-3.5" /> Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchRemoteAction({ type: 'media', action: 'playpause' })}
                    className="px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> Play / Pause
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchRemoteAction({ type: 'media', action: 'next' })}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" /> Next
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchRemoteAction({ type: 'media', action: 'volume_up' })}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Vol +
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchRemoteAction({ type: 'media', action: 'mute' })}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <VolumeX className="w-3.5 h-3.5" /> Mute
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!remoteText.trim()) return;
                    dispatchRemoteAction({ type: 'type_text', text: remoteText.trim() });
                    setRemoteText('');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={remoteText}
                    onChange={(e) => setRemoteText(e.target.value)}
                    placeholder="Send remote text payload..."
                    className="flex-1 bg-[#0d0f14] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-cyan-400 text-[#020305] font-bold text-xs cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>

            {/* File Transfer + Command Telemetry Log */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-[#07080b] border border-cyan-500/25 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Shared Workspace Files
                  </h3>
                  <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload File
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between bg-[#0d0f14] border border-white/10 rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="truncate">
                        <div className="text-white font-medium truncate">{f.name}</div>
                        <div className="text-[10px] text-slate-400">{(f.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <a
                        href={`/api/remote/files/${f.id}`}
                        download={f.name}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#07080b] border border-white/10 rounded-2xl p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Remote Dispatch History
                </h3>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-2 bg-[#0d0f14] border border-white/5 rounded-lg px-3 py-2 text-xs"
                    >
                      <span className="text-slate-200 truncate">{l.text}</span>
                      <span className="text-[10px] font-mono text-emerald-400 shrink-0">{l.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Identity & Behavior Card */}
            {identity && (
              <div className="lg:col-span-5 bg-[#07080b] border border-cyan-500/25 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                    Identity & Behavioral Core
                  </h3>
                  <button
                    type="button"
                    onClick={handleSaveIdentity}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#020305] font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savedNotice ? 'Saved!' : 'Save'}</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Assistant Callsign</label>
                    <input
                      type="text"
                      value={identity.assistant.name}
                      onChange={(e) =>
                        setIdentity({
                          ...identity,
                          assistant: { ...identity.assistant, name: e.target.value },
                        })
                      }
                      className="w-full bg-[#0d0f14] border border-white/15 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Owner Preferred Name</label>
                    <input
                      type="text"
                      value={identity.owner.preferred_name}
                      onChange={(e) =>
                        setIdentity({
                          ...identity,
                          owner: { ...identity.owner, preferred_name: e.target.value },
                        })
                      }
                      className="w-full bg-[#0d0f14] border border-white/15 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Location</label>
                    <input
                      type="text"
                      value={identity.owner.location}
                      onChange={(e) =>
                        setIdentity({
                          ...identity,
                          owner: { ...identity.owner, location: e.target.value },
                        })
                      }
                      className="w-full bg-[#0d0f14] border border-white/15 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Behavior Mode</label>
                    <select
                      value={identity.behavior.mode}
                      onChange={(e) =>
                        setIdentity({
                          ...identity,
                          behavior: {
                            ...identity.behavior,
                            mode: e.target.value as IdentityState['behavior']['mode'],
                          },
                        })
                      }
                      className="w-full bg-[#0d0f14] border border-white/15 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="professional">Professional</option>
                      <option value="technical">Technical Deep-Dive</option>
                      <option value="concise">Ultra Concise</option>
                      <option value="creative">Creative Architect</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Custom System Instructions</label>
                    <textarea
                      rows={3}
                      value={identity.behavior.custom_instructions}
                      onChange={(e) =>
                        setIdentity({
                          ...identity,
                          behavior: { ...identity.behavior, custom_instructions: e.target.value },
                        })
                      }
                      className="w-full bg-[#0d0f14] border border-white/15 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Adaptive Memory Cortex Inspector */}
            <div className="lg:col-span-7 bg-[#07080b] border border-cyan-500/25 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                  Adaptive Memory Cortex ({memories.length})
                </h3>
                <div className="flex items-center gap-1.5 bg-[#0d0f14] border border-white/15 rounded-lg px-2.5 py-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={memSearch}
                    onChange={(e) => setMemSearch(e.target.value)}
                    placeholder="Filter memories..."
                    className="bg-transparent text-xs text-white focus:outline-none w-40"
                  />
                </div>
              </div>

              <form onSubmit={handleAddMemory} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <select
                  value={newMemCat}
                  onChange={(e) => setNewMemCat(e.target.value as MemoryItem['category'])}
                  className="sm:col-span-3 bg-[#0d0f14] border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  <option value="preference">Preference</option>
                  <option value="project">Project</option>
                  <option value="hardware">Hardware</option>
                  <option value="rule">Rule</option>
                </select>
                <input
                  type="text"
                  value={newMemKey}
                  onChange={(e) => setNewMemKey(e.target.value)}
                  placeholder="Key"
                  className="sm:col-span-3 bg-[#0d0f14] border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  value={newMemVal}
                  onChange={(e) => setNewMemVal(e.target.value)}
                  placeholder="Memory fact..."
                  className="sm:col-span-4 bg-[#0d0f14] border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 bg-cyan-400 hover:bg-cyan-300 text-[#020305] font-bold text-xs rounded-lg inline-flex items-center justify-center gap-1 py-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </form>

              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {filteredMemories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start justify-between gap-3 bg-[#0d0f14] border border-white/10 rounded-xl p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-semibold">
                          {m.category}
                        </span>
                        <span className="text-xs font-bold text-white">{m.key}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{m.value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMemory(m.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                      title="Forget Memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
