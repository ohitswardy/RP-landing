import ScrollExpand from '../components/ScrollExpand';
import RegisLockup3D from '../components/RegisLockup3D';
import Services from '../components/Services';
import PhotoWheel from '../components/PhotoWheel';
import LeadershipQuote from '../components/LeadershipQuote';
import StrokeText from '../components/StrokeText';
import Careers from '../components/Careers';
import Newsletter from '../components/Newsletter';

export default function Home() {
  return (
    <>
      <ScrollExpand
        src="/HeroSection.png"
        alt="Product hero"
        title="The Philippines' pure-play institutional brokerage and research firm."
        scrollHint="Scroll inside the frame"
        startWidth={42}
        startHeight={58}
        startRadius={24}
        endRadius={0}
        mediaZoom={1.35}
        scrollDistance={1.2}
        holdDistance={0.35}
        smoothing={0.1}
        overlayScrim={0.45}
        useWindowScroll
        enabled
      >
        <RegisLockup3D
          className="w-[min(200px,10vw)]"
          style={{ aspectRatio: '2.6 / 1' }}
        />
      </ScrollExpand>
      <PhotoWheel />
      <LeadershipQuote />
      <section className="bg-navy-deep">
        <div className="container-fluid py-24 md:py-36">
          <StrokeText
            text="Be a Partner Now"
            strokeColor="#F8FAFC"
            fillColor="#F8FAFC"
            strokeWidth={1.4}
            drawDuration={1.6}
            fillDelay={0.2}
            stagger={0.05}
            ease="power2.out"
            trigger="scroll"
            fillMode="wipe"
            fontSize={128}
            fontWeight={800}
            letterSpacing={-4}
            reverse={false}
          />
        </div>
      </section>
      <Careers />
      <Newsletter />
    </>
  );
}
