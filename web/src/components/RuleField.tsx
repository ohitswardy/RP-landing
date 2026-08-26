import { useState, type ReactNode } from 'react';

/* ─────────────────────────────────────────────────────────────
   Label above, hairline rule below, amber underline on focus.
   Shared by the CMS onboarding panels and the client-facing
   registration and reset pages, so the two sides of the flow
   have the same field geometry.
   ───────────────────────────────────────────────────────────── */

export type RuleFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  type?: string;
  mono?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  trailing?: ReactNode;
  onEnter?: () => void;
  /** Larger type for the standalone client pages. */
  size?: 'sm' | 'lg';
};

export function RuleField({
  label, value, onChange, placeholder, hint, type = 'text', mono = false,
  autoComplete, disabled = false, trailing, onEnter, size = 'sm',
}: RuleFieldProps) {
  const [focused, setFocused] = useState(false);
  const lg = size === 'lg';

  return (
    <label className="block">
      <span className={`mono block uppercase tracking-[0.2em] text-graphite ${lg ? 'text-[10px]' : 'text-[9.5px]'}`}>
        {label}
      </span>
      <span className="flex items-end gap-3">
        <input
          type={type}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
          placeholder={placeholder}
          className={`w-full bg-transparent text-ink outline-none placeholder:text-silver disabled:text-graphite ${
            lg ? 'py-3 text-[16px]' : 'py-2.5 text-[14.5px]'
          } ${mono ? `mono ${lg ? 'text-[15px]' : 'text-[13px]'}` : ''}`}
        />
        {trailing && <span className="shrink-0 pb-2.5">{trailing}</span>}
      </span>
      <span className="relative block h-px w-full" style={{ background: 'color-mix(in oklab, var(--color-ink) 18%, transparent)' }}>
        <span
          className={`absolute inset-y-0 left-0 w-full origin-left transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${focused ? 'scale-x-100' : 'scale-x-0'}`}
          style={{ background: 'var(--color-amber-deep)' }}
        />
      </span>
      {hint && <span className="mt-2 block text-[11.5px] leading-relaxed text-graphite">{hint}</span>}
    </label>
  );
}

/** Rule field with a show/hide switch. */
export function PasswordField(props: Omit<RuleFieldProps, 'type' | 'trailing'>) {
  const [shown, setShown] = useState(false);
  return (
    <RuleField
      {...props}
      type={shown ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink"
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
