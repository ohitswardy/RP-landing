import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { useCms } from '../store';
import { BtnGhost, BtnPrimary, Chip, TextField } from '../ui';

/* ─────────────────────────────────────────────────────────────
   Change the signed-in staff member's own password. One account
   serves the CMS and the CRMS, so this lives in the kit and the
   Account page of both shells renders it; it posts PUT
   /cms/password, which revokes every other token on success
   (this tab keeps its own).
   ───────────────────────────────────────────────────────────── */

const MIN = 8;

type FieldErrors = { current?: string; password?: string; confirmation?: string };

export default function ChangePasswordForm() {
  const { changeOwnPassword } = useCms();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setCurrent(''); setPassword(''); setConfirmation('');
    setErrors({}); setError(null); setSaving(false); setDone(false);
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!current) next.current = 'Enter your current password.';
    if (password.length < MIN) next.password = `At least ${MIN} characters.`;
    else if (password === current) next.password = 'Choose a password different from the current one.';
    if (confirmation !== password) next.confirmation = 'The two new passwords do not match.';
    return next;
  }

  async function submit() {
    const problems = validate();
    setErrors(problems);
    setError(null);
    if (Object.keys(problems).length > 0) return;
    setSaving(true);
    try {
      await changeOwnPassword({ current, password, confirmation });
      setDone(true);
      setCurrent(''); setPassword(''); setConfirmation('');
    } catch (e) {
      if (e instanceof ApiError && e.errors) {
        setErrors({
          current: e.errors.current?.[0],
          password: e.errors.password?.[0],
          confirmation: e.errors.password_confirmation?.[0],
        });
        if (!e.errors.current && !e.errors.password && !e.errors.password_confirmation) setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'The password could not be changed.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Chip tone="live">Password changed</Chip>
        <p className="text-[13.5px] leading-relaxed text-slate">
          Every other signed-in session on this account has been signed out. This tab stays in.
        </p>
        <BtnGhost onClick={reset}>Change it again</BtnGhost>
      </div>
    );
  }

  return (
    <form
      className="max-w-[440px] space-y-6"
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
    >
      <p className="text-[13px] leading-relaxed text-graphite">
        This is the one account behind the CMS and the CRMS. Changing the password signs out every other session on it.
      </p>
      <PasswordField label="Current password" value={current} onChange={setCurrent} error={errors.current} autoComplete="current-password" />
      <div className="border-t rule pt-6 space-y-6">
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          helper={`At least ${MIN} characters. Longer beats cleverer.`}
          autoComplete="new-password"
        />
        <PasswordField label="Repeat new password" value={confirmation} onChange={setConfirmation} error={errors.confirmation} autoComplete="new-password" />
      </div>
      {error && (
        <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 pt-1">
        <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : 'Change password'}</BtnPrimary>
        <BtnGhost onClick={reset} disabled={saving}>Clear</BtnGhost>
      </div>
    </form>
  );
}

/** TextField's input is text-only, so the masked field is its own small wrapper. */
function PasswordField({ label, value, onChange, error, helper, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; helper?: string; autoComplete: string;
}) {
  const [shown, setShown] = useState(false);
  if (shown) {
    return (
      <div className="relative">
        <TextField label={label} value={value} onChange={onChange} error={error} helper={helper} />
        <RevealToggle shown onToggle={() => setShown(false)} />
      </div>
    );
  }
  return (
    <div className="relative flex flex-col gap-2">
      <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{label}</label>
      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rule bg-white px-3.5 py-2.5 pr-16 text-[14px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
      />
      {helper && !error && <p className="text-[12px] text-graphite">{helper}</p>}
      {error && <p className="text-[12px]" style={{ color: 'var(--color-warn)' }}>{error}</p>}
      <RevealToggle shown={false} onToggle={() => setShown(true)} />
    </div>
  );
}

function RevealToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mono absolute right-2.5 top-[31px] text-[9.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
      aria-pressed={shown}
    >
      {shown ? 'Hide' : 'Show'}
    </button>
  );
}
