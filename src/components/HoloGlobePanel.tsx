import React, { useEffect, useRef, useState } from 'react';
import { Globe2, Radar, Plane, Orbit, Activity, Moon, MapPin, RotateCcw } from 'lucide-react';

interface HoloGlobePanelProps {
  pendingAction?: Record<string, unknown> | null;
  onActionHandled?: () => void;
}

interface BrahmaGlobeAPI {
  flyTo?: (lat: number, lon: number, dist?: number) => void;
  showRoute?: (
    origLat: number,
    origLon: number,
    destLat: number,
    destLon: number,
    meta?: { origName?: string; destName?: string }
  ) => void;
  toggleIss?: () => void;
  toggleEarthquakes?: () => void;
  toggleNight?: () => void;
  switchMode?: (mode: '3d' | '2d') => void;
  searchPoi?: (query: string) => void;
  resetView?: () => void;
}

export const HoloGlobePanel: React.FC<HoloGlobePanelProps> = ({ pendingAction, onActionHandled }) => {
  const [subMode, setSubMode] = useState<'globe' | 'radar'>('globe');
  const [mapView, setMapView] = useState<'3d' | '2d'>('3d');
  const [poiQuery, setPoiQuery] = useState('');
  const globeIframeRef = useRef<HTMLIFrameElement>(null);

  const getGlobeApi = (): BrahmaGlobeAPI | null => {
    const win = globeIframeRef.current?.contentWindow as (Window & { BrahmaGlobe?: BrahmaGlobeAPI }) | null;
    return win?.BrahmaGlobe ?? null;
  };

  useEffect(() => {
    if (!pendingAction || subMode !== 'globe') return;
    const timer = window.setTimeout(() => {
      const api = getGlobeApi();
      if (!api) return;
      const type = String(pendingAction.type || '');
      if (type === 'iss') {
        api.toggleIss?.();
      } else if (type === 'earthquakes') {
        api.toggleEarthquakes?.();
      } else if (type === 'route' && Array.isArray(pendingAction.orig) && Array.isArray(pendingAction.dest)) {
        const [oLat, oLon] = pendingAction.orig as number[];
        const [dLat, dLon] = pendingAction.dest as number[];
        api.showRoute?.(oLat, oLon, dLat, dLon, { origName: 'Mumbai', destName: 'London' });
      }
      onActionHandled?.();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [pendingAction, subMode, onActionHandled]);

  return (
    <div className="w-full h-full flex flex-col bg-[#020305] overflow-hidden">
      {/* Tactical Top Toolbar */}
      <div className="px-4 py-2.5 bg-[#07080b] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubMode('globe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition cursor-pointer ${
              subMode === 'globe'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>HoloGlobe Earth</span>
          </button>

          <button
            type="button"
            onClick={() => setSubMode('radar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition cursor-pointer ${
              subMode === 'radar'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>Network Radar HUD</span>
          </button>
        </div>

        {subMode === 'globe' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const next = mapView === '3d' ? '2d' : '3d';
                setMapView(next);
                getGlobeApi()?.switchMode?.(next);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 cursor-pointer"
            >
              Mode: {mapView.toUpperCase()}
            </button>

            <button
              type="button"
              onClick={() => getGlobeApi()?.toggleIss?.()}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <Orbit className="w-3.5 h-3.5" />
              <span>ISS Live</span>
            </button>

            <button
              type="button"
              onClick={() =>
                getGlobeApi()?.showRoute?.(19.076, 72.8777, 51.5074, -0.1278, {
                  origName: 'Mumbai (BOM)',
                  destName: 'London (LHR)',
                })
              }
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plane className="w-3.5 h-3.5 text-cyan-400" />
              <span>BOM → LHR</span>
            </button>

            <button
              type="button"
              onClick={() => getGlobeApi()?.toggleEarthquakes?.()}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Seismic</span>
            </button>

            <button
              type="button"
              onClick={() => getGlobeApi()?.toggleNight?.()}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <Moon className="w-3.5 h-3.5 text-indigo-300" />
              <span>Night</span>
            </button>

            <button
              type="button"
              onClick={() => getGlobeApi()?.resetView?.()}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!poiQuery.trim()) return;
                getGlobeApi()?.searchPoi?.(poiQuery.trim());
              }}
              className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <input
                type="text"
                value={poiQuery}
                onChange={(e) => setPoiQuery(e.target.value)}
                placeholder="Search POI (e.g. Hospital)"
                className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none w-36"
              />
            </form>
          </div>
        )}
      </div>

      {/* Embedded Authentic Brahma Globe / Radar HTML */}
      <div className="flex-1 min-h-0 relative">
        <iframe
          ref={globeIframeRef}
          src={subMode === 'globe' ? '/brahma-assets/globe/index.html' : '/brahma-assets/radar/index.html'}
          title={subMode === 'globe' ? 'Brahma HoloGlobe 3D' : 'Brahma Network Radar HUD'}
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
};
