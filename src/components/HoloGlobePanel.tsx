import React, { useEffect, useRef, useState } from 'react';
import {
  Globe2,
  Radar,
  Plane,
  Orbit,
  Activity,
  Moon,
  MapPin,
  RotateCcw,
  Layers,
  Compass,
} from 'lucide-react';

interface HoloGlobePanelProps {
  pendingAction?: Record<string, unknown> | null;
  onActionHandled?: () => void;
}

type GlobeArtStyle = 'orbital' | 'blueprint' | 'solar';
type GlobeViewMode = '3D' | 'STREET' | 'SATELLITE';

interface BrahmaGlobeAPI {
  flyTo?: (lat: number, lon: number, dist?: number) => void;
  showRoute?: (
    origLat: number,
    origLon: number,
    destLat: number,
    destLon: number,
    meta?: {
      origName?: string;
      originName?: string;
      destName?: string;
      distance_km?: number;
      distance_nm?: number;
      flight_time?: string;
      bearing?: number;
    }
  ) => void;
  toggleIss?: () => void;
  toggleIssTracker?: () => void;
  toggleEarthquakes?: () => void;
  toggleNight?: () => void;
  toggleNightShadow?: () => void;
  switchMode?: (mode: '3D' | 'STREET' | 'SATELLITE' | '3d' | '2d') => void;
  setArtStyle?: (style: GlobeArtStyle) => void;
  searchPoi?: (query: string) => void;
  resetView?: () => void;
}

const REGION_PRESETS = [
  { label: 'Kolkata', lat: 22.5726, lon: 88.3639, dist: 165 },
  { label: 'Delhi', lat: 28.6139, lon: 77.209, dist: 165 },
  { label: 'London', lat: 51.5074, lon: -0.1278, dist: 175 },
  { label: 'Tokyo', lat: 35.6762, lon: 139.6503, dist: 175 },
];

