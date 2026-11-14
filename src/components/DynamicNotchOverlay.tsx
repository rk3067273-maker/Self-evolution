import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Terminal } from 'lucide-react';
import type { OrbState } from '../types/brahma';

export type NotchMood = 'neutral' | 'happy' | 'sad' | 'angry' | 'dizzy';

interface DynamicNotchOverlayProps {
  orbState: OrbState;
  voiceLevel: number;
  terminalRunning: boolean;
  popupVisible: boolean;
  onTogglePopup: () => void;
  expressionsEnabled?: boolean;
  dizzyEnabled?: boolean;
  silentUntilUserSpeaks?: boolean;
  scale?: number;
  position?: { x: number; y: number } | null;
  onPositionChange?: (pos: { x: number; y: number } | null) => void;
  forcedMood?: { mood: NotchMood; ts: number } | null;
  onDizzyTriggered?: (phrase: string) => void;
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

const DIZZY_LINES = [
  'উফফ! আমার মাথা ঘুরছে! এতো জোরে আঙুল ঘোরাবেন না!',
  'আরে থামুন! সব বনবন করে ঘুরছে, মাথা ঘুরে গেলো তো!',
  'ওহ বাপরে! গিজিমিজি করবেন না, আমার চক্কর আসছে!',
];

export const DynamicNotchOverlay: React.FC<DynamicNotchOverlayProps> = ({
  orbState,
  voiceLevel,
  terminalRunning,
  popupVisible,
  onTogglePopup,
  expressionsEnabled = true,
  dizzyEnabled = true,
  silentUntilUserSpeaks = true,
  scale = 0.82,
  position = null,
  onPositionChange,
  forcedMood = null,
  onDizzyTriggered,
}) => {
  const notchRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [tapBurst, setTapBurst] = useState(false);
  const [phase, setPhase] = useState(0);
  const [mood, setMood] = useState<NotchMood>('neutral');
  const [dizzyBubble, setDizzyBubble] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [livePos, setLivePos] = useState<{ x: number; y: number } | null>(position);

  const motionTrailRef = useRef<
    Array<{ x: number; y: number; t: number; dx: number; dy: number }>
  >([]);
  const lastDizzyAtRef = useRef<number>(0);
  const moodTimeoutRef = useRef<number>(0);
  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startBoxX: number;
    startBoxY: number;
  }>({
    active: false,
    moved: false,
    pointerId: -1,
    startPointerX: 0,
    startPointerY: 0,
    startBoxX: 0,
    startBoxY: 0,
  });

  useEffect(() => {
    setLivePos(position);
  }, [position]);

  const clampPos = (x: number, y: number) => {
    const rect = notchRef.current?.getBoundingClientRect();
    const w = rect?.width || 190 * scale;
    const h = rect?.height || 36 * scale;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return {
      x: Math.round(Math.min(maxX, Math.max(6, x))),
      y: Math.round(Math.min(maxY, Math.max(6, y))),
    };
  };

