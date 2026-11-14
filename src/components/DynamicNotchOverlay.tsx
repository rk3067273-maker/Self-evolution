import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
import type { OrbState } from '../types/brahma';

interface DynamicNotchOverlayProps {
  orbState: OrbState;
  voiceLevel: number;
  terminalRunning: boolean;
  popupVisible: boolean;
  onTogglePopup: () => void;
}

const DOT_COLUMNS = [
  '#00e5ff',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#f43f5e',
  '#38bdf8',
  '#a3e635',
];

export const DynamicNotchOverlay: React.FC<DynamicNotchOverlayProps> = ({
  orbState,
  voiceLevel,
  terminalRunning,
  popupVisible,
  onTogglePopup,
}) => {
  const notchRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [tapBurst, setTapBurst] = useState(false);
  const [phase, setPhase] = useState(0);

  // Track taps, clicks, and pointer movement anywhere on the screen
  useEffect(() => {
    const updateEyeVector = (clientX: number, clientY: number, isTap: boolean) => {
      const rect = notchRef.current?.getBoundingClientRect();
      const originX = rect ? rect.left + rect.width * 0.28 : window.innerWidth / 2;
      const originY = rect ? rect.top + rect.height / 2 : 24;

      const dx = clientX - originX;
      const dy = clientY - originY;
      const dist = Math.hypot(dx, dy) || 1;
      const strength = Math.min(1, dist / 220);
      const nx = (dx / dist) * strength;
      const ny = (dy / dist) * strength;

      setLook({ x: nx, y: ny });

      if (isTap) {
        setTapBurst(true);
        window.setTimeout(() => setTapBurst(false), 180);
      }

      const win = window as unknown as {
        BrahmaNative?: {
          updateOverlayState?: (s: string, lvl: number, x: number, y: number) => void;
        };
      };
      win.BrahmaNative?.updateOverlayState?.(orbState, voiceLevel, nx, ny);
    };

    const handlePointerDown = (e: PointerEvent) => {
      updateEyeVector(e.clientX, e.clientY, true);
    };

    const handlePointerMove = (e: PointerEvent) => {
      updateEyeVector(e.clientX, e.clientY, false);
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [orbState, voiceLevel]);

  // Natural eye blinking
  useEffect(() => {
    const id = window.setInterval(() => {
      setIsBlinking(true);
      window.setTimeout(() => setIsBlinking(false), 130);
    }, 3800);
    return () => window.clearInterval(id);
  }, []);

  // Multi-color dot-matrix audio wave phase loop
  useEffect(() => {
    let rafId = 0;
    const step = () => {
      setPhase((p) => p + (voiceLevel > 0.12 || orbState === 'SPEAKING' || orbState === 'LISTENING' ? 0.24 : 0.06));
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [voiceLevel, orbState]);

  const pupilX = look.x * 4;
  const pupilY = look.y * 3.5;

  // Eyebrow tilt reacts to eye look direction and assistant state
  const browLift =
    orbState === 'SPEAKING'
      ? -1.5 - voiceLevel * 2
      : orbState === 'THINKING'
        ? -1
        : tapBurst
          ? -1.8
          : look.y * 1.2;
  const leftBrowTilt = orbState === 'EXECUTING' ? 10 : look.x * 8;
  const rightBrowTilt = orbState === 'EXECUTING' ? -10 : look.x * 8;

  const effectiveLevel =
    orbState === 'SPEAKING'
      ? Math.max(0.28, voiceLevel)
      : orbState === 'LISTENING'
        ? Math.max(0.18, voiceLevel)
        : orbState === 'THINKING' || orbState === 'EXECUTING'
          ? 0.22
          : 0.06;

  return (
    <div
      ref={notchRef}
      className={`fixed top-1.5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-3.5 h-10 rounded-full bg-[#050608]/95 backdrop-blur-xl border transition-all duration-200 shadow-[0_8px_28px_rgba(0,0,0,0.85)] select-none ${
        terminalRunning
          ? 'border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.28)]'
          : orbState === 'SPEAKING'
            ? 'border-cyan-400/60 shadow-[0_0_24px_rgba(0,229,255,0.28)]'
            : 'border-white/15'
      }`}
    >
      {/* Expressive Eye Pair with Eyebrows */}
      <div className="flex items-center gap-2 pl-0.5" aria-hidden="true">
        {[0, 1].map((eyeIdx) => {
          const browAngle = eyeIdx === 0 ? leftBrowTilt : rightBrowTilt;
          return (
            <div key={eyeIdx} className="relative flex flex-col items-center">
              {/* Eyebrow ("brue") */}
              <div
                className="w-3.5 h-[2px] rounded-full bg-slate-200 mb-[2px] transition-transform duration-100"
                style={{
                  transform: `translate(${pupilX * 0.45}px, ${browLift}px) rotate(${browAngle}deg)`,
                }}
              />
              {/* Eye Socket + Cyan Iris Pupil */}
              <div
                className={`w-4 h-4 rounded-full bg-[#0d1320] border border-cyan-500/35 flex items-center justify-center overflow-hidden transition-transform duration-100 ${
                  isBlinking ? 'scale-y-[0.12]' : tapBurst ? 'scale-110' : 'scale-100'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00e5ff] transition-transform duration-75"
                  style={{
                    transform: `translate(${pupilX}px, ${pupilY}px)`,
                  }}
                >
                  <div className="w-[2.5px] h-[2.5px] rounded-full bg-white ml-[1px] mt-[1px]" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* Multi-Color Dot-Matrix Voice Equalizer */}
      <div className="flex items-end gap-[4px] h-6 py-0.5" aria-label="Voice Equalizer">
        {DOT_COLUMNS.map((color, colIdx) => {
          const wave = ((Math.sin(phase + colIdx * 0.9) + 1) * 0.5) * effectiveLevel;
          const activeRows = Math.max(1, Math.min(4, Math.round(1 + wave * 4.2)));
          return (
            <div key={colIdx} className="flex flex-col-reverse gap-[2.5px]">
              {[0, 1, 2, 3].map((rowIdx) => {
                const lit = rowIdx < activeRows;
                return (
                  <span
                    key={rowIdx}
                    className="w-[3.5px] h-[3.5px] rounded-full transition-opacity duration-75"
                    style={{
                      backgroundColor: color,
                      opacity: lit ? 1 : 0.16,
                      boxShadow: lit ? `0 0 6px ${color}` : 'none',
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Terminal Popup Toggle Button inside Dynamic Notch */}
      <button
        type="button"
        onClick={onTogglePopup}
        title={popupVisible ? 'Hide Terminal Popup' : 'Show Terminal Popup'}
        className={`ml-0.5 px-2 h-7 rounded-full border text-[10px] font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
          popupVisible || terminalRunning
            ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
        }`}
      >
        <Terminal className="w-3 h-3" />
        <span className="hidden sm:inline">{terminalRunning ? 'Working' : popupVisible ? 'Hide' : 'Popup'}</span>
      </button>
    </div>
  );
};
