import { motion } from 'framer-motion';
import { useTicker } from '../hooks/useTicker';

function formatTime(d: Date | null): string {
  if (!d) return '— —';
  return d.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila',
  }) + ' PHT';
}

export default function MarketRibbon() {
  const { entries, status, updatedAt } = useTicker();
  const row = [...entries, ...entries];

  const isLive = status === 'live';
  const dotColor = isLive ? 'var(--color-signal)' : 'var(--color-amber)';
  const statusLabel = status === 'loading' ? 'PSE · Loading' : isLive ? 'PSE · Delayed' : 'PSE · Data 15min delayed. Don\'t trade off it';

  return (
    <div className="bg-navy-deep text-paper border-b rule-navy overflow-hidden">
      <div className="flex items-stretch h-9">
        {/* Live indicator */}
        <div
          className="shrink-0 pl-6 pr-5 flex items-center gap-2 border-r rule-navy"
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

          <motion.div
            key={entries.map((e) => e.sym + e.last).join('|')}
            className="flex items-center gap-8 whitespace-nowrap h-full px-6 mono text-[11px] tracking-[0.04em]"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
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
          </motion.div>
        </div>

        {/* Timestamp */}
        <div className="hidden md:flex shrink-0 pr-6 pl-5 items-center border-l rule-navy">
          <span className="mono text-[10.5px] tracking-[0.16em] uppercase text-paper/55">
            {formatTime(updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
