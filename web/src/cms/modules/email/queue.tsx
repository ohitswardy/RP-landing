import { ApiError } from '../../../lib/api';
import { BtnGhost, BtnPrimary } from '../../ui';
import { Modal } from '../../kit/parts';
import { timeAgo, type QueueHealth } from '../../data';

/* ─────────────────────────────────────────────────────────────
   The queue worker behind "Send now". A blast queued while
   `php artisan queue:work` is down sits at "Queued" until one
   starts, so the API refuses with a 409 unless the desk confirms.
   Shared by the ledger and the composer.
   ───────────────────────────────────────────────────────────── */

/** The API's 409 for "no worker running", as opposed to its 409 for "already on its way". */
export function isNoWorkerRefusal(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 409 && /queue worker/i.test(e.message);
}

/** "Worker alive · 3 pending · database", or why it is not. */
export function queueLine(q: QueueHealth): string {
  const parts: string[] = [];
  parts.push(q.alive ? 'Worker alive' : q.lastSeenAt ? `Worker down · last seen ${timeAgo(q.lastSeenAt)}` : 'Worker never seen');
  if (q.pending !== null) parts.push(`${q.pending} pending`);
  if (q.stale > 0) parts.push(`${q.stale} stuck`);
  if (q.driver) parts.push(q.driver);
  return parts.join(' · ');
}

export function NoWorkerModal({ open, message, queue, onClose, onConfirm }: {
  open: boolean; message: string; queue: QueueHealth; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      title="The queue worker is not running"
      onClose={onClose}
      footer={
        <>
          <BtnGhost onClick={onClose}>Not now</BtnGhost>
          <BtnPrimary onClick={() => { onConfirm(); onClose(); }}>
            Queue anyway — it will leave once a worker is up
          </BtnPrimary>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13.5px] leading-relaxed text-slate">{message}</p>
        <p className="mono num border-l-2 pl-3 text-[11px] tracking-[0.04em] text-graphite" style={{ borderColor: 'var(--color-warn)' }}>
          {queueLine(queue)}
        </p>
        <p className="text-[12.5px] leading-relaxed text-graphite">
          Queueing now freezes the blast's content and holds it at “Queued”. It goes out, in order, the moment{' '}
          <span className="mono">php artisan queue:work</span> starts on the API host.
        </p>
      </div>
    </Modal>
  );
}
