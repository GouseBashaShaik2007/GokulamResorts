'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  addMonths,
  buildMonthGrid,
  fromISO,
  formatMonthLabel,
  formatShort,
  isBefore,
  isSameDay,
  startOfMonth,
  toISO,
  WEEKDAY_LABELS,
} from '../../lib/dateRange';

function Month({ monthStart, checkInDate, checkOutDate, hoverDate, minDate, onPick, onHover }) {
  const cells = useMemo(() => buildMonthGrid(monthStart), [monthStart]);

  const rangeEnd = checkOutDate || (checkInDate && hoverDate && isBefore(checkInDate, hoverDate) ? hoverDate : null);

  return (
    <div className="w-full">
      <p className="mb-3 text-center font-serif text-sm font-semibold text-navy-50">{formatMonthLabel(monthStart)}</p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[0.65rem] uppercase text-navy-500">
        {WEEKDAY_LABELS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map(({ date, inMonth }, i) => {
          const disabled = isBefore(date, minDate) && !isSameDay(date, minDate);
          const isStart = checkInDate && isSameDay(date, checkInDate);
          const isEnd = checkOutDate && isSameDay(date, checkOutDate);
          const inRange =
            checkInDate && rangeEnd && isBefore(checkInDate, date) && isBefore(date, rangeEnd) && !isStart && !isEnd;

          return (
            <button
              key={i}
              type="button"
              disabled={disabled || !inMonth}
              onClick={() => onPick(date)}
              onMouseEnter={() => onHover(date)}
              className={`relative flex h-9 items-center justify-center text-sm transition-colors ${
                !inMonth ? 'invisible' : ''
              } ${disabled ? 'cursor-not-allowed text-navy-700' : 'text-navy-100 hover:bg-navy-800'} ${
                isStart || isEnd ? 'z-10 rounded-full bg-gold-500 font-semibold text-navy-950 hover:bg-gold-500' : ''
              } ${inRange ? 'bg-gold-500/15' : ''}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A single connected calendar for picking check-in AND check-out in one flow
 * — click a start date, hover to preview the range, click the end date and
 * the popover closes with both set. Replaces two separate native date
 * inputs. `checkIn`/`checkOut` and `onChange` use YYYY-MM-DD strings, same
 * as the rest of the booking flow.
 */
export default function DateRangePicker({ checkIn, checkOut, onChange, minDateISO, dropDirection = 'down', className }) {
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState(null);
  const containerRef = useRef(null);

  const minDate = fromISO(minDateISO) || new Date(new Date().setHours(0, 0, 0, 0));
  const checkInDate = fromISO(checkIn);
  const checkOutDate = fromISO(checkOut);

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(checkInDate || minDate));

  useEffect(() => {
    if (open) setViewMonth(startOfMonth(checkInDate || minDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePick = (date) => {
    if (!checkInDate || checkOutDate || !isBefore(checkInDate, date)) {
      // Starting a fresh selection.
      onChange({ checkIn: toISO(date), checkOut: '' });
      setHoverDate(null);
      return;
    }
    // Completing the range.
    onChange({ checkIn: toISO(checkInDate), checkOut: toISO(date) });
    setOpen(false);
    setHoverDate(null);
  };

  const nights =
    checkInDate && checkOutDate ? Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000) : null;

  const label = checkInDate
    ? `${formatShort(checkInDate)}${checkOutDate ? ` → ${formatShort(checkOutDate)}` : ' → Select check-out'}`
    : 'Select dates';

  const secondMonth = addMonths(viewMonth, 1);

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-transparent text-left text-sm text-navy-50"
      >
        <span aria-hidden>📅</span>
        <span className={checkInDate ? 'text-navy-50' : 'text-navy-400'}>{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: dropDirection === 'up' ? 8 : -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropDirection === 'up' ? 8 : -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={`glass absolute z-50 w-[19rem] rounded-2xl p-4 shadow-2xl sm:w-[38rem] ${
              dropDirection === 'up' ? 'bottom-full left-0 mb-3' : 'top-full left-0 mt-3'
            }`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-navy-300 hover:bg-navy-800 hover:text-gold-400"
                aria-label="Previous month"
              >
                ‹
              </button>
              <p className="eyebrow text-[0.65rem]">{nights ? `${nights} night${nights > 1 ? 's' : ''}` : 'Pick your dates'}</p>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-navy-300 hover:bg-navy-800 hover:text-gold-400"
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Month
                monthStart={viewMonth}
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                hoverDate={hoverDate}
                minDate={minDate}
                onPick={handlePick}
                onHover={setHoverDate}
              />
              <div className="hidden sm:block">
                <Month
                  monthStart={secondMonth}
                  checkInDate={checkInDate}
                  checkOutDate={checkOutDate}
                  hoverDate={hoverDate}
                  minDate={minDate}
                  onPick={handlePick}
                  onHover={setHoverDate}
                />
              </div>
            </div>

            {checkInDate && (
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                <p className="text-xs text-navy-400">
                  {checkOutDate ? `${formatShort(checkInDate)} → ${formatShort(checkOutDate)}` : 'Now pick your check-out date'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ checkIn: '', checkOut: '' });
                    setHoverDate(null);
                  }}
                  className="text-xs text-gold-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
