'use client';

import { motion } from 'framer-motion';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

// Content stays readable (opacity 0.6) even before it's revealed — never a
// hard hide. See components/motion/Reveal.js for why.
const item = {
  hidden: { opacity: 0.6 },
  show: { opacity: 1, transition: { duration: 0.4 } },
};

// Wraps a grid of cards; each direct child fades/rises in with a stagger as
// the group scrolls into view. Children don't need to know about this —
// just render them as normal inside.
export function RevealStagger({ children, className }) {
  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
    >
      {children}
    </motion.div>
  );
}

export function RevealStaggerItem({ children, className }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
