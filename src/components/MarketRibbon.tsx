import { useEffect, useState } from 'react';
import { useTicker } from '../hooks/useTicker';

export default function MarketRibbon() {
  const { entries, status } = useTicker();
  // Four copies: ensures content is always wider than any viewport so
  // the seamless -25% CSS loop never shows empty space.
  const row = [...entries, ...entries, ...entries, ...entries];

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  // Mobile: 25 s (fast), Desktop: 60 s
  const duration = isMobile ? 25 : 60;

  const isLive = status === 'live';
  const dotColor = isLive ? 'var(--color-signal)' : 'var(--color-amber)';
  const statusLabel = status === 'loading' ? 'PSE · Loading' : isLive ? 'PSE · Delayed' : 'PSE · 15mins delay.';

  return (
    <div id="market-ribbon" className="sticky top-0 z-50 bg-navy-deep text-paper border-b rule-navy overflow-hidden">
      <div className="flex items-stretch h-9">
        {/* Marquee */}
        <div className="relative flex-1 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-12 z-10"
            style={{ background: 'linear-gradient(to right, var(--color-navy-deep), transparent)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-12 z-10"
            style={{ background: 'linear-gradient(to left, var(--color-navy-deep), transparent)' }}
          />

          {/* Inject the keyframe once via a <style> tag scoped to this element */}
          <style>{`
            @keyframes marquee-scroll {
              from { transform: translate3d(0, 0, 0); }
              to   { transform: translate3d(-25%, 0, 0); }
            }
          `}</style>

          <div
            className="flex items-center gap-8 whitespace-nowrap h-full px-6 mono text-[11px] tracking-[0.04em]"
            style={{
              animation: `marquee-scroll ${duration}s linear infinite`,
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              WebkitFontSmoothing: 'subpixel-antialiased',
            }}
          >
            {row.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="text-paper/85">{t.sym}</span>
                <span className="text-paper/55 num">{t.last}</span>
                <span
                  className="num"
                  style={{
                    color:
                      t.dir === 'up'
                        ? 'var(--color-signal)'
                        : t.dir === 'down'
                        ? 'var(--color-warn)'
                        : 'var(--color-paper)',
                  }}
                >
                  {t.dir === 'up' ? '▲' : t.dir === 'down' ? '▼' : '◆'} {t.chg}
                </span>
                <span className="text-paper/15 px-2" aria-hidden>/</span>
              </span>
            ))}
          </div>
        </div>

        {/* Live indicator */}
        <div
          className="shrink-0 pl-5 pr-6 flex items-center gap-2 border-l rule-navy"
          title={isLive ? 'Source: phisix-api · approx. 15-minute delay' : 'Falling back to placeholder values'}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: dotColor }}
            aria-hidden
          />
          <span className="mono text-[10.5px] tracking-[0.18em] uppercase text-paper/55">
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
