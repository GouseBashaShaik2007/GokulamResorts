'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

// The address an earlier version of this page gave each answer ("What if I
// need to cancel?" -> #what-if-i-need-to-cancel). Still honoured.
const oldAnchor = (question) => question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The answer, with its link (if any) in place of the matching words.
function Answer({ item }) {
  const at = item.link ? item.a.indexOf(item.link.text) : -1;
  if (at === -1) return item.a;
  return (
    <>
      {item.a.slice(0, at)}
      <Link href={item.link.href} className="text-ocean-600 underline">{item.link.text}</Link>
      {item.a.slice(at + item.link.text.length)}
    </>
  );
}

/**
 * The FAQ's questions, grouped. Adds what a static list can't do: search, and
 * opening the answer named in the address (/faq#cancellation) so staff can
 * send a guest straight to it. `sections`: from lib/faqs.js.
 */
export default function FaqList({ sections }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState({}); // slug -> true

  // Open (and scroll to) the answer named after the #, now and when it changes.
  useEffect(() => {
    const items = sections.flatMap((s) => s.items);
    const openFromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const item = items.find((f) => f.slug === hash || oldAnchor(f.q) === hash);
      if (!item) return;
      setSearch('');
      setOpen((o) => ({ ...o, [item.slug]: true }));
      requestAnimationFrame(() => document.getElementById(item.slug)?.scrollIntoView({ block: 'start' }));
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [sections]);

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    if (!words) return sections;
    return sections
      .map((s) => ({ ...s, items: s.items.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(words)) }))
      .filter((s) => s.items.length > 0);
  }, [sections, search]);
  const count = shown.reduce((n, s) => n + s.items.length, 0);

  return (
    <>
      <label className="mt-8 block">
        <span className="sr-only">Search the questions</span>
        <input type="search" className="input-field" placeholder="Search — try “refund”, “GST” or “ID”" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <p className="sr-only" role="status">{search.trim() ? `${count} question${count === 1 ? '' : 's'} found` : ''}</p>

      {shown.length === 0 && (
        <p className="mt-8 text-navy-300">
          Nothing matches “{search}”.{' '}
          <button type="button" onClick={() => setSearch('')} className="font-semibold text-ocean-600 underline">Show every question</button>
        </p>
      )}

      {shown.map((section) => (
        <section key={section.group} className="mt-12">
          <h2 className="font-serif text-2xl font-semibold text-navy-50">{section.group}</h2>
          <div className="mt-4 divide-y divide-navy-700 border-y border-navy-700">
            {section.items.map((f) => (
              <details
                key={f.slug}
                id={f.slug}
                open={!!open[f.slug]}
                onToggle={(e) => { const isOpen = e.currentTarget.open; setOpen((o) => (!!o[f.slug] === isOpen ? o : { ...o, [f.slug]: isOpen })); }}
                className="group scroll-mt-24 px-3 py-4 open:bg-navy-900"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded font-medium text-navy-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 group-open:font-semibold">
                  {f.q}
                  <span className="text-xl text-ocean-500 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-navy-300"><Answer item={f} /></p>
                <a href={`#${f.slug}`} className="mt-2 inline-block text-xs text-navy-400 underline underline-offset-2 hover:text-ocean-600">Link to this answer</a>
              </details>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
