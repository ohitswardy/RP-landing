import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import emailjs from '@emailjs/browser';
import Reveal from '../components/Reveal';
import Newsletter from '../components/Newsletter';

const EMAILJS_PUBLIC_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY      as string;
const EMAILJS_SERVICE_ID      = import.meta.env.VITE_EMAILJS_SERVICE_ID      as string;
const EMAILJS_ADMIN_TEMPLATE  = import.meta.env.VITE_EMAILJS_ADMIN_TEMPLATE_ID as string;
const EMAILJS_USER_TEMPLATE   = import.meta.env.VITE_EMAILJS_USER_TEMPLATE_ID  as string;

/* ─────────────────────────────────────────────────────────────
   Contact Hero — cinematic split-panel with sunray image
   Mirrors the AboutHero pattern: blueprint grid left, image
   right with parallax + multi-layer vignettes, mobile full-bleed.
───────────────────────────────────────────────────────────── */
const heroEase = [0.25, 1, 0.5, 1] as const;

function ContactHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const imgY     = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-5%']);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden text-paper flex items-center"
      style={{ minHeight: 'clamp(300px, 46vh, 460px)', backgroundColor: 'var(--color-navy)' }}
    >
      {/* ── Left panel: navy + blueprint grid ─────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 lg:right-[42%]"
        style={{
          backgroundColor: 'var(--color-navy)',
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 4%, transparent) 1px, transparent 1px),' +
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 3%, transparent) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />

      {/* ── Amber atmospheric glow — bottom-left ─────────────── */}
      <div
        aria-hidden
        className="absolute -left-60 -bottom-60 w-225 h-225 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.22) 0%, transparent 70%)' }}
      />

      {/* ── Amber whisper accent — upper-left ────────────────── */}
      <div
        aria-hidden
        className="absolute left-[6%] top-[18%] w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.055) 0%, transparent 70%)' }}
      />

      {/* ── RIGHT PANEL: sunray image — desktop only ─────────── */}
      <div
        aria-hidden
        className="hidden lg:block absolute right-0 top-0 bottom-0"
        style={{ width: '44%' }}
      >
        <div className="absolute inset-0 overflow-hidden">

          {/* Parallax image — oversized for travel headroom */}
          <motion.div
            className="absolute"
            style={{ top: '-8%', bottom: '-8%', left: 0, right: 0, y: imgY }}
          >
            <img
              src="/sunray.jpg"
              alt=""
              aria-hidden
              className="w-full h-full object-cover"
              style={{ objectPosition: '55% 28%' }}
            />
          </motion.div>

          {/* Sunburst echo — warm radial at image upper-right where sun sits */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              right: 0,
              top: 0,
              width: '65%',
              height: '55%',
              background: 'radial-gradient(ellipse at 82% 18%, oklch(0.80 0.16 78 / 0.24) 0%, transparent 52%)',
            }}
          />

          {/* Left-edge hard blend: navy → image (the panel seam) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to right,' +
                  'oklch(0.215 0.048 260 / 1.00)  0%,' +
                  'oklch(0.215 0.048 260 / 0.84) 10%,' +
                  'oklch(0.215 0.048 260 / 0.46) 26%,' +
                  'oklch(0.215 0.048 260 / 0.10) 46%,' +
                  'transparent 68%)',
            }}
          />

          {/* Right-edge fade to deep navy */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to left,' +
                  'oklch(0.165 0.040 260 / 0.72) 0%,' +
                  'oklch(0.165 0.040 260 / 0.22) 30%,' +
                  'transparent 58%)',
            }}
          />

          {/* Top vignette */}
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              height: '38%',
              background: 'linear-gradient(to bottom, oklch(0.215 0.048 260 / 0.84) 0%, transparent 100%)',
            }}
          />

          {/* Bottom vignette — blends to next section */}
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              height: '50%',
              background:
                'linear-gradient(to top,' +
                  'oklch(0.165 0.040 260 / 0.96) 0%,' +
                  'oklch(0.165 0.040 260 / 0.48) 50%,' +
                  'transparent 100%)',
            }}
          />

          {/* Navy tint for OKLCH colour-space harmony */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'oklch(0.215 0.048 260 / 0.14)', mixBlendMode: 'multiply' }}
          />
        </div>
      </div>

      {/* ── MOBILE: full-bleed image backdrop ────────────────── */}
      <div aria-hidden className="lg:hidden absolute inset-0">
        <img
          src="/sunray.jpg"
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: '62% 28%' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(155deg,' +
                'oklch(0.165 0.040 260 / 0.97)  0%,' +
                'oklch(0.165 0.040 260 / 0.92) 42%,' +
                'oklch(0.215 0.048 260 / 0.80) 72%,' +
                'oklch(0.215 0.048 260 / 0.68) 100%)',
          }}
        />
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="container-fluid relative w-full py-10">
        <motion.div style={{ y: contentY }}>

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: heroEase }}
            className="eyebrow eyebrow-paper mb-6"
          >
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: heroEase, delay: 0.05 }}
            className="text-[clamp(2.2rem,4.5vw,4rem)] leading-[1.04] tracking-[-0.026em] font-medium"
            style={{ maxWidth: '18ch' }}
          >
            Open a conversation.
          </motion.h1>

          {/* Amber gradient divider rule */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 1.0, ease: heroEase, delay: 0.38 }}
            aria-hidden
            className="origin-left mt-7"
            style={{
              height: '1px',
              width: 'min(260px, 100%)',
              background: 'linear-gradient(to right, var(--color-amber), transparent)',
            }}
          />

        </motion.div>
      </div>
    </section>
  );
}

