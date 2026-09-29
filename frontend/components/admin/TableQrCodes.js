'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { withAdminAuth } from '../../lib/api';

function isBadAddress(url) {
  if (!url) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  } catch {
    return true;
  }
}

export default function TableQrCodes() {
  const [tableCount, setTableCount] = useState(10);
  const [siteUrl, setSiteUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/settings', withAdminAuth())
      .then((res) => setSiteUrl(res.data.settings.site_url || ''))
      .catch(() => setError('Could not load the site address setting.'))
      .finally(() => setLoaded(true));
  }, []);

  const blocked = isBadAddress(siteUrl);
  const tables = Array.from({ length: Math.max(0, Number(tableCount) || 0) }, (_, i) => i + 1);

  return (
    <div className="card p-6">
      <h2 className="font-serif text-xl font-bold text-navy-50">Table QR Codes</h2>
      <p className="mt-1 text-sm text-navy-400">
        Print one of these per table. Scanning it opens the menu scoped to that table number.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4 border-b border-navy-800 pb-6">
        <div>
          <label className="label">Number of tables</label>
          <input
            type="number" min="1" max="100" className="input-field w-32"
            value={tableCount} onChange={(e) => setTableCount(e.target.value)}
          />
        </div>
        <p className="text-xs text-navy-400">
          Production site address is set once for the whole resort — see{' '}
          <Link href="/admin/settings" className="text-gold-400 underline">Admin → Settings</Link>.
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {loaded && blocked && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          ⚠️ Set a production site address in{' '}
          <Link href="/admin/settings" className="underline">Settings</Link> before printing QR codes. Right now
          they would point at {siteUrl ? <code>{siteUrl}</code> : 'no address'} — every table code would be broken
          for guests.
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-navy-400">
          {blocked ? 'Preview only — printing is disabled until a production address is set.' : `Printing for ${siteUrl}`}
        </p>
        <button
          type="button"
          disabled={blocked}
          onClick={() => window.print()}
          className="btn-gold px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Print QR Codes
        </button>
      </div>

      <div id="qr-print-area" className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tables.map((n) => {
          const url = blocked ? '' : `${siteUrl}/order/${n}`;
          const qrSrc = url
            ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`
            : null;
          return (
            <div key={n} className="rounded-lg border border-navy-700 bg-navy-800 p-3 text-center print:border-navy-300 print:bg-white">
              {qrSrc ? (
                <img src={qrSrc} alt={`QR code for table ${n}`} className="mx-auto h-32 w-32" />
              ) : (
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded bg-navy-900 text-xs text-navy-500">
                  Set address first
                </div>
              )}
              <p className="mt-2 text-sm font-semibold text-navy-50 print:text-black">Table {n}</p>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #qr-print-area,
          #qr-print-area * {
            visibility: visible;
          }
          #qr-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
