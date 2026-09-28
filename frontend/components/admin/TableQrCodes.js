'use client';

import { useState } from 'react';

export default function TableQrCodes() {
  const [tableCount, setTableCount] = useState(10);
  const [siteUrl, setSiteUrl] = useState('');

  const origin = siteUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const tables = Array.from({ length: Math.max(0, Number(tableCount) || 0) }, (_, i) => i + 1);

  return (
    <div className="card p-6">
      <h2 className="font-serif text-xl font-bold text-navy-50">Table QR Codes</h2>
      <p className="mt-1 text-sm text-navy-400">
        Print one of these per table. Scanning it opens the menu scoped to that table number.
      </p>

      <div className="mt-4 flex flex-wrap gap-4">
        <div>
          <label className="label">Number of tables</label>
          <input
            type="number" min="1" max="100" className="input-field w-32"
            value={tableCount} onChange={(e) => setTableCount(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="label">Site URL (defaults to this browser&apos;s address)</label>
          <input
            className="input-field" placeholder={typeof window !== 'undefined' ? window.location.origin : ''}
            value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tables.map((n) => {
          const url = `${origin}/order/${n}`;
          const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
          return (
            <div key={n} className="rounded-lg border border-navy-700 bg-navy-800 p-3 text-center">
              <img src={qrSrc} alt={`QR code for table ${n}`} className="mx-auto h-32 w-32" />
              <p className="mt-2 text-sm font-semibold text-navy-50">Table {n}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
