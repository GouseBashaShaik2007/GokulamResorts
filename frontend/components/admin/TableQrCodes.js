'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import api from '../../lib/api';
import { errMsg } from '../../lib/bookingUi';
import { kioskSetupPath } from '../../lib/kiosk';
import { useToast } from '../ui/Toast';
import Chip from '../ui/Chip';

// Tables and rooms are usually printed on different days, on different card.
const PRINT_CHOICES = [
  { value: 'all', label: 'Everything' },
  { value: 'tables', label: 'Tables and counter' },
  { value: 'rooms', label: 'Rooms' },
];

function isBadAddress(url) {
  if (!url) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  } catch {
    return true;
  }
}

// One printed card. The code is drawn here in the browser, so the ordering
// links (and the keys in them) are never sent to another website.
// `path`: the page the code leads to, without the site's address — shown on
// screen only as "Open here", to try it on this device without a phone.
function QrCard({ title, caption, url, path }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let stale = false;
    if (!url) {
      setSrc('');
      return undefined;
    }
    QRCode.toDataURL(url, { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then((data) => !stale && setSrc(data))
      .catch(() => !stale && setSrc(''));
    return () => {
      stale = true;
    };
  }, [url]);

  return (
    <div className="break-inside-avoid rounded-lg border border-sand-300 bg-sand-200 p-3 text-center print:border-ink-500 print:bg-white">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400 print:text-black">Gokulam Resorts</p>
      {src ? (
        <img src={src} alt={`QR code: ${title}`} width={128} height={128} className="mx-auto h-32 w-32" />
      ) : (
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded bg-sand-100 text-xs text-ink-400">
          {url ? 'Drawing…' : 'Set address first'}
        </div>
      )}
      <p className="mt-2 text-sm font-semibold text-ink-900 print:text-black">{title}</p>
      <p className="text-[11px] text-ink-400 print:text-black">{caption}</p>
      {path && (
        <a href={path} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title} here`} className="no-print mt-1 inline-block text-[11px] font-semibold text-ocean-600 underline underline-offset-2">
          Open here
        </a>
      )}
    </div>
  );
}

export default function TableQrCodes() {
  const toast = useToast();
  const [links, setLinks] = useState(null); // { siteUrl, tableCount, counterKey, kioskKey, tables: [{ table, key }], rooms: [{ room, key }] }
  const [printWhat, setPrintWhat] = useState('all');
  const [draftCount, setDraftCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/admin/order-links')
      .then((res) => {
        setLinks(res.data);
        setDraftCount(String(res.data.tableCount));
        setError('');
      })
      .catch((err) => setError(errMsg(err, 'Could not load the QR codes. Please reload the page.')));
  }, []);
  useEffect(load, [load]);

  const saveCount = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/admin/settings', { tableCount: Number(draftCount) });
      toast(`Saved: ${draftCount} tables can now order.`);
      load();
    } catch (err) {
      toast(errMsg(err, 'Could not save the number of tables.'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const siteUrl = links?.siteUrl || '';
  const blocked = isBadAddress(siteUrl);
  const countChanged = links && String(links.tableCount) !== String(draftCount);
  const rooms = links?.rooms || [];

  const copyKioskLink = async () => {
    try {
      await navigator.clipboard.writeText(`${siteUrl}${kioskSetupPath(links.kioskKey)}`);
      toast('Set-up link copied. Open it once on the kiosk tablet.');
    } catch {
      toast('Could not copy the link. Scan the code with the tablet instead.', { tone: 'error' });
    }
  };

  return (
    // On paper only the codes are printed: everything else is marked no-print
    // (left out entirely, so the first sheet is never an empty one).
    <>
    <div className="card p-6 print:border-0 print:bg-transparent print:p-0">
      <h2 className="no-print font-serif text-xl font-bold text-ink-900">Ordering QR Codes</h2>
      <p className="no-print mt-1 max-w-3xl text-sm text-ink-400">
        Guests can only order by scanning one of these: one per table, one per hotel room, plus one for the restaurant counter. Each code
        carries its own key, so the ordering pages can&apos;t be opened by typing or guessing an address — and a table
        that isn&apos;t listed here can&apos;t order at all.
        {links?.kioskKey && (
          <>
            {' '}The restaurant&apos;s kiosk tablet is not behind a QR code:{' '}
            <a href="#kiosk-setup" className="text-gold-600 underline">how to set it up</a> is below the codes.
          </>
        )}
      </p>

      <form onSubmit={saveCount} className="no-print mt-4 flex flex-wrap items-end gap-4 border-b border-sand-200 pb-6">
        <div>
          <label className="label" htmlFor="tableCount">Number of tables</label>
          <input
            id="tableCount"
            type="number" min="1" max="200" required className="input-field w-32"
            value={draftCount} onChange={(e) => setDraftCount(e.target.value)}
          />
        </div>
        <button type="submit" disabled={!countChanged || saving} className="btn-primary px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <p className="text-xs text-ink-400">
          The website address is set once for the whole resort — see{' '}
          <Link href="/admin/settings" className="text-gold-600 underline">Admin → Settings</Link>.
        </p>
      </form>

      {error && <p role="alert" className="no-print mt-3 text-sm text-red-700">{error}</p>}

      {links && blocked && (
        <div className="no-print mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          Set the website address in{' '}
          <Link href="/admin/settings" className="underline">Settings</Link> before printing QR codes. Right now
          they would point at {siteUrl ? <code>{siteUrl}</code> : 'no address'} — every code would be broken
          for guests.
        </div>
      )}

      <div className="no-print mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-400">
          {blocked ? 'Preview only — printing is off until the website address is set.' : `Printing for ${siteUrl}`}
          {countChanged && ' Save the new number of tables to update the codes below.'}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {rooms.length > 0 && (
            <div role="group" aria-label="What to print" className="flex flex-wrap gap-2">
              {PRINT_CHOICES.map((choice) => (
                <Chip key={choice.value} size="sm" tone="solid" pressed={printWhat === choice.value} onClick={() => setPrintWhat(choice.value)}>
                  {choice.label}
                </Chip>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={!links || blocked}
            onClick={() => window.print()}
            className="btn-primary px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Print QR Codes
          </button>
        </div>
      </div>

      {links && (
        <div id="qr-print-area" className={`mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 print:mt-0 print:grid-cols-3 ${printWhat === 'rooms' ? 'print:hidden' : ''}`}>
          <QrCard
            title="Restaurant counter"
            caption="Scan to order and pay at the counter"
            url={blocked ? '' : `${siteUrl}/order?k=${links.counterKey}`}
            path={`/order?k=${links.counterKey}`}
          />
          {links.tables.map(({ table, key }) => (
            <QrCard
              key={table}
              title={`Table ${table}`}
              caption="Scan to see the menu and order"
              url={blocked ? '' : `${siteUrl}/order/${table}?k=${key}`}
              path={`/order/${table}?k=${key}`}
            />
          ))}
        </div>
      )}

      {rooms.length > 0 && (
        <>
          <h3 className="no-print mt-8 font-serif text-lg font-bold text-ink-900">Hotel rooms</h3>
          <p className="no-print mt-1 max-w-3xl text-sm text-ink-400">
            One code for each room in use, to leave in the room. Food ordered from it is brought to that room. The
            guest pays online when ordering, or in cash at the door: delivering the order on the kitchen screen records
            the cash.
          </p>
          <div id="qr-print-rooms" className={`mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 print:grid-cols-3 ${printWhat === 'tables' ? 'print:hidden' : ''}`}>
            {rooms.map(({ room, key }) => (
              <QrCard
                key={room}
                title={`Room ${room}`}
                caption="Scan to order food to your room"
                url={blocked ? '' : `${siteUrl}/order/room/${encodeURIComponent(room)}?k=${key}`}
                path={`/order/room/${encodeURIComponent(room)}?k=${key}`}
              />
            ))}
          </div>
        </>
      )}

      <p className="no-print mt-6 text-xs text-ink-400">
        Codes printed before this page had keys no longer work — print a fresh set. If a code is ever copied or
        misused, ask your developer to change <code>ORDER_LINK_SECRET</code>: every old code stops working at once,
        and this page prints the new ones. (The kiosk tablet then needs its set-up link once more, too.)
      </p>
    </div>

    {links?.kioskKey && (
      <section className="card no-print mt-6 scroll-mt-6 p-6" aria-labelledby="kiosk-setup">
        <h2 id="kiosk-setup" className="font-serif text-xl font-bold text-ink-900">Restaurant kiosk</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-400">
          The kiosk is the tablet in the restaurant where customers choose their dishes and pay on the screen. Guests
          do not scan anything for it: the tablet itself is set up once, with the code or link below, and remembers
          it. On any other device the kiosk address only explains what it is.
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-6">
          <div className="w-44 flex-none">
            <QrCard title="Kiosk set-up" caption="Scan once with the tablet" url={blocked ? '' : `${siteUrl}${kioskSetupPath(links.kioskKey)}`} />
          </div>
          <ol className="max-w-xl list-decimal space-y-1.5 pl-5 text-sm text-ink-700">
            <li>On the tablet, scan this code with the camera, or open the set-up link in Chrome.</li>
            <li>The kiosk opens at “Tap to start”. In the browser menu choose “Add to Home screen” and open it from there: it then fills the whole screen.</li>
            <li>Stand the tablet on its side, and set it to keep its screen on while charging.</li>
            <li>Orders arrive on the kitchen screen already paid, under a number. Call the number out when the food is ready.</li>
          </ol>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            disabled={blocked}
            onClick={copyKioskLink}
            className="rounded-lg border border-sand-400 px-4 py-2 text-sm font-medium text-ink-800 hover:bg-sand-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Copy the set-up link
          </button>
          <a href={kioskSetupPath(links.kioskKey)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-ocean-600 underline underline-offset-2">
            Open the kiosk on this device
          </a>
          <span className="text-xs text-ink-400">For a look, or a trial order. This device then works as a kiosk too.</span>
        </div>
      </section>
    )}
    </>
  );
}