  useEffect(() => {
    const onResize = () => {
      setLivePos((prev) => (prev ? clampPos(prev.x, prev.y) : null));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  const triggerDizzyState = (speak = false) => {
    const now = Date.now();
    lastDizzyAtRef.current = now;
    setMood('dizzy');
    const line = DIZZY_LINES[Math.floor(Math.random() * DIZZY_LINES.length)];
    setDizzyBubble(line);

    const win = window as unknown as {
      BrahmaNative?: { updateOverlayMood?: (m: string) => void };
    };
    win.BrahmaNative?.updateOverlayMood?.('dizzy');

    // Never speak unsolicited when silentUntilUserSpeaks is active
    if (speak && !silentUntilUserSpeaks) {
      onDizzyTriggered?.(line);
    }

    window.clearTimeout(moodTimeoutRef.current);
    moodTimeoutRef.current = window.setTimeout(() => {
      setMood('neutral');
      setDizzyBubble(null);
      win.BrahmaNative?.updateOverlayMood?.('neutral');
    }, 4500);
  };

  // Sync forced mood from Settings test buttons
  useEffect(() => {
    if (!forcedMood) return;
    if (forcedMood.mood === 'dizzy') {
      triggerDizzyState(false);
      return;
    }
    setMood(forcedMood.mood);
    setDizzyBubble(null);
    const win = window as unknown as {
      BrahmaNative?: { updateOverlayMood?: (m: string) => void };
    };
    win.BrahmaNative?.updateOverlayMood?.(forcedMood.mood);
    window.clearTimeout(moodTimeoutRef.current);
    moodTimeoutRef.current = window.setTimeout(() => {
      setMood('neutral');
      win.BrahmaNative?.updateOverlayMood?.('neutral');
    }, 4500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedMood]);

  // Occasional autonomous visual mood expressions (silent, no speech)
  useEffect(() => {
    if (!expressionsEnabled) {
      setMood((prev) => (prev === 'dizzy' ? prev : 'neutral'));
      return;
    }
    const id = window.setInterval(() => {
      if (Date.now() - lastDizzyAtRef.current < 6000) return;
      if (orbState === 'SPEAKING' || orbState === 'EXECUTING') return;
      const pool: NotchMood[] = ['happy', 'sad', 'angry', 'happy', 'neutral'];
      const picked = pool[Math.floor(Math.random() * pool.length)];
      setMood(picked);
      const win = window as unknown as {
        BrahmaNative?: { updateOverlayMood?: (m: string) => void };
      };
      win.BrahmaNative?.updateOverlayMood?.(picked);
      window.clearTimeout(moodTimeoutRef.current);
      moodTimeoutRef.current = window.setTimeout(() => {
        setMood((cur) => (cur === 'dizzy' ? cur : 'neutral'));
        win.BrahmaNative?.updateOverlayMood?.('neutral');
      }, 4200);
    }, 17000);
    return () => window.clearInterval(id);
  }, [expressionsEnabled, orbState]);

  // Track taps, pointer moves & detect rapid dizzy scrubbing (unless dragging the notch itself)
  useEffect(() => {
    const updateEyeVector = (clientX: number, clientY: number, isTap: boolean) => {
      const rect = notchRef.current?.getBoundingClientRect();
      const originX = rect ? rect.left + rect.width * 0.28 : window.innerWidth / 2;
      const originY = rect ? rect.top + rect.height / 2 : 24;

      const dx = clientX - originX;
      const dy = clientY - originY;
      const dist = Math.hypot(dx, dy) || 1;
      const strength = Math.min(1, dist / 200);
      const nx = (dx / dist) * strength;
      const ny = (dy / dist) * strength;

      setLook({ x: nx, y: ny });

      if (isTap) {
        setTapBurst(true);
        window.setTimeout(() => setTapBurst(false), 160);
      }

      const win = window as unknown as {
        BrahmaNative?: {
          updateOverlayState?: (s: string, lvl: number, x: number, y: number) => void;
        };
      };
      win.BrahmaNative?.updateOverlayState?.(orbState, voiceLevel, nx, ny);

      if (dizzyEnabled && !dragStateRef.current.active) {
        const now = Date.now();
        const trail = motionTrailRef.current;
        const prev = trail[trail.length - 1];
        const stepDx = prev ? clientX - prev.x : 0;
        const stepDy = prev ? clientY - prev.y : 0;
        const stepLen = Math.hypot(stepDx, stepDy);

        if (!prev || stepLen > 4) {
          trail.push({ x: clientX, y: clientY, t: now, dx: stepDx, dy: stepDy });
        }
        while (trail.length > 0 && now - trail[0].t > 1100) {
          trail.shift();
        }

        if (trail.length >= 10 && now - lastDizzyAtRef.current > 6500) {
          let totalDist = 0;
          let reversals = 0;
          for (let i = 1; i < trail.length; i++) {
            const a = trail[i - 1];
            const b = trail[i];
            totalDist += Math.hypot(b.dx, b.dy);
            const magA = Math.hypot(a.dx, a.dy);
            const magB = Math.hypot(b.dx, b.dy);
            if (magA > 3 && magB > 3) {
              const dot = (a.dx * b.dx + a.dy * b.dy) / (magA * magB);
              if (dot < 0.25) reversals++;
            }
          }
          if (totalDist > 750 && reversals >= 5) {
            motionTrailRef.current = [];
            triggerDizzyState(false);
          }
        }
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      updateEyeVector(e.clientX, e.clientY, true);
    };
    const handlePointerMove = (e: PointerEvent) => {
      updateEyeVector(e.clientX, e.clientY, false);
    };
    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) updateEyeVector(t.clientX, t.clientY, false);
    };
    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) updateEyeVector(t.clientX, t.clientY, true);
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dizzyEnabled, orbState, voiceLevel, silentUntilUserSpeaks]);

  // Natural blinking
  useEffect(() => {
    const id = window.setInterval(() => {
      setIsBlinking(true);
      window.setTimeout(() => setIsBlinking(false), 130);
    }, 3600);
    return () => window.clearInterval(id);
  }, []);

  // Equalizer phase animation
  useEffect(() => {
    let rafId = 0;
    const step = () => {
      setPhase(
        (p) =>
          p +
          (mood === 'dizzy'
            ? 0.35
            : voiceLevel > 0.12 || orbState === 'SPEAKING' || orbState === 'LISTENING'
              ? 0.24
              : 0.06)
      );
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [mood, orbState, voiceLevel]);

  // Notch drag handlers (move to any corner or spot on screen)
  const handleNotchPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = notchRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      active: true,
      moved: false,
      pointerId: e.pointerId,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startBoxX: livePos ? livePos.x : rect.left,
      startBoxY: livePos ? livePos.y : rect.top,
    };
    setDragging(true);
  };

  const handleNotchPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.startPointerX;
    const dy = e.clientY - st.startPointerY;
    if (Math.hypot(dx, dy) > 4) {
      st.moved = true;
    }
    if (st.moved) {
      const clamped = clampPos(st.startBoxX + dx, st.startBoxY + dy);
      setLivePos(clamped);
    }
  };

  const handleNotchPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    st.active = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (st.moved && livePos) {
      onPositionChange?.(livePos);
    }
  };

