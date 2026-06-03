import { useState } from 'react';
import { Link } from 'react-router-dom';
import LegalModal, { type ModalType } from './LegalModal';

const cols = [
  { h: 'Quick links', items: [['Our Services', '/services'], ['Our Insights', '/insights'], ['About', '/about'], ['Contact Us', '/contact']] },
  { h: 'Client Login',items: [['Research Portal', '/login'], ['Prime Brokerage', '/login'], ['Regis Access', '/login'], ['Wealth Management', '/login']] },
] as const;

export default function Footer() {
  const [modal, setModal] = useState<ModalType>(null);

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
            <div className="mt-7 flex items-center gap-3">
              {['in', 'X', 'YT'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="w-8 h-8 inline-flex items-center justify-center border rule-navy text-paper/65 hover:text-paper hover:border-paper/40 transition-colors text-[11px]"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.h} className="col-span-6 md:col-span-3">
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
        </div>

        <div className="h-px bg-[color:var(--color-navy-line)] mt-16 mb-6" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-[12px] text-paper/50">
          <div>© 1999–2026 Regis Partners, Inc. · SEC Reg. No. AS-099-XXXXX</div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <button onClick={() => setModal('terms')} className="hover:text-paper transition-colors cursor-pointer">Terms & Conditions</button>
            <button onClick={() => setModal('privacy')} className="hover:text-paper transition-colors cursor-pointer">Privacy & Cookies</button>
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
