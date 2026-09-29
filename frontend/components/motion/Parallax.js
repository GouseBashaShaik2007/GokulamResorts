'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

// Gentle scroll-linked parallax for a background/hero image layer. Wrap just
// the <img>, not surrounding text, so copy stays perfectly readable/static.
export default function Parallax({ children, className, range = 15 }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${range}%`]);

  return (
    <div ref={ref} className={`overflow-hidden ${className || ''}`}>
      <motion.div style={{ y }} className="h-full w-full">
        {children}
      </motion.div>
    </div>
  );
}
