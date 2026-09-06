import Hero from '../components/Hero';
import Numbers from '../components/Numbers';
import Services from '../components/Services';
import Culture from '../components/Culture';
import Community from '../components/Community';
import LeadershipQuote from '../components/LeadershipQuote';
import Insights from '../components/Insights';
import Careers from '../components/Careers';
import { useHomeContent } from '../lib/homeContent';

/**
 * The landing page. Every section reads from one CMS document; a section
 * the desk has switched off is left out of the stack entirely.
 */
export default function Home() {
  const { copy, ready } = useHomeContent();

  // Hold the stack until the live document lands so the hero's reveal
  // plays once with the published words. The navy block keeps the fold
  // from flashing paper while the request is in flight.
  if (!ready) {
    return <section aria-hidden className="bg-navy min-h-[calc(100dvh-101px)]" />;
  }

  return (
    <>
      {copy.hero.enabled && <Hero copy={copy.hero} />}
      {copy.numbers.enabled && <Numbers copy={copy.numbers} />}
      {copy.services.enabled && <Services copy={copy.services} />}
      {copy.insights.enabled && <Insights copy={copy.insights} />}
      {copy.culture.enabled && <Culture copy={copy.culture} />}
      {copy.community.enabled && <Community copy={copy.community} />}
      {copy.quote.enabled && <LeadershipQuote copy={copy.quote} />}
      {copy.careers.enabled && <Careers copy={copy.careers} />}
    </>
  );
}
