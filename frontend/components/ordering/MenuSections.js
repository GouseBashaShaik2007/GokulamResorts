'use client';

import { useEffect, useRef, useState } from 'react';
import MenuItemCard from '../MenuItemCard';

/**
 * The menu itself: category tabs that stay under the navbar, then one section
 * of dish cards per category. The tab for the section on screen is
 * highlighted, and a tab jumps to its section. `sections`: categories, each
 * with the `items` to show.
 */
export default function MenuSections({ sections, quantityOf, onOpen }) {
  const [active, setActive] = useState(sections[0]?.id);
  const sectionRefs = useRef({});
  const tabsRef = useRef(null);

  // Highlight the tab for the section currently under the sticky bars.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(Number(visible[0].target.dataset.cat));
      },
      { rootMargin: '-140px 0px -60% 0px' }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active tab scrolled into view on narrow screens.
  useEffect(() => {
    tabsRef.current?.querySelector(`[data-tab="${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  const jumpTo = (id) => {
    const el = sectionRefs.current[id];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior: 'smooth' });
  };

  return (
    <>
      <div className="sticky top-[var(--nav-h)] z-30 -mx-4 border-b border-sand-300 bg-sand-50/95 px-4 backdrop-blur sm:mx-0">
        <div ref={tabsRef} className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]" role="navigation" aria-label="Menu categories">
          {sections.map((c) => (
            <button
              key={c.id}
              type="button"
              data-tab={c.id}
              aria-current={active === c.id ? 'true' : undefined}
              onClick={() => jumpTo(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${active === c.id ? 'bg-ocean-500 text-white' : 'bg-sand-200 text-ink-700 hover:bg-sand-300'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {sections.map((c) => (
        <section key={c.id} data-cat={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }} className="pt-10">
          <h2 className="mb-5 font-serif text-3xl font-semibold text-ink-900">{c.name}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {c.items.map((item) => (
              <MenuItemCard key={item.id} item={item} inCart={quantityOf(item.id)} onOpen={() => onOpen(item)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
