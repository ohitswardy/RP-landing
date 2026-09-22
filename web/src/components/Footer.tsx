import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import LegalModal, { type ModalType } from './LegalModal';
import { apiFetch, ApiError } from '../lib/api';
import { useContactContent } from '../lib/contactContent';
import { REGULATORY_IDS } from '../lib/legalContent';
import { usePublicContentHealth } from '../lib/publicContent';

/*
 * "Client Login": only the Research Portal has a sign-in today. The other
 * three products have no portal of their own, so their labels stay on the
 * footer (they are real lines of business) but route to the contact desk
 * with the topic pre-selected rather than to a login that cannot serve them.
 */
const cols = [
  {
    h: 'Quick links',
    items: [
      ['Our Services', '/services'],
      ['Our Insights', '/insights'],
      ['About', '/about'],
      ['Careers', '/careers'],
      ['Contact Us', '/contact'],
    ],
  },
  {
    h: 'Client Login',
    items: [
      ['Research Portal', '/login'],
      ['Prime Brokerage', '/contact?topic=Prime%20Brokerage'],
      ['Regis Access', '/contact?topic=Regis%20Access'],
      ['Wealth Management', '/contact?topic=Wealth%20Management'],
    ],
  },
] as const;

/** Short glyphs for the well-known networks; anything else prints its label. */
function socialGlyph(label: string, href: string): string {
  const key = `${label} ${href}`.toLowerCase();
  if (key.includes('linkedin')) return 'in';
  if (key.includes('twitter') || key.includes('x.com') || /\bx\b/.test(label.toLowerCase())) return 'X';
  if (key.includes('youtube')) return 'YT';
  if (key.includes('facebook')) return 'f';
  if (key.includes('instagram')) return 'IG';
  return label.slice(0, 2).toUpperCase();
}

