import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import LegalModal, { type ModalType } from '../components/LegalModal';

const EASE = [0.25, 1, 0.5, 1] as const;

export default function Login() {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [focus, setFocus] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
    <LegalModal open={modal} onClose={() => setModal(null)} />
    <section className="relative min-h-[calc(100vh-6.25rem)] overflow-hidden bg-white text-[#0d0d0d]">
      {/* Perforated dot-matrix canvas */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(13,13,13,0.07) 1px, transparent 1.4px)',
          backgroundSize: '22px 22px',
        }}
      />
      {/* Soft white vignette so the grid dissolves at the edges */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 40%, transparent 35%, rgba(255,255,255,0.9) 100%)',
        }}
      />

      {/* Glyph — slow concentric dotted ring, blurred behind the glass card */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-44 h-[640px] w-[640px] opacity-90 md:opacity-100"
        animate={{ rotate: 360 }}
        transition={{ duration: 160, ease: 'linear', repeat: Infinity }}
      >
        <svg viewBox="0 0 600 600" className="h-full w-full">
          {[150, 214, 278].map((r) => (
            <circle
              key={r}
              cx="300"
              cy="300"
              r={r}
              fill="none"
              stroke="rgba(30,58,138,0.35)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="0.5 11"
            />
          ))}
          <circle
            cx="300"
            cy="300"
            r="106"
            fill="none"
            stroke="rgba(30,58,138,0.18)"
            strokeWidth="1"
          />
        </svg>
      </motion.div>

      <div className="container-fluid relative grid grid-cols-12 items-center gap-x-6 py-20 md:py-28">
        {/* ── Left: identity ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="col-span-12 flex items-center justify-center lg:col-span-6 lg:justify-center lg:pr-0"
        >
          <img
            src="/RegisFULL.png"
            alt="Regis Partners"
            className="w-80 select-none md:w-[26rem] lg:w-[30rem]"
            draggable={false}
          />
        </motion.div>

        {/* ── Right: glass auth card ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE, delay: 0.25 }}
          className="col-span-12 mt-16 lg:col-span-5 lg:col-start-8 lg:mt-0"
        >
          <div className="relative overflow-hidden rounded-[20px] border border-black/[0.07] bg-white/55 p-7 backdrop-blur-2xl md:p-10 [box-shadow:0_30px_90px_-32px_rgba(13,13,13,0.28),0_1px_0_rgba(255,255,255,0.9)_inset]">
            {/* Top hairline glint */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(13,13,13,0.18), transparent)',
              }}
            />

            <div className="mb-9 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-black/40">
              <span>Access</span>
              <span>001 / Auth</span>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-9">
              <Field
                id="email"
                label="Username / Email"
                value={email}
                setValue={setEmail}
                focus={focus}
                setFocus={setFocus}
                type="email"
                placeholder="you@firm.com"
              />
              <Field
                id="pwd"
                label="Password"
                value={pwd}
                setValue={setPwd}
                focus={focus}
                setFocus={setFocus}
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••••••"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/40 transition-colors hover:text-black"
                  >
                    {showPwd ? 'Hide' : 'Show'}
                  </button>
                }
              />

              <div className="flex items-center justify-between text-[13px] text-black/55">
                <label className="inline-flex cursor-pointer select-none items-center gap-2.5">
                  <span className="relative grid h-4 w-4 place-items-center rounded-[4px] border border-black/25 transition-colors duration-300 has-[input:checked]:border-[#0d0d0d] has-[input:checked]:bg-[#0d0d0d]">
                    <input type="checkbox" className="peer absolute inset-0 cursor-pointer opacity-0" />
                    <svg
                      viewBox="0 0 12 12"
                      className="h-2.5 w-2.5 opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2.5 6.5L5 9l4.5-5.5" />
                    </svg>
                  </span>
                  Remember for 30 days
                </label>
                <a href="#" className="underline-offset-4 transition-colors hover:text-black">
                  Reset
                </a>
              </div>

              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                type="submit"
                className="group relative w-full overflow-hidden rounded-full bg-[navy] py-4 text-[13.5px] tracking-[0.005em] text-white"
              >
                <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
                  Enter portal
                  <span className="transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-1">
                    →
                  </span>
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-y-full bg-[#1d1d1f] transition-transform duration-[450ms] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-y-0"
                />
              </motion.button>

              <div className="h-px bg-black/10" />

              <p className="text-[12.5px] leading-relaxed text-black/50">
                Not yet a Regis client?{' '}
                <Link
                  to="/contact"
                  className="text-[#0d0d0d] underline-offset-4 hover:underline"
                >
                  Request institutional onboarding
                </Link>
                . Coverage is allocated by mandate and capacity.
              </p>
            </form>
          </div>

          {/* Footnote coordinates */}
          <div className="mt-5 flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-black/35">
            <span className="flex items-center gap-4">
              <button
                onClick={() => setModal('terms')}
                className="transition-colors hover:text-black/70"
              >
                Terms
              </button>
              <span className="opacity-30">·</span>
              <button
                onClick={() => setModal('privacy')}
                className="transition-colors hover:text-black/70"
              >
                Privacy
              </button>
            </span>
            <span>Regis · Secure</span>
          </div>
        </motion.div>
      </div>
    </section>
    </>
  );
}

function Field({
  id, label, value, setValue, focus, setFocus, type, placeholder, trailing,
}: {
  id: string; label: string; value: string; setValue: (v: string) => void;
  focus: string | null; setFocus: (v: string | null) => void;
  type: string; placeholder: string; trailing?: ReactNode;
}) {
  const focused = focus === id;
  const active = focused || value.length > 0;
  return (
    <div className="relative pt-5">
      <label
        htmlFor={id}
        className={`mono pointer-events-none absolute left-0 text-[10px] uppercase tracking-[0.22em] transition-all duration-300 ${
          active ? 'top-0 text-black/40' : 'top-7 text-black/40'
        }`}
      >
        {label}
      </label>

      <div className="flex items-end gap-3">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocus(id)}
          onBlur={() => setFocus(null)}
          placeholder={active ? placeholder : ''}
          className="w-full bg-transparent py-2 text-[16px] text-[#0d0d0d] outline-none placeholder:text-black/25"
        />
        {trailing && <div className="shrink-0 pb-2.5">{trailing}</div>}
      </div>

      {/* Static rail + animated focus underline */}
      <div className="relative h-px w-full bg-black/15">
        <span
          className={`absolute inset-y-0 left-0 w-full origin-left bg-[#0d0d0d] transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            focused ? 'scale-x-100' : 'scale-x-0'
          }`}
        />
      </div>
    </div>
  );
}
