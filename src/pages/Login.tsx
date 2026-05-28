import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [focus, setFocus] = useState<string | null>(null);

  return (
    <section className="relative min-h-[calc(100vh-6.25rem)] bg-blueprint text-paper overflow-hidden">
      <div
        aria-hidden
        className="absolute -right-40 -top-40 w-[700px] h-[700px] rounded-full pointer-events-none opacity-[0.18]"
        style={{ background: 'radial-gradient(closest-side, var(--color-amber) 0%, transparent 70%)' }}
      />
      <div className="container-fluid relative grid grid-cols-12 gap-x-6 py-20 md:py-28">
        <div className="col-span-12 lg:col-span-6 lg:pr-12 lg:border-r rule-navy flex flex-col justify-between min-h-[60vh]">
          <div>
            <div className="eyebrow eyebrow-paper">Client portal · Secure</div>
            <h1 className="mt-10 text-[clamp(2.25rem,5vw,4rem)] leading-[1.05] tracking-[-0.028em] font-medium max-w-[16ch]">
              The research desk, on call.
            </h1>
            <p className="mt-8 max-w-[44ch] text-paper/65 leading-relaxed text-[15.5px]">
              Sign in for the live morning call, model archive, conviction
              list, conference replays, and your dedicated coverage partner's
              calendar.
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="h-px bg-[color:var(--color-navy-line)] my-10" />
            <div className="grid grid-cols-3 gap-6">
              {[['SOC 2', 'Type II'], ['TLS 1.3', 'In transit'], ['MFA', 'Required']].map(([k, v]) => (
                <div key={k}>
                  <div className="num text-2xl font-medium tracking-[-0.02em]">{k}</div>
                  <div className="mono mt-1 text-[11px] tracking-[0.16em] uppercase text-paper/55">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 lg:col-start-8 mt-16 lg:mt-0">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-10">
            <Field id="email" label="Institutional email" value={email} setValue={setEmail} focus={focus} setFocus={setFocus} type="email" placeholder="you@firm.com" />
            <Field id="pwd"   label="Passphrase"          value={pwd}   setValue={setPwd}   focus={focus} setFocus={setFocus} type="password" placeholder="••••••••••••" />

            <div className="flex items-center justify-between text-[13px] text-paper/65">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="w-3.5 h-3.5 inline-block border border-paper/30" />
                Remember this device for 30 days
              </label>
              <a href="#" className="underline-offset-4 hover:underline">Reset passphrase</a>
            </div>

            <motion.button
              whileHover={{ y: -1 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              type="submit"
              className="w-full py-4 text-[14px] tracking-[-0.005em] transition-colors text-navy-deep"
              style={{ background: 'var(--color-amber)' }}
            >
              Sign in to the research portal →
            </motion.button>

            <div className="h-px bg-[color:var(--color-navy-line)]" />
            <p className="text-[13px] text-paper/55 leading-relaxed">
              Not yet a Regis client?{' '}
              <Link to="/contact" className="text-paper underline-offset-4 hover:underline">
                Request institutional onboarding
              </Link>
              . Coverage is allocated by mandate and capacity.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({
  id, label, value, setValue, focus, setFocus, type, placeholder,
}: {
  id: string; label: string; value: string; setValue: (v: string) => void;
  focus: string | null; setFocus: (v: string | null) => void; type: string; placeholder: string;
}) {
  const active = focus === id || value.length > 0;
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={`mono text-[11px] tracking-[0.18em] uppercase absolute left-0 transition-all duration-300 ${active ? '-top-3' : 'top-3'}`}
        style={{ color: active ? 'var(--color-amber)' : 'color-mix(in oklab, var(--color-paper) 55%, transparent)' }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocus(id)}
        onBlur={() => setFocus(null)}
        placeholder={active ? placeholder : ''}
        className="w-full bg-transparent border-b border-paper/25 py-3 pt-5 text-paper text-[16px] outline-none focus:border-[color:var(--color-amber)] transition-colors placeholder:text-paper/30"
      />
    </div>
  );
}
