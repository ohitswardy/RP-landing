import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/* ─────────────────────────────────────────────────────────────
   Theme for the signed-in surfaces (CMS, CRMS, Client Portal).

   The public site is always light; only an app shell owns the
   `dark` class on <html>, and it hands it back on unmount. The
   preference is one key shared by the three areas, so a staff
   member who flips the CMS finds the CRMS already matching.

   · 'light' | 'dark'  — explicit choice, persisted
   · 'system'          — nothing stored; follows the OS setting

   index.html paints the class before the bundle loads so a
   reload never flashes light. Keep THEME_KEY and the path test
   there in step with this file.
   ───────────────────────────────────────────────────────────── */

export type Theme = 'light' | 'dark';
export type ThemePref = Theme | 'system';

export const THEME_KEY = 'regis-theme';
const MQ = '(prefers-color-scheme: dark)';

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia(MQ).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function resolveTheme(pref: ThemePref): Theme {
  return pref === 'system' ? systemTheme() : pref;
}

function paint(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

function unpaint() {
  const root = document.documentElement;
  root.classList.remove('dark');
  root.style.removeProperty('color-scheme');
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Runs `apply` inside a View Transition when the browser offers one, so the
    whole shell crossfades instead of every surface snapping independently. */
function withCrossfade(apply: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof doc.startViewTransition !== 'function' || prefersReducedMotion()) {
    apply();
    return;
  }
  doc.startViewTransition(() => { flushSync(apply); });
}

/**
 * Owns html.dark for as long as the calling shell is mounted.
 * Call it once, at the shell root — not in every module.
 */
export function useAppTheme() {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme: Theme = pref === 'system' ? system : pref;

  // Paint on every resolved change; hand the class back when the shell leaves.
  useEffect(() => { paint(theme); }, [theme]);
  useEffect(() => unpaint, []);

  // Follow the OS while unset, and other tabs of the same area always.
  useEffect(() => {
    const mq = window.matchMedia(MQ);
    const onMq = () => setSystem(mq.matches ? 'dark' : 'light');
    const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY || e.key === null) setPrefState(readPref()); };
    mq.addEventListener('change', onMq);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onMq);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setPref = useCallback((next: ThemePref) => {
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch { /* private mode — the choice still applies for this session */ }
    // Paint synchronously so a View Transition captures the new state.
    paint(resolveTheme(next));
    setPrefState(next);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    withCrossfade(() => setPref(next));
  }, [theme, setPref]);

  return { theme, pref, setPref, toggle };
}
