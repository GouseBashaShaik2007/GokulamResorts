'use client';

import { MotionConfig } from 'framer-motion';

// Central place to mount app-wide motion config. `reducedMotion="user"` makes
// every animation in the app respect the OS-level "reduce motion" setting
// automatically, without each component checking it individually.
export default function Providers({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
