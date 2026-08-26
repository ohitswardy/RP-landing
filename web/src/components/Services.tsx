import FlowingMenu from './FlowingMenu';

const services = [
  { link: '/services/research',  text: 'Research Advisory',   images: ['/Services1.jpg', '/Service1.1.jpg', '/service1.2.jpg'] },
  { link: '/services/sales',     text: 'Sales Advisory',      images: ['/Services2.jpg', '/Service 2.1.jpg'] },
  { link: '/services/trading',   text: 'Trading & Execution', images: ['/Services3.jpg', '/Service 3.1.jpg', '/Service 3.2.jpg'] },
  { link: '/services/corporate', text: 'Corporate Access',    images: ['/Services4.jpg', '/Services 4.1.jpg', '/Service 4.2.jpg'] }
];

export default function Services() {
  return (
    <section style={{ height: '600px', position: 'relative' }}>
      <FlowingMenu
        items={services}
        speed={15}
        textColor="var(--color-navy)"
        bgColor="var(--color-paper)"
        marqueeBgColor="var(--color-amber)"
        marqueeTextColor="var(--color-navy-deep)"
        borderColor="var(--color-navy-line)"
      />
    </section>
  );
}
