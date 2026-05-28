import Reveal from './Reveal';
import { Link } from 'react-router-dom';

export default function Community() {
  return (
    <section className="bg-paper">
      <div className="container-fluid py-24 md:py-32">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10 items-center">
          <Reveal className="col-span-12 lg:col-span-5 lg:col-start-1 order-2 lg:order-1">
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] tracking-[-0.02em] max-w-[20ch] text-ink">
              Our people are our greatest contribution to the country.
            </h2>
            <p className="mt-7 max-w-[44ch] text-slate leading-relaxed text-[15px]">
              As a people-driven business, our greatest contribution flows
              through the teams and communities we serve across the
              Philippines, from Makati to Mindanao.
            </p>
            <Link to="/about" className="btn-dark mt-10">
              Explore our programs <span>→</span>
            </Link>
          </Reveal>

          <Reveal delay={0.1} className="col-span-12 lg:col-span-7 lg:col-start-6 order-1 lg:order-2">
            <div className="aspect-[4/3] relative overflow-hidden">
              <img
                src="/People of Regis.png"
                alt="People of Regis"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
