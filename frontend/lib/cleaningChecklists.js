'use client';

import { useCallback, useEffect, useState } from 'react';

// What "done" means for each housekeeping task: the list a cleaner ticks off
// before the room can go to the inspector.
//
// TODO(owner): these are a starting point — edit them to match how the resort
// actually turns a room over (add counts, e.g. "4 towels", if you have them).
export const TASK_CHECKLIST = {
  Bedding: ['Fresh bed sheets', 'Fresh pillow covers', 'Blanket changed', 'Bed made'],
  Toiletry: ['Fresh towels', 'Soap and shampoo', 'Toilet paper', 'Drinking water bottles'],
};

const storageKey = (taskId) => `gokulam_task_checklist_${taskId}`;

/**
 * Ticks for one task's checklist, kept on this device so a pause, a reload or
 * a dropped connection doesn't lose them. Returns [ticked, toggle, clear].
 */
export function useChecklist(taskId) {
  const [ticked, setTicked] = useState([]);

  useEffect(() => {
    try {
      setTicked(JSON.parse(window.localStorage.getItem(storageKey(taskId)) || '[]'));
    } catch {
      setTicked([]);
    }
  }, [taskId]);

  const save = useCallback(
    (next) => {
      setTicked(next);
      try {
        if (next.length) window.localStorage.setItem(storageKey(taskId), JSON.stringify(next));
        else window.localStorage.removeItem(storageKey(taskId));
      } catch {
        // storage unavailable — the ticks still work until the page reloads
      }
    },
    [taskId]
  );

  const toggle = (item) => save(ticked.includes(item) ? ticked.filter((i) => i !== item) : [...ticked, item]);
  const clear = () => save([]);

  return [ticked, toggle, clear];
}
