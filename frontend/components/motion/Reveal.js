'use client';

import { motion } from 'framer-motion';

/**
 * A quick brighten as content scrolls into view — never a hard hide. Content
 * is always at least 60% visible/readable immediately (present at meaningful
 * opacity, not opacity:0), so above-the-fold sections never show a blank
 * flash on load and don't get treated as empty by crawlers/perf audits.
 */
export default function Reveal({ children, delay = 0, className, as = 'div' }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0.6 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay }}
    >
      {children}
    </MotionTag>
  );
}