type SubmitStatus = 'idle' | 'sending' | 'success' | 'error';

export default function Contact() {
  const [form, setForm] = useState({ name: '', firm: '', email: '', interest: 'Research', message: '' });
  const [status, setStatus] = useState<SubmitStatus>('idle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');

    // All fields sent to both templates — ensures no 422 from missing variables
    // regardless of which {{variable}} names you used in the EmailJS dashboard.
    const params = {
      // Admin template variables
      from_name:  form.name,
      from_firm:  form.firm || '—',
      from_email: form.email,
      interest:   form.interest,
      message:    form.message,
      // User confirmation template variables
      to_name:    form.name,
      to_email:   form.email,
      // Aliases — cover common EmailJS default variable names
      name:       form.name,
      email:      form.email,
      firm:       form.firm || '—',
      reply_to:   form.email,
    };

    try {
      // Fire both sends concurrently — admin notification + user confirmation
      await Promise.all([
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_ADMIN_TEMPLATE, params, EMAILJS_PUBLIC_KEY),
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_USER_TEMPLATE,  params, EMAILJS_PUBLIC_KEY),
      ]);
      setStatus('success');
    } catch (err) {
      console.error('[EmailJS] Send failed:', err);
      setStatus('error');
    }
  };

  return (
    <>
      <ContactHero />

      <section id="enquiry" className="bg-paper scroll-mt-16">
        <div className="container-fluid py-24 md:py-32">
          <div className="grid grid-cols-12 gap-x-6 gap-y-16">

            {/* ── Left: context panel ─────────────────────────────── */}
            <Reveal className="col-span-12 lg:col-span-4">
              <div className="eyebrow mb-8">Inquiry</div>
              <h2
                className="font-medium tracking-tight leading-[1.05] mb-6"
                style={{ fontSize: 'clamp(1.75rem, 2.8vw, 2.75rem)' }}
              >
                Let's start<br />a&nbsp;conversation.
              </h2>
              <p className="text-slate leading-relaxed text-[15px]" style={{ maxWidth: '36ch' }}>
                Reach our team directly. We respond to all institutional
                inquiries within one business day.
              </p>
              <div className="mt-10 pt-8 border-t rule">
                <div className="mono text-[11px] tracking-[0.18em] uppercase text-slate/70 mb-3">
                  Market-hours dealing
                </div>
                <p className="text-ink text-[14px]">
                  Trading Desk&ensp;&mdash;&ensp;
                  <span className="text-slate">+63&nbsp;2&nbsp;8848&nbsp;0000</span>
                </p>
              </div>
            </Reveal>

            {/* ── Right: form panel ───────────────────────────────── */}
            <Reveal className="col-span-12 lg:col-span-8 lg:pl-16 lg:border-l rule">
              {status === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                  className="py-8"
                >
                  <div
                    aria-hidden
                    style={{ width: 48, height: 1, background: 'var(--color-amber)', marginBottom: '2rem' }}
                  />
                  <h3
                    className="font-medium tracking-[-0.02em] mb-4"
                    style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)' }}
                  >
                    Thank you.
                  </h3>
                  <p className="text-slate leading-relaxed" style={{ maxWidth: '52ch' }}>
                    Your inquiry has been received. A confirmation has been sent
                    to <span className="text-ink">{form.email}</span>. A partner
                    will reach out within one business day. For urgent matters,
                    call the trading desk on +63&nbsp;2&nbsp;8848&nbsp;0000.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-10">
                  <Row>
                    <Input
                      label="Name"
                      value={form.name}
                      onChange={(v) => setForm({ ...form, name: v })}
                      required
                    />
                    <Input
                      label="Firm"
                      value={form.firm}
                      onChange={(v) => setForm({ ...form, firm: v })}
                    />
                  </Row>
                  <Input
                    label="Institutional email"
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    required
                  />

                  <div>
                    <div className="mono text-[11px] tracking-[0.18em] uppercase text-slate mb-4">
                      Area of interest
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['Research', 'Sales', 'Trading', 'Corporate Access', 'Other'] as const).map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setForm({ ...form, interest: o })}
                          className={`px-4 py-2 text-[13px] border outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            form.interest === o
                              ? 'bg-navy text-paper border-navy'
                              : 'bg-transparent text-ink border-ink/20 hover:border-ink/50 hover:bg-ink/3'
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    label="Message"
                    value={form.message}
                    onChange={(v) => setForm({ ...form, message: v })}
                  />

                  {/* Error feedback */}
                  {status === 'error' && (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="text-[13px] leading-relaxed"
                      style={{ color: 'oklch(0.55 0.18 25)' }}
                    >
                      Something went wrong — please try again or email us
                      directly at{' '}
                      <a
                        href="mailto:info@regis.ph"
                        className="underline underline-offset-2"
                      >
                        info@regis.ph
                      </a>
                      .
                    </motion.p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="btn-dark group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'sending' ? (
                      <>
                        <span
                          aria-hidden
                          className="inline-block w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin"
                        />
                        Sending…
                      </>
                    ) : (
                      <>
                        Send inquiry
                        <span
                          aria-hidden
                          className="transition-transform duration-200 group-hover:translate-x-0.5"
                        >
                          →
                        </span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </Reveal>

          </div>
        </div>
      </section>

      <section id="offices" className="bg-bone scroll-mt-16">
        <div className="container-fluid py-24 md:py-32">
          <Reveal className="max-w-3xl mb-12">
            <div className="eyebrow mb-6">Contact Us </div>
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-tight">
              Every channel. One dedicated team.
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l rule">

            {/* Address */}
            <Reveal className="border-r border-b rule p-10 md:p-12">
              <div className="eyebrow eyebrow-lg mb-5">Address</div>
              <address className="not-italic text-ink leading-[1.75] text-[17px]">
                Regis Partners, Inc.<br />
                23/F Tower One,<br />
                Ayala Triangle, Ayala Avenue<br />
                1226 Makati City, Philippines
              </address>
            </Reveal>

            {/* Contact */}
            <Reveal className="border-r border-b rule p-10 md:p-12">
              <div className="eyebrow eyebrow-lg mb-5">Contact</div>
              <dl className="mono text-[15px] text-ink space-y-2.5">
                <div className="flex gap-4">
                  <dt className="w-9 shrink-0 text-slate">TEL</dt>
                  <dd>+63 2 8894 6600</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-9 shrink-0 text-slate">FAX</dt>
                  <dd className="leading-[1.75]">
                    +63 2 8894 6605<br />
                    +63 2 8894 6622
                  </dd>
                </div>
              </dl>
            </Reveal>

            {/* Email */}
            <Reveal className="border-r border-b rule p-10 md:p-12">
              <div className="eyebrow eyebrow-lg mb-5">Email</div>
              <a
                href="mailto:info@regis.ph"
                className="mono text-[15px] text-ink hover:text-amber transition-colors duration-150 block"
              >
                info@regis.ph
              </a>
            </Reveal>

          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">{children}</div>;
}

function Input({
  label, value, onChange, type = 'text', required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;

  return (
    <div>
      <label
        className="mono text-[11px] tracking-[0.18em] uppercase block mb-3"
        style={{
          color: focused ? 'var(--color-amber)' : 'var(--color-slate)',
          transition: 'color 150ms cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full bg-transparent py-3 text-ink text-[16px] outline-none"
        style={{
          borderBottom: '1px solid',
          borderColor: focused
            ? 'var(--color-amber)'
            : filled
            ? 'var(--color-ink)'
            : 'color-mix(in oklab, var(--color-ink) 20%, transparent)',
          transition: 'border-color 200ms cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      />
    </div>
  );
}

function Textarea({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;

  return (
    <div>
      <label
        className="mono text-[11px] tracking-[0.18em] uppercase block mb-3"
        style={{
          color: focused ? 'var(--color-amber)' : 'var(--color-slate)',
          transition: 'color 150ms cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
        {label}
      </label>
      <textarea
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full bg-transparent py-3 text-ink text-[16px] outline-none resize-none"
        style={{
          borderBottom: '1px solid',
          borderColor: focused
            ? 'var(--color-amber)'
            : filled
            ? 'var(--color-ink)'
            : 'color-mix(in oklab, var(--color-ink) 20%, transparent)',
          transition: 'border-color 200ms cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      />
    </div>
  );
}