export const HoloGlobePanel: React.FC<HoloGlobePanelProps> = ({
  pendingAction,
  onActionHandled,
}) => {
  const [subMode, setSubMode] = useState<'globe' | 'radar'>('globe');
  const [mapView, setMapView] = useState<GlobeViewMode>('3D');
  const [artStyle, setArtStyle] = useState<GlobeArtStyle>('orbital');
  const [poiQuery, setPoiQuery] = useState('');
  const globeIframeRef = useRef<HTMLIFrameElement>(null);

  const getGlobeApi = (): BrahmaGlobeAPI | null => {
    const win = globeIframeRef.current?.contentWindow as
      | (Window & { BrahmaGlobe?: BrahmaGlobeAPI })
      | null;
    return win?.BrahmaGlobe ?? null;
  };

  useEffect(() => {
    if (!pendingAction || subMode !== 'globe') return;
    const timer = window.setTimeout(() => {
      const api = getGlobeApi();
      if (!api) return;
      const type = String(pendingAction.type || '');
      if (type === 'iss') {
        (api.toggleIss ?? api.toggleIssTracker)?.();
      } else if (type === 'earthquakes') {
        api.toggleEarthquakes?.();
      } else if (
        type === 'route' &&
        Array.isArray(pendingAction.orig) &&
        Array.isArray(pendingAction.dest)
      ) {
        const [oLat, oLon] = pendingAction.orig as number[];
        const [dLat, dLon] = pendingAction.dest as number[];
        api.showRoute?.(oLat, oLon, dLat, dLon, {
          originName: 'Mumbai (BOM)',
          destName: 'London (LHR)',
          distance_km: 7190,
          distance_nm: 3882,
          flight_time: '9h 15m',
          bearing: 312,
        });
      }
      onActionHandled?.();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [pendingAction, subMode, onActionHandled]);

  const handleArtChange = (nextStyle: GlobeArtStyle) => {
    setArtStyle(nextStyle);
    if (mapView !== '3D') {
      setMapView('3D');
      getGlobeApi()?.switchMode?.('3D');
    }
    getGlobeApi()?.setArtStyle?.(nextStyle);
  };

  const handleCycleViewMode = () => {
    const order: GlobeViewMode[] = ['3D', 'STREET', 'SATELLITE'];
    const next = order[(order.indexOf(mapView) + 1) % order.length];
    setMapView(next);
    getGlobeApi()?.switchMode?.(next);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#020305] overflow-hidden">
      {/* Unified Geospatial Toolbar */}
      <div className="px-4 py-2.5 bg-[#070a10] border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0d121c] border border-white/10">
          <button
            type="button"
            onClick={() => setSubMode('globe')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
              subMode === 'globe'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>3D HoloGlobe</span>
          </button>

          <button
            type="button"
            onClick={() => setSubMode('radar')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
              subMode === 'radar'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>Network Radar</span>
          </button>
        </div>

        {subMode === 'globe' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Global Art Presets */}
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0d121c] border border-white/10">
              <Layers className="w-3.5 h-3.5 text-cyan-400 ml-1.5 mr-0.5 shrink-0" />
              {(
                [
                  { id: 'orbital', label: 'Orbital' },
                  { id: 'blueprint', label: 'Blueprint' },
                  { id: 'solar', label: 'Solar' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleArtChange(preset.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                    artStyle === preset.id
                      ? 'bg-cyan-500/25 text-cyan-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCycleViewMode}
              className="px-2.5 py-1.5 rounded-lg bg-[#0d121c] hover:bg-white/10 border border-white/10 text-xs text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              View: {mapView}
            </button>

            <button
              type="button"
              onClick={() => {
                const api = getGlobeApi();
                (api?.toggleIss ?? api?.toggleIssTracker)?.();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/12 hover:bg-cyan-500/22 border border-cyan-500/35 text-xs text-cyan-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Orbit className="w-3.5 h-3.5" />
              <span>ISS Live</span>
            </button>

            <button
              type="button"
              onClick={() =>
                getGlobeApi()?.showRoute?.(19.076, 72.8777, 51.5074, -0.1278, {
                  originName: 'Mumbai (BOM)',
                  destName: 'London (LHR)',
                  distance_km: 7190,
                  distance_nm: 3882,
                  flight_time: '9h 15m',
                  bearing: 312,
                })
              }
              className="px-2.5 py-1.5 rounded-lg bg-[#0d121c] hover:bg-white/10 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plane className="w-3.5 h-3.5 text-cyan-400" />
              <span>BOM → LHR</span>
            </button>

            <button
              type="button"
              onClick={() => getGlobeApi()?.toggleEarthquakes?.()}
              className="px-2.5 py-1.5 rounded-lg bg-[#0d121c] hover:bg-white/10 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Seismic</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const api = getGlobeApi();
                (api?.toggleNight ?? api?.toggleNightShadow)?.();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#0d121c] hover:bg-white/10 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Moon className="w-3.5 h-3.5 text-indigo-300" />
              <span>Night</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMapView('3D');
                getGlobeApi()?.resetView?.();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#0d121c] hover:bg-white/10 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!poiQuery.trim()) return;
                setMapView('STREET');
                getGlobeApi()?.searchPoi?.(poiQuery.trim());
              }}
              className="flex items-center gap-1.5 bg-[#0d121c] border border-white/10 focus-within:border-cyan-400/50 rounded-lg px-2.5 py-1.5"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <input
                type="text"
                value={poiQuery}
                onChange={(e) => setPoiQuery(e.target.value)}
                placeholder="Search place or POI..."
                className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none w-32 sm:w-36"
              />
            </form>
          </div>
        )}
      </div>

      {/* Quick Region Focus Strip (only in 3D Globe view) */}
      {subMode === 'globe' && (
        <div className="px-4 py-1.5 bg-[#05070c] border-b border-white/5 flex items-center justify-between gap-3 text-[11px] overflow-x-auto">
          <div className="flex items-center gap-2 text-slate-400 whitespace-nowrap shrink-0">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Quick Fly-To:</span>
            {REGION_PRESETS.map((loc) => (
              <button
                key={loc.label}
                type="button"
                onClick={() => {
                  setMapView('3D');
                  getGlobeApi()?.switchMode?.('3D');
                  getGlobeApi()?.flyTo?.(loc.lat, loc.lon, loc.dist);
                }}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-cyan-500/15 text-slate-200 hover:text-cyan-200 transition cursor-pointer whitespace-nowrap"
              >
                {loc.label}
              </button>
            ))}
          </div>
          <div className="text-slate-500 whitespace-nowrap shrink-0 hidden sm:flex items-center gap-2">
            <span>2K Relief Topology</span>
            <span aria-hidden="true">·</span>
            <span>Fresnel Atmosphere</span>
            <span aria-hidden="true">·</span>
            <span>Drag to Orbit · Scroll to Street Map</span>
          </div>
        </div>
      )}

      {/* Embedded Enhanced 3D Globe / Radar Viewport */}
      <div className="flex-1 min-h-0 relative">
        <iframe
          ref={globeIframeRef}
          src={
            subMode === 'globe'
              ? '/brahma-assets/globe/index.html'
              : '/brahma-assets/radar/index.html'
          }
          title={subMode === 'globe' ? 'Brahma HoloGlobe 3D' : 'Brahma Network Radar HUD'}
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
};
