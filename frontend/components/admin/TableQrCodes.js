'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import api, { withAdminAuth } from '../../lib/api';
import { errMsg } from '../../lib/bookingUi';
import { useToast } from '../ui/Toast';

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
function QrCard({ title, caption, url }) {
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
    <div className="break-inside-avoid rounded-lg border border-navy-700 bg-navy-800 p-3 text-center print:border-navy-300 print:bg-white">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-navy-400 print:text-black">Gokulam Resorts</p>
      {src ? (
        <img src={src} alt={`QR code: ${title}`} width={128} height={128} className="mx-auto h-32 w-32" />
      ) : (
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded bg-navy-900 text-xs text-navy-400">
          {url ? 'Drawing…' : 'Set address first'}
        </div>
      )}
      <p className="mt-2 text-sm font-semibold text-navy-50 print:text-black">{title}</p>
      <p className="text-[11px] text-navy-400 print:text-black">{caption}</p>
    </div>
  );
}

export default function TableQrCodes() {
  const toast = useToast();
  const [links, setLinks] = useState(null); // { siteUrl, tableCount, counterKey, tables: [{ table, key }] }
  const [draftCount, setDraftCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/admin/order-links', withAdminAuth())
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
      await api.put('/admin/settings', { tableCount: Number(draftCount) }, withAdminAuth());
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

  return (
    // On paper only the codes are printed: everything else is marked no-print
    // (left out entirely, so the first sheet is never an empty one).
    <div className="card p-6 print:border-0 print:bg-transparent print:p-0">
      <h2 className="no-print font-serif text-xl font-bold text-navy-50">Ordering QR Codes</h2>
      <p className="no-print mt-1 max-w-3xl text-sm text-navy-400">
        Guests can only order by scanning one of these: one per table, plus one for the restaurant counter. Each code
        carries its own key, so the ordering pages can&apos;t be opened by typing or guessing an address — and a table
        that isn&apos;t listed here can&apos;t order at all.
      </p>

      <form onSubmit={saveCount} className="no-print mt-4 flex flex-wrap items-end gap-4 border-b border-navy-800 pb-6">
        <div>
          <label className="label" htmlFor="tableCount">Number of tables</label>
          <input
            id="tableCount"
            type="number" min="1" max="200" required className="input-field w-32"
            value={draftCount} onChange={(e) => setDraftCount(e.target.value)}
          />
        </div>
        <button type="submit" disabled={!countChanged || saving} className="btn-gold px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <p className="text-xs text-navy-400">
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
        <p className="text-sm text-navy-400">
          {blocked ? 'Preview only — printing is off until the website address is set.' : `Printing for ${siteUrl}`}
          {countChanged && ' Save the new number of tables to update the codes below.'}
        </p>
        <button
          type="button"
          disabled={!links || blocked}
          onClick={() => window.print()}
          className="btn-gold px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Print QR Codes
        </button>
      </div>

      {links && (
        <div id="qr-print-area" className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 print:mt-0 print:grid-cols-3">
          <QrCard
            title="Restaurant counter"
            caption="Scan to order and pay at the counter"
            url={blocked ? '' : `${siteUrl}/order?k=${links.counterKey}`}
          />
          {links.tables.map(({ table, key }) => (
            <QrCard
              key={table}
              title={`Table ${table}`}
              caption="Scan to see the menu and order"
              url={blocked ? '' : `${siteUrl}/order/${table}?k=${key}`}
            />
          ))}
        </div>
      )}

      <p className="no-print mt-6 text-xs text-navy-400">
        Codes printed before this page had keys no longer work — print a fresh set. If a code is ever copied or
        misused, ask your developer to change <code>ORDER_LINK_SECRET</code>: every old code stops working at once,
        and this page prints the new ones.
      </p>
    </div>
  );
}
