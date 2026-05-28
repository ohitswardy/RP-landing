import Reveal from './Reveal';
import { Link } from 'react-router-dom';

export default function Culture() {
  return (
    <section className="bg-paper">
      <div className="container-fluid py-24 md:py-32">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10 items-stretch">
          {/* Photo — trading floor */}
          <Reveal className="col-span-12 lg:col-span-7">
            <div className="aspect-[4/3] lg:aspect-auto lg:h-full relative overflow-hidden">
              <img
                src="/StockWork.png"
                alt="Trading floor"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            </div>
          </Reveal>

          {/* Dark card with amber accent — like the reference */}
          <Reveal delay={0.12} className="col-span-12 lg:col-span-5">
            <div className="h-full bg-navy-deep text-paper p-10 md:p-14 flex flex-col justify-center">
              <div className="eyebrow eyebrow-paper mb-8">Culture & growth story</div>
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] tracking-[-0.02em] max-w-[22ch]">
                From Makati to the institution global allocators call first.
              </h2>
              <Link
                to="/about"
                className="mt-10 inline-flex items-center gap-3 self-start text-[color:var(--color-amber)] text-[13.5px] group"
              >
                <span>Get to know us better</span>
                <span className="block h-px w-10 bg-[color:var(--color-amber)] group-hover:w-16 transition-all duration-500" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
