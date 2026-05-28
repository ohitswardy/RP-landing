import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import Newsletter from '../components/Newsletter';

const offices = [
  { city: 'Makati (HQ)', addr: '26F PBCom Tower, 6795 Ayala Avenue, Makati City 1200', tel: '+63 2 8848 0000', email: 'contact@regis.ph' },
  { city: 'Singapore',   addr: 'One Raffles Quay, Level 25, North Tower, Singapore 048583', tel: '+65 6230 0000', email: 'sg@regis.ph' },
  { city: 'Hong Kong',   addr: 'IFC Two, Level 56, Central, Hong Kong',                tel: '+852 2200 0000',   email: 'hk@regis.ph' },
];

const desks = [
  ['Institutional Sales',   'sales@regis.ph'],
  ['Research Desk',         'research@regis.ph'],
  ['Trading Desk',          'trading@regis.ph'],
  ['Corporate Access',      'access@regis.ph'],
  ['Compliance & KYC',      'compliance@regis.ph'],
  ['Media & Press',         'press@regis.ph'],
] as const;

export default function Contact() {
  const [form, setForm] = useState({ name: '', firm: '', email: '', interest: 'Research', message: '' });
  const [sent, setSent] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Engagement"
        title="Open a conversation."
        dek="We respond to qualified institutional inquiries within one business day. For market-hours dealing, contact the trading desk directly."
      />

      <section className="bg-paper">
        <div className="container-fluid py-24 md:py-32">
          <div className="grid grid-cols-12 gap-x-6 gap-y-16">
            <Reveal className="col-span-12 lg:col-span-7 lg:pr-12 lg:border-r rule">
              <div className="eyebrow mb-8">Inquiry</div>
              {sent ? (
                <div className="border rule p-10">
                  <h3 className="text-2xl tracking-[-0.015em] font-medium">Thank you.</h3>
                  <p className="mt-4 text-slate max-w-[50ch] leading-relaxed">
                    Your inquiry has been received. A partner will reach out
                    within one business day. For market-hours dealing, call
                    the trading desk on +63 2 8848 0000.
                  </p>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-10">
                  <Row>
                    <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                    <Input label="Firm" value={form.firm} onChange={(v) => setForm({ ...form, firm: v })} />
                  </Row>
                  <Input label="Institutional email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />

                  <div>
                    <div className="mono text-[11px] tracking-[0.18em] uppercase text-slate mb-3">Area of interest</div>
                    <div className="flex flex-wrap gap-2">
                      {['Research', 'Sales', 'Trading', 'Corporate Access', 'Other'].map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setForm({ ...form, interest: o })}
                          className={`px-4 py-2 text-[13px] border rule transition-colors ${form.interest === o ? 'bg-navy text-paper border-navy' : 'bg-paper hover:bg-bone'}`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mono text-[11px] tracking-[0.18em] uppercase text-slate mb-3">Message</div>
                    <textarea
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full bg-transparent border-b rule py-3 text-ink text-[16px] outline-none focus:border-ink resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-navy text-paper px-6 py-4 text-[14px] tracking-[-0.005em] hover:bg-[color:var(--color-amber-deep)] transition-colors inline-flex items-center gap-3"
                  >
                    Send inquiry <span>→</span>
                  </button>
                </form>
              )}
            </Reveal>

            <div className="col-span-12 lg:col-span-5">
              <div className="eyebrow mb-8">Direct desks</div>
              <ul className="border-t rule">
                {desks.map(([k, v]) => (
                  <li key={k} className="border-b rule py-4 flex items-baseline justify-between gap-4">
                    <span className="text-lg tracking-[-0.012em] font-medium">{k}</span>
                    <a href={`mailto:${v}`} className="mono text-[13px] text-slate hover:text-ink">{v}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-bone">
        <div className="container-fluid py-24 md:py-32">
          <Reveal className="max-w-3xl mb-12">
            <div className="eyebrow mb-6">Offices</div>
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-[-0.025em]">
              Three desks, one coverage memory.
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l rule">
            {offices.map((o) => (
              <Reveal key={o.city} className="border-r border-b rule p-8 md:p-10">
                <div className="eyebrow mb-4">{o.city}</div>
                <p className="text-ink leading-relaxed">{o.addr}</p>
                <div className="h-px bg-ink/10 my-6" />
                <div className="mono text-[13px] text-slate">{o.tel}</div>
                <a href={`mailto:${o.email}`} className="mono text-[13px] text-slate hover:text-ink block mt-1">{o.email}</a>
              </Reveal>
            ))}
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

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <div className="mono text-[11px] tracking-[0.18em] uppercase text-slate mb-3">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b rule py-3 text-ink text-[16px] outline-none focus:border-ink"
      />
    </div>
  );
}
