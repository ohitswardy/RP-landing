import { useState } from 'react';
import { motion } from 'framer-motion';
import Reveal from './Reveal';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <section className="bg-white text-navy-deep border-t border-gray-200">
      <div className="container-fluid py-20 md:py-28 text-center">
        <Reveal>
          <h2 className="text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.08] tracking-[-0.02em]">
            Stay current with updates.
          </h2>
          <p className="mt-5 max-w-[48ch] mx-auto text-navy-deep/60 text-[15px] leading-relaxed">
            Subscribe to receive selected research, market commentary, and
            event invitations from the Regis desk.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          {sent ? (
            <div className="mt-10 inline-flex items-center gap-3 mono text-[12px] tracking-[0.16em] uppercase text-[color:var(--color-amber)]">
              <span className="inline-block w-2 h-2" style={{ background: 'var(--color-amber)' }} />
              Subscribed. Welcome aboard.
            </div>
          ) : (
            <motion.form
              onSubmit={(e) => { e.preventDefault(); if (email) setSent(true); }}
              className="mt-10 max-w-md mx-auto flex border border-gray-300 bg-white"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="flex-1 bg-transparent px-5 py-4 text-navy-deep text-[14px] outline-none placeholder:text-navy-deep/35"
              />
              <button
                type="submit"
                className="px-6 text-navy-deep text-[13.5px] tracking-[-0.005em] transition-colors"
                style={{ background: 'var(--color-amber)' }}
              >
                Sign up
              </button>
            </motion.form>
          )}
          <p className="mt-5 text-navy-deep/40 text-[12px]">For institutional and qualified investors only. Unsubscribe anytime.</p>
        </Reveal>
      </div>
    </section>
  );
}