  const pupilX = mood === 'sad' ? look.x * 2.5 : look.x * 4.5;
  const pupilY = mood === 'sad' ? Math.max(1.5, look.y * 3.5) : look.y * 3.8;

  const browLift =
    mood === 'angry'
      ? 1.5
      : mood === 'sad'
        ? -0.5
        : mood === 'happy'
          ? -2.2
          : orbState === 'SPEAKING'
            ? -1.5 - voiceLevel * 2
            : tapBurst
              ? -1.8
              : look.y * 1.2;

  const getBrowAngle = (eyeIdx: number) => {
    if (mood === 'angry') return eyeIdx === 0 ? 22 : -22;
    if (mood === 'sad') return eyeIdx === 0 ? -18 : 18;
    if (mood === 'dizzy') return Math.sin(phase * 1.4 + eyeIdx * 2) * 18;
    if (orbState === 'EXECUTING') return eyeIdx === 0 ? 10 : -10;
    return look.x * 8;
  };

  const eyeGlowColor =
    mood === 'angry'
      ? '#f43f5e'
      : mood === 'sad'
        ? '#60a5fa'
        : mood === 'dizzy'
          ? '#f59e0b'
          : orbState === 'THINKING'
            ? '#a78bfa'
            : orbState === 'SPEAKING'
              ? '#fb7185'
              : orbState === 'LISTENING'
                ? '#2dd4bf'
                : '#00e5ff';

  const notchRgbMode =
    mood === 'neutral' && !terminalRunning
      ? orbState === 'THINKING'
        ? 'thinking'
        : orbState === 'SPEAKING'
          ? 'speaking'
          : orbState === 'LISTENING'
            ? 'listening'
            : null
      : null;

  const effectiveLevel =
    orbState === 'SPEAKING'
      ? Math.max(0.28, voiceLevel)
      : orbState === 'LISTENING'
        ? Math.max(0.18, voiceLevel)
        : orbState === 'THINKING' || orbState === 'EXECUTING' || mood === 'dizzy'
          ? 0.25
          : 0.06;

  const safeScale = Math.min(1.4, Math.max(0.55, scale));
  const dizzyRot = mood === 'dizzy' ? `rotate(${Math.sin(phase * 1.6) * 4}deg)` : '';

  const positionStyle: React.CSSProperties = livePos
    ? {
        left: `${livePos.x}px`,
        top: `${livePos.y}px`,
        transformOrigin: 'top left',
        transform: `scale(${safeScale}) ${dizzyRot}`.trim(),
      }
    : {
        left: '50%',
        top: '6px',
        transformOrigin: 'top center',
        transform: `translateX(-50%) scale(${safeScale}) ${dizzyRot}`.trim(),
      };