export default function Footer() {
  const [modal, setModal] = useState<ModalType>(null);
  const { social } = useContactContent();
  const health = usePublicContentHealth();

  return (
    <>
    <LegalModal open={modal} onClose={() => setModal(null)} />
    <footer className="bg-navy-deep text-paper">
      <div className="container-fluid pt-20 pb-10">
        <div className="grid grid-cols-12 gap-x-6 gap-y-14">
          <div className="col-span-12 md:col-span-3">
            <img
              src="/RegisFULL.png"
              alt="Regis Partners"
              style={{ height: '90px', width: 'auto', filter: 'brightness(0) invert(1)' }}
              draggable={false}
            />
            <p className="mt-5 max-w-[34ch] text-paper/55 leading-relaxed text-[14px]">
              An independent Philippine institutional brokerage and capital
              markets firm.
            </p>
            {social.length > 0 && (
              <ul className="mt-7 flex items-center gap-3" aria-label="Social">
                {social.map((s) => (
                  <li key={s.href}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      title={s.label}
                      className="w-8 h-8 inline-flex items-center justify-center border rule-navy text-paper/65 hover:text-paper hover:border-paper/40 transition-colors text-[11px]"
                    >
                      {socialGlyph(s.label, s.href)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {cols.map((c) => (
            <div key={c.h} className="col-span-6 md:col-span-2">
              <div className="mono text-[11px] tracking-[0.18em] uppercase text-paper/55 mb-5">{c.h}</div>
              <ul className="space-y-3">
                {c.items.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="text-paper/80 hover:text-[color:var(--color-amber)] text-[14px] transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-12 md:col-span-5 lg:col-span-4 lg:col-start-9">
            <SubscribeForm />
          </div>
        </div>

        <div className="h-px bg-[color:var(--color-navy-line)] mt-16 mb-6" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-[12px] text-paper/50">
          <div>
            © 1999–2026 Regis Partners, Inc. · SEC Reg. No. {REGULATORY_IDS.sec}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <button onClick={() => setModal('terms')} className="hover:text-paper transition-colors cursor-pointer">Terms & Conditions</button>
            <button onClick={() => setModal('privacy')} className="hover:text-paper transition-colors cursor-pointer">Privacy & Cookies</button>
          </div>
        </div>

        {health.apiDown && (
          <p
            role="status"
            title={health.lastError ?? undefined}
            className="mono mt-5 inline-flex items-center gap-2.5 text-[10px] uppercase tracking-[0.18em] text-paper/35"
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-amber)' }} />
            Live content unavailable — showing cached copy
          </p>
        )}
      </div>
    </footer>
    </>
  );
}

/* ── Newsletter ────────────────────────────────────────────── */

type SubscribeStatus = 'idle' | 'pending' | 'done' | 'error';

/**
 * Double opt-in sign-up. The endpoint answers the same neutral 200 for a
 * new, a known, and an already-verified address, so the copy here never
 * confirms whether an address is on the list. The hidden `company` field
 * is a honeypot: bots fill it, people never see it, and a filled one is
 * dropped client-side without a request.
 */
function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [honey, setHoney] = useState('');
  const [status, setStatus] = useState<SubscribeStatus>('idle');
  const [message, setMessage] = useState<string>('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'pending') return;
    const address = email.trim();
    if (!address) { setStatus('error'); setMessage('Enter your email address.'); return; }
    if (honey.trim() !== '') {
      // Honeypot tripped: pretend it worked, send nothing.
      setStatus('done');
      setMessage('Thanks. If that address is new to us, a confirmation email is on its way.');
      return;
    }
    setStatus('pending');
    setMessage('');
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/newsletter/subscribe', {
        method: 'POST',
        body: name.trim() ? { email: address, name: name.trim() } : { email: address },
      });
      setStatus('done');
      setMessage(res.message || 'Thanks. If that address is new to us, a confirmation email is on its way.');
      setEmail('');
      setName('');
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof ApiError && err.status === 422
          ? err.message
          : 'We could not take that just now. Please try again in a moment.',
      );
    }
  }

  const pending = status === 'pending';

  return (
    <div id="newsletter" className="scroll-mt-24">
      <div className="mono text-[11px] tracking-[0.18em] uppercase text-paper/55 mb-5">Newsletter</div>
      <p className="max-w-[36ch] text-[14px] leading-relaxed text-paper/70">
        Our daily, weekly and monthly notes on Philippine equities, by email. Confirm the address once; unsubscribe in one click.
      </p>

      {status === 'done' ? (
        <p role="status" className="mt-6 border-l-2 pl-4 text-[13.5px] leading-relaxed text-paper/85" style={{ borderColor: 'var(--color-amber)' }}>
          {message}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate aria-busy={pending}>
          {/* Honeypot — off-screen, not in the tab order, and never announced. */}
          <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
            <label htmlFor="footer-company">Company</label>
            <input
              id="footer-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honey}
              onChange={(e) => setHoney(e.target.value)}
            />
          </div>

          <FooterInput
            id="footer-name"
            label="Name (optional)"
            type="text"
            autoComplete="name"
            value={name}
            onChange={setName}
            disabled={pending}
          />
          <FooterInput
            id="footer-email"
            label="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            disabled={pending}
            required
          />

          {status === 'error' && message && (
            <p role="alert" className="text-[12.5px] leading-relaxed" style={{ color: 'var(--color-amber)' }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="group mt-1 inline-flex items-center gap-4 text-paper disabled:cursor-wait disabled:opacity-60"
          >
            <span className="text-[13.5px] tracking-[-0.005em]">{pending ? 'Subscribing' : 'Subscribe'}</span>
            <span aria-hidden className="relative flex items-center text-[color:var(--color-amber)]">
              <span className="block h-px w-8 bg-current transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:w-14" />
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none" className="-ml-[1px] shrink-0">
                <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
          </button>
        </form>
      )}
    </div>
  );
}

function FooterInput({
  id, label, type, value, onChange, disabled, required, autoComplete,
}: {
  id: string; label: string; type: string; value: string; onChange: (v: string) => void;
  disabled?: boolean; required?: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mono block text-[10px] uppercase tracking-[0.2em] text-paper/40">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        className="mt-2 w-full border-b border-paper/20 bg-transparent py-2 text-[15px] text-paper outline-none transition-colors placeholder:text-paper/25 focus:border-[color:var(--color-amber)] disabled:opacity-60"
      />
    </div>
  );
}
