import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PersonCard, { type Person } from './PersonCard';

export type { Person };

export interface TeamTab {
  id: string;
  label: string;
  people: Person[];
}

interface TeamTabsProps {
  tabs: TeamTab[];
}

export default function TeamTabs({ tabs }: TeamTabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const uid = useId();

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    let next = idx;
    if (e.key === 'ArrowRight')      next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft')  next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home')       next = 0;
    else if (e.key === 'End')        next = tabs.length - 1;
    else return;
    e.preventDefault();
    setActiveId(tabs[next].id);
  }

  return (
    <div>
      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label="Team departments"
        className="tabs-scroll flex overflow-x-auto border-b rule mb-14 gap-0.5"
      >
        {tabs.map((tab, idx) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${uid}-${tab.id}`}
            aria-selected={activeId === tab.id}
            aria-controls={`panel-${uid}-${tab.id}`}
            tabIndex={activeId === tab.id ? 0 : -1}
            onClick={() => setActiveId(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`relative whitespace-nowrap py-3.5 px-5 text-[13px] tracking-[0.01em]
              transition-colors duration-200
              outline-none focus-visible:ring-2 focus-visible:ring-amber rounded-t-sm
              ${activeId === tab.id ? 'text-ink' : 'text-graphite hover:text-slate'}`}
          >
            {tab.label}
            {activeId === tab.id && (
              <motion.span
                layoutId={`underline-${uid}`}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber"
                transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeId}
          role="tabpanel"
          id={`panel-${uid}-${activeId}`}
          aria-labelledby={`tab-${uid}-${activeId}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14"
        >
          {activeTab.people.map((person, i) => (
            <PersonCard
              key={`${activeId}-${person.n}`}
              person={person}
              index={i}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
