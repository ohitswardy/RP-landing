import { useState } from 'react';
import Reveal from './Reveal';

/**
 * Ariel-style newsletter band: the house seal anchors the left, copy and
 * form sit on the grid. Left-aligned, not a centered stack.
 */
export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <section className="bg-bone text-ink border-t rule">
      <div className="container-fluid py-20 md:py-28">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10 items-center">
          {/* Seal */}
          <Reveal className="hidden md:block col-span-2">
            <img
              src="/RegisSquare.png"
              alt=""
              aria-hidden
              className="w-28 lg:w-32 opacity-70 grayscale"
            />
          </Reveal>

          {/* Copy */}
          <Reveal delay={0.05} className="col-span-12 md:col-span-5">
            <div className="eyebrow mb-6">The wire</div>
            <h2 className="text-[clamp(1.6rem,2.8vw,2.4rem)] leading-[1.1] tracking-[-0.02em] max-w-[16ch]">
              Stay in touch with the desk.
            </h2>
            <p className="mt-4 max-w-[44ch] text-slate text-[14.5px] leading-[1.65]">
              Selected research, market commentary, and event invitations,
              straight from Regis.
            </p>
          </Reveal>

          {/* Form */}
          <Reveal delay={0.1} className="col-span-12 md:col-span-4 md:col-start-9">
            {sent ? (
              <div className="inline-flex items-center gap-3 mono text-[11px] tracking-[0.16em] uppercase text-[color:var(--color-amber-deep)]">
                <span className="inline-block w-2 h-2" style={{ background: 'var(--color-amber)' }} />
                Subscribed. Welcome aboard.
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email) setSent(true);
                }}
                className="flex border rule bg-paper"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  aria-label="Email address"
                  className="min-w-0 flex-1 bg-transparent px-5 py-4 text-ink text-[14px] outline-none placeholder:text-graphite"
                />
                <button
                  type="submit"
                  className="px-6 text-navy-deep text-[13.5px] tracking-[-0.005em] transition-colors hover:brightness-105"
                  style={{ background: 'var(--color-amber)' }}
                >
                  Sign up
                </button>
              </form>
            )}
            <p className="mt-4 text-graphite text-[12px]">
              For institutional and qualified investors only. Unsubscribe anytime.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
