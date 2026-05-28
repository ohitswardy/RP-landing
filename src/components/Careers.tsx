import Reveal from './Reveal';
import { Link } from 'react-router-dom';

export default function Careers() {
  return (
    <section className="bg-navy text-paper">
      <div className="container-fluid py-20 md:py-28">
        <div className="grid grid-cols-12 gap-x-6 gap-y-8 items-end">
          <Reveal className="col-span-12 lg:col-span-7">
            <div className="eyebrow eyebrow-paper mb-7">Experience the Regis difference</div>
            <h2 className="text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.08] tracking-[-0.02em]">
              Careers at Regis Partners.
            </h2>
            <p className="mt-6 max-w-[52ch] text-paper/65 leading-relaxed text-[15px]">
              Our partners are our most valuable asset. Explore careers across
              research, sales, trading, corporate access, and operations, and
              build a craft that compounds.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="col-span-12 lg:col-span-5 lg:text-right">
            <Link to="/contact" className="btn-ghost">
              Explore careers <span>→</span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
