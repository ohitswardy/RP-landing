import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme';

const EASE = [0.25, 1, 0.5, 1] as const;

/**
 * Light / dark switch for the app shells. Same hairline-square register as
 * the other header controls (menu, sign out); the icon shows the mode you
 * would switch *to*, and it swings in like a dial as the theme flips.
 */
export function ThemeToggle({
  theme, onToggle, className, size = 15,
}: {
  theme: Theme;
  onToggle: () => void;
  className?: string;
  size?: number;
}) {
  const dark = theme === 'dark';
  const reduce = useReducedMotion();
  const action = dark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={action}
      onClick={onToggle}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center overflow-hidden border rule text-graphite',
        'transition-colors duration-300 hover:border-[color:var(--color-amber-deep)] hover:text-ink',
        'focus-visible:border-[color:var(--color-amber-deep)] focus-visible:outline-none active:scale-[0.94]',
        className,
      )}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={theme}
          initial={reduce ? false : { rotate: -70, opacity: 0, y: 5 }}
          animate={{ rotate: 0, opacity: 1, y: 0 }}
          exit={reduce ? undefined : { rotate: 70, opacity: 0, y: -5 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="grid place-items-center"
        >
          {dark ? <SunIcon size={size} weight="bold" /> : <MoonIcon size={size} weight="bold" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
