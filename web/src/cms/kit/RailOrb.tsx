import { useEffect, useMemo, useRef } from 'react';
import { MODE_FRAMES, resolvePreset, type OrbFrame, type OrbState } from 'thinking-orbs/engine';
import { SidebarLabel } from '@/components/ui/sidebar';
import { useActivityPhase, type ActivityPhase } from '@/lib/activity';

/* ─────────────────────────────────────────────────────────────
   Rail status orb — the brand-header's live mark in the CMS and
   CRMS shells. It is a `thinking-orbs` orb painted by hand: the
   package's engine gives us each frame's dots, and painting them
   ourselves lets the orb take a colour (the library ships strictly
   monochrome ink).

     idle      → composing   ink
     busy      → searching   ink       anything in flight
     download  → listening   signal    green, fetching a file
     upload    → listening   cobalt    blue, sending a file
     success   → breathing   ink       holds a few seconds

   Size 64 is the package's chat-avatar preset; it sits on the 72px
   icon column so its centre matches the nav marks below.
   ───────────────────────────────────────────────────────────── */

const SIZE = 64;
const ICON_COL = 72;

type Look = { state: OrbState; color: string; label: string; speed: number };

const LOOKS: Record<ActivityPhase, Look> = {
  idle:     { state: 'composing', color: 'var(--color-ink)',    label: 'Idle',        speed: 1 },
  busy:     { state: 'searching', color: 'var(--color-ink)',    label: 'Working',     speed: 1 },
  download: { state: 'listening', color: 'var(--color-signal)', label: 'Downloading', speed: 1 },
  upload:   { state: 'listening', color: 'var(--color-cobalt)', label: 'Uploading',   speed: 1 },
  success:  { state: 'breathing', color: 'var(--color-ink)',    label: 'Done',        speed: 1 },
};

/* Far dots fade toward the paper instead of dropping to grey: the same depth
   language the package paints, expressed as alpha so any ink colour works. */
const ALPHA_FLOOR = 0.14;

function paintFrame(ctx: CanvasRenderingContext2D, frame: OrbFrame, ink: string) {
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  for (const l of frame.lines) {
    const strength = 1 - Math.min(1, Math.max(0, l.white));
    ctx.globalAlpha = (l.a ?? 1) * (ALPHA_FLOOR + (1 - ALPHA_FLOOR) * strength);
    ctx.lineWidth = l.w;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
  for (const d of frame.dots) {
    const strength = 1 - Math.min(1, Math.max(0, d.white));
    ctx.globalAlpha = (d.a ?? 1) * (ALPHA_FLOOR + (1 - ALPHA_FLOOR) * strength);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function Orb({ state, color, speed = 1, size = SIZE, className = '' }: {
  state: OrbState; color: string; speed?: number; size?: 64 | 20; className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const preset = useMemo(() => resolvePreset(state, size), [state, size]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameOf = MODE_FRAMES[preset.mode];
    const clock = preset.speed * speed;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // `color` may be a CSS variable; the browser resolves it on the element.
    let ink = '';
    const resolveInk = () => {
      canvas.style.color = color;
      ink = getComputedStyle(canvas).color;
    };
    resolveInk();

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      paintFrame(ctx, frameOf(size, t, preset.opts), ink);
    };

    // html.dark is toggled by the shell's theme hook; re-resolve the ink when it flips.
    const themeObserver = new MutationObserver(() => { resolveInk(); if (reduced) draw(0.6); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    if (reduced) {
      draw(0.6);
      return () => themeObserver.disconnect();
    }

    let raf = 0;
    let running = false;
    const loop = () => { draw((performance.now() / 1000) * clock); if (running) raf = requestAnimationFrame(loop); };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') stop(); else start(); };
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      themeObserver.disconnect();
    };
  }, [preset, speed, size, color]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={state}
      className={className}
      style={{ width: size, height: size, display: 'block' }}
    />
  );
}

export default function RailOrb() {
  const phase = useActivityPhase();
  const look = LOOKS[phase];

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center" aria-live="polite">
      <div className="grid shrink-0 place-items-center" style={{ width: ICON_COL }}>
        <Orb state={look.state} color={look.color} speed={look.speed} />
      </div>
      <SidebarLabel className="mono text-[9px] uppercase tracking-[0.18em] text-graphite">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle transition-colors duration-500" style={{ background: look.color }} />
        {look.label}
      </SidebarLabel>
    </div>
  );
}