  return (
    <>
      <div
        ref={notchRef}
        onPointerDown={handleNotchPointerDown}
        onPointerMove={handleNotchPointerMove}
        onPointerUp={handleNotchPointerUp}
        onPointerCancel={handleNotchPointerUp}
        onDoubleClick={() => {
          setLivePos(null);
          onPositionChange?.(null);
        }}
        title="ড্র্যাগ করে যেকোনো কোণায় নিন · Double-click করলে উপরে মাঝখানে ফিরে আসবে"
        className={`fixed z-50 flex items-center gap-2.5 px-3 h-9 rounded-full bg-[#050608]/95 backdrop-blur-xl border select-none touch-none ${
          dragging ? 'cursor-grabbing ring-2 ring-cyan-400/50' : 'cursor-grab transition-shadow duration-200'
        } shadow-[0_8px_28px_rgba(0,0,0,0.85)] ${
          mood === 'dizzy'
            ? 'border-amber-400/75 shadow-[0_0_26px_rgba(245,158,11,0.45)] animate-pulse'
            : mood === 'angry'
              ? 'border-rose-500/75 shadow-[0_0_26px_rgba(244,63,94,0.4)]'
              : mood === 'sad'
                ? 'border-blue-400/65 shadow-[0_0_22px_rgba(96,165,250,0.3)]'
                : terminalRunning
                  ? 'border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.28)]'
                  : orbState === 'THINKING'
                    ? 'border-violet-400/45 shadow-[0_0_24px_rgba(167,139,250,0.26)]'
                    : orbState === 'SPEAKING'
                      ? 'border-rose-400/45 shadow-[0_0_24px_rgba(251,113,133,0.26)]'
                      : orbState === 'LISTENING'
                        ? 'border-teal-400/45 shadow-[0_0_24px_rgba(45,212,191,0.26)]'
                        : 'border-white/15'
        }`}
        style={positionStyle}
      >
        {notchRgbMode && (
          <div className={`brahma-rgb-rim brahma-rgb-${notchRgbMode}`}>
            <div className="brahma-rgb-rim-rotor" />
          </div>
        )}

        <GripVertical className="w-3 h-3 text-slate-500 -ml-1 shrink-0" />

        {/* Expressive Eye Pair with Eyebrows */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {[0, 1].map((eyeIdx) => {
            const browAngle = getBrowAngle(eyeIdx);
            return (
              <div key={eyeIdx} className="relative flex flex-col items-center">
                <div
                  className="w-3 h-[2px] rounded-full mb-[2px] transition-transform duration-100"
                  style={{
                    backgroundColor: mood === 'angry' ? '#fda4af' : '#e2e8f0',
                    transform: `translate(${pupilX * 0.4}px, ${browLift}px) rotate(${browAngle}deg)`,
                  }}
                />
                <div
                  className={`relative w-3.5 h-3.5 rounded-full bg-[#0d1320] border flex items-center justify-center overflow-hidden transition-transform duration-100 ${
                    isBlinking && mood !== 'dizzy'
                      ? 'scale-y-[0.12]'
                      : mood === 'angry'
                        ? 'scale-y-[0.82]'
                        : tapBurst
                          ? 'scale-110'
                          : 'scale-100'
                  }`}
                  style={{ borderColor: `${eyeGlowColor}66` }}
                >
                  {mood === 'dizzy' ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="w-3 h-3 text-amber-400 animate-spin"
                      style={{ animationDuration: '0.55s' }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M12 12c0-1.5 1.5-2.5 3-2 2 .7 2.5 3.3 1 5-2 2.2-5.5 2-7.5-.5-2.5-3.2-1.5-8 2-10" />
                    </svg>
                  ) : (
                    <div
                      className="w-1.5 h-1.5 rounded-full transition-transform duration-75"
                      style={{
                        backgroundColor: eyeGlowColor,
                        boxShadow: `0 0 8px ${eyeGlowColor}`,
                        transform: `translate(${pupilX}px, ${pupilY}px) scale(${mood === 'sad' ? 0.88 : 1})`,
                      }}
                    >
                      <div className="w-[2px] h-[2px] rounded-full bg-white ml-[1px] mt-[1px]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Multi-Color Dot-Matrix Voice Equalizer */}
        <div className="flex items-end gap-[3.5px] h-5 py-0.5" aria-label="Voice Equalizer">
          {DOT_COLUMNS.map((color, colIdx) => {
            const wave = ((Math.sin(phase + colIdx * 0.9) + 1) * 0.5) * effectiveLevel;
            const activeRows = Math.max(1, Math.min(4, Math.round(1 + wave * 4.2)));
            return (
              <div key={colIdx} className="flex flex-col-reverse gap-[2px]">
                {[0, 1, 2, 3].map((rowIdx) => {
                  const lit = rowIdx < activeRows;
                  return (
                    <span
                      key={rowIdx}
                      className="w-[3px] h-[3px] rounded-full transition-opacity duration-75"
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
          className={`ml-0.5 px-2 h-6 rounded-full border text-[10px] font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
            popupVisible || terminalRunning
              ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
          }`}
        >
          <Terminal className="w-3 h-3" />
          <span className="hidden sm:inline">
            {terminalRunning ? 'Working' : popupVisible ? 'Hide' : 'Popup'}
          </span>
        </button>
      </div>

      {/* Visual-only Floating Thought Pill when Dizzy */}
      {dizzyBubble && (
        <div
          className="fixed z-50 px-3 py-1 rounded-full bg-[#120d05]/95 border border-amber-400/60 text-[11px] font-semibold text-amber-200 shadow-xl whitespace-nowrap animate-bounce pointer-events-none"
          style={
            livePos
              ? { left: `${livePos.x}px`, top: `${livePos.y + 42 * safeScale}px` }
              : { left: '50%', top: `${12 + 38 * safeScale}px`, transform: 'translateX(-50%)' }
          }
        >
          😵 {dizzyBubble}
        </div>
      )}
    </>
  );
};
