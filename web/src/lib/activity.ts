import { useSyncExternalStore } from 'react';

/* ─────────────────────────────────────────────────────────────
   Shell activity bus.

   One tiny external store the CMS/CRMS rail orb listens to. The
   API client reports every request as it starts and settles, the
   download helpers report transfers, and anything that finishes a
   job well calls `markSuccess()`. The orb derives a single phase
   from the counters — it never needs to know who is busy.

   Phase priority (highest wins while active):
     download → upload → busy (anything in flight) → success → idle
   ───────────────────────────────────────────────────────────── */

export type ActivityKind = 'download' | 'upload' | 'task';
export type ActivityPhase = 'idle' | 'busy' | 'download' | 'upload' | 'success';

/** How long the success state lingers before the orb settles back. */
export const SUCCESS_HOLD_MS = 4000;

const counts: Record<ActivityKind, number> = { download: 0, upload: 0, task: 0 };
let successUntil = 0;
let successTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
let snapshot: ActivityPhase = 'idle';

function derive(): ActivityPhase {
  if (counts.download > 0) return 'download';
  if (counts.upload > 0) return 'upload';
  if (counts.task > 0) return 'busy';
  if (Date.now() < successUntil) return 'success';
  return 'idle';
}

function emit() {
  const next = derive();
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

/** Start an activity; call the returned function exactly once when it ends. */
export function beginActivity(kind: ActivityKind): () => void {
  counts[kind] += 1;
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    counts[kind] = Math.max(0, counts[kind] - 1);
    emit();
  };
}

/** Hold the success phase for a few seconds (unless something else is running). */
export function markSuccess() {
  successUntil = Date.now() + SUCCESS_HOLD_MS;
  if (successTimer) clearTimeout(successTimer);
  successTimer = setTimeout(() => { successTimer = null; emit(); }, SUCCESS_HOLD_MS + 20);
  emit();
}

/**
 * Track a promise as an activity. With `success: true` a fulfilled promise
 * also lights the success phase — use it for the things a person did on
 * purpose (saves, sends, exports), not for background reads.
 */
export async function trackActivity<T>(kind: ActivityKind, work: Promise<T> | (() => Promise<T>), opts: { success?: boolean } = {}): Promise<T> {
  const end = beginActivity(kind);
  try {
    const result = await (typeof work === 'function' ? work() : work);
    if (opts.success) markSuccess();
    return result;
  } finally {
    end();
  }
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => snapshot;

/** The current shell phase, re-rendering only when it changes. */
export function useActivityPhase(): ActivityPhase {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
