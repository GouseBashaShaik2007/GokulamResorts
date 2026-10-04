// A stay as a calendar file (.ics) that any phone or desktop calendar opens.

const compact = (iso) => iso.replace(/-/g, '');
const escapeText = (text) => String(text).replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');

const dayAfter = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * An all-day event from check-in to check-out (both days shown).
 * { reference, title, checkIn, checkOut (YYYY-MM-DD), location, notes }
 */
export function stayCalendarFile({ reference, title, checkIn, checkOut, location, notes }) {
  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gokulam Resorts//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${reference}@gokulam-resorts`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(checkIn)}`,
    // The end of an all-day event is exclusive, so the check-out day itself needs one more.
    `DTEND;VALUE=DATE:${compact(dayAfter(checkOut))}`,
    `SUMMARY:${escapeText(title)}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    ...(notes ? [`DESCRIPTION:${escapeText(notes)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Hands a calendar file to the browser to save or open. */
export function downloadCalendarFile(name, contents) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
