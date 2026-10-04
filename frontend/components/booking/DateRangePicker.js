'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  addDaysToDate,
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

function Month({ monthStart, checkInDate, checkOutDate, hoverDate, minDate, tabStopISO, closedReason, onPick, onHover }) {
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
          const closed = closedReason(date); // 'past', 'full' or null
          const past = closed === 'past';
          const full = closed === 'full';
          const disabled = !!closed;
          const isStart = checkInDate && isSameDay(date, checkInDate);
          const isEnd = checkOutDate && isSameDay(date, checkOutDate);
          const inRange =
            checkInDate && rangeEnd && isBefore(checkInDate, date) && isBefore(date, rangeEnd) && !isStart && !isEnd;

          return (
            <button
              key={toISO(date)}
              type="button"
              // Days outside the month are padding: no data-date, so arrow keys never land on them.
              data-date={inMonth ? toISO(date) : undefined}
              // One tab stop for the whole grid; arrow keys move between days.
              tabIndex={inMonth && toISO(date) === tabStopISO ? 0 : -1}
              aria-label={`${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${isStart ? ', check-in' : isEnd ? ', check-out' : ''}${full && !past ? ', fully booked' : ''}`}
              title={full && !past ? 'Fully booked' : undefined}
              aria-pressed={!!(isStart || isEnd)}
              disabled={disabled || !inMonth}
              onClick={() => onPick(date)}
              onMouseEnter={() => onHover(date)}
              onFocus={() => onHover(date)}
              className={`relative flex h-9 items-center justify-center text-sm transition-colors ${
                !inMonth ? 'invisible' : ''
              } ${disabled ? `cursor-not-allowed text-navy-700 ${full && !past ? 'line-through' : ''}` : 'text-navy-100 hover:bg-navy-800'} ${
                isStart || isEnd ? 'z-10 rounded-full bg-ocean-500 font-semibold text-white hover:bg-ocean-500' : ''
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
 * `fullNights`: nights (YYYY-MM-DD) that are already fully booked — struck
 * through, and a stay can neither start on one nor run across one.
 * `align`: which edge of the trigger the calendar lines up with — 'right'
 * where the picker sits near the right edge of the page.
 */
export default function DateRangePicker({ checkIn, checkOut, onChange, minDateISO, dropDirection = 'down', className, fullNights, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState(null);
  const containerRef = useRef(null);

  const minDate = fromISO(minDateISO) || new Date(new Date().setHours(0, 0, 0, 0));
  const checkInDate = fromISO(checkIn);
  const checkOutDate = fromISO(checkOut);

  const fullSet = useMemo(() => new Set(fullNights || []), [fullNights]);
  const isFull = (date) => fullSet.has(toISO(date));
  // With a check-in chosen: the latest day the guest can leave — the first full night after it.
  const lastCheckOut = useMemo(() => {
    if (!checkIn || fullSet.size === 0) return null;
    const next = [...fullSet].filter((night) => night > checkIn).sort()[0];
    return next ? fromISO(next) : null;
  }, [checkIn, fullSet]);

  // Why a day can't be picked right now, or null when it can.
  const closedReason = (date) => {
    if (isBefore(date, minDate) && !isSameDay(date, minDate)) return 'past';
    // While choosing a check-out: nothing past the first full night after check-in
    // (leaving ON that day is fine). Otherwise: a full night can't be a check-in.
    const choosingEnd = checkInDate && !checkOutDate && isBefore(checkInDate, date);
    const full = choosingEnd ? !!lastCheckOut && isBefore(lastCheckOut, date) : isFull(date);
    return full ? 'full' : null;
  };

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(checkInDate || minDate));
  // The day the keyboard is on (YYYY-MM-DD); also the grid's single tab stop.
  const [cursorISO, setCursorISO] = useState(null);
  const pendingFocus = useRef(false);
  const gridRef = useRef(null);
  // A phone shows one month, wider screens two (the second is hidden below 640px).
  const [monthsShown, setMonthsShown] = useState(2);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 640px)');
    const update = () => setMonthsShown(wide.matches ? 2 : 1);
    update();
    wide.addEventListener('change', update);
    return () => wide.removeEventListener('change', update);
  }, []);

  // The first day a guest could pick in the months on screen, for when the
  // cursor is elsewhere (or sits on a day that is closed and can't take focus).
  const firstPickable = (() => {
    let date = isBefore(viewMonth, minDate) ? minDate : viewMonth;
    for (let hops = 0; closedReason(date) && hops < 62; hops += 1) date = addDaysToDate(date, 1);
    return date;
  })();
  const cursorVisible =
    cursorISO && !isBefore(fromISO(cursorISO), viewMonth) && isBefore(fromISO(cursorISO), addMonths(viewMonth, monthsShown));
  const tabStopISO = cursorVisible && !closedReason(fromISO(cursorISO)) ? cursorISO : toISO(firstPickable);

  useEffect(() => {
    if (!open) return;
    const start = checkInDate || minDate;
    setViewMonth(startOfMonth(start));
    setCursorISO(toISO(start));
    pendingFocus.current = true; // land in the grid, on the check-in date or today
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // After the cursor moves (or the popover opens), put focus on that day.
  useEffect(() => {
    if (!open || !pendingFocus.current) return;
    pendingFocus.current = false;
    gridRef.current?.querySelector(`[data-date="${tabStopISO}"]`)?.focus();
  });

  const moveCursor = (days) => {
    const from = fromISO(document.activeElement?.dataset?.date || tabStopISO);
    let to = addDaysToDate(from, days);
    // A closed day can't take focus, so keep going the same way to the next open one.
    for (let hops = 0; closedReason(to) === 'full' && hops < 62; hops += 1) to = addDaysToDate(to, Math.sign(days));
    if (closedReason(to)) return;
    // Keep the day on screen.
    if (isBefore(to, viewMonth)) setViewMonth(startOfMonth(to));
    else if (!isBefore(to, addMonths(viewMonth, monthsShown))) setViewMonth(addMonths(startOfMonth(to), 1 - monthsShown));
    setCursorISO(toISO(to));
    pendingFocus.current = true;
  };

  const onGridKeyDown = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step || !e.target.dataset?.date) return;
    e.preventDefault();
    moveCursor(step);
  };

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
    <div ref={containerRef} data-popover-open={open} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
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
            // Solid, not frosted: over a page of text a see-through calendar is hard to read.
            className={`absolute z-50 w-[19rem] rounded-2xl border border-navy-700 bg-navy-950 p-4 shadow-2xl sm:w-[38rem] ${
              dropDirection === 'up' ? 'bottom-full mb-3' : 'top-full mt-3'
            } ${align === 'right' ? 'left-0 lg:left-auto lg:right-0' : 'left-0'}`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-navy-300 hover:bg-navy-800 hover:text-gold-600"
                aria-label="Previous month"
              >
                ‹
              </button>
              <p className="eyebrow text-[0.65rem]">{nights ? `${nights} night${nights > 1 ? 's' : ''}` : 'Pick your dates'}</p>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-navy-300 hover:bg-navy-800 hover:text-gold-600"
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            {/* Arrow keys move between the day buttons inside. */}
            <div ref={gridRef} role="group" aria-label="Calendar" onKeyDown={onGridKeyDown} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Month
                monthStart={viewMonth}
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                hoverDate={hoverDate}
                minDate={minDate}
                tabStopISO={tabStopISO}
                closedReason={closedReason}
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
                  tabStopISO={tabStopISO}
                  closedReason={closedReason}
                  onPick={handlePick}
                  onHover={setHoverDate}
                />
              </div>
            </div>
            <p className="sr-only">Use the arrow keys to move between days and Enter to choose.</p>
            {fullSet.size > 0 && <p className="mt-3 text-xs text-navy-400"><span className="line-through">12</span> = fully booked for this room type</p>}

            {checkInDate && (
              <div className="mt-3 flex items-center justify-between border-t border-navy-700 pt-3">
                <p className="text-xs text-navy-400">
                  {checkOutDate ? `${formatShort(checkInDate)} → ${formatShort(checkOutDate)}` : 'Now pick your check-out date'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ checkIn: '', checkOut: '' });
                    setHoverDate(null);
                  }}
                  className="text-xs text-gold-600 hover:underline"
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
