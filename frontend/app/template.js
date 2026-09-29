'use client';

import { motion } from 'framer-motion';

// Next remounts template.js on every navigation, so this gives every route a
// soft fade-in with zero per-page wiring. Fade-in only, no exit animation —
// AnimatePresence exit transitions aren't reliable with the App Router yet.
export default function Template({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
