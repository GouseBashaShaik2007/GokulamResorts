'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';
import { useToast } from '@/components/ui/Toast';

// What a table can ask for. There is no "Request the bill": a table's order is
// paid when it is placed, so there is no bill to bring. (The API still takes
// kind 'bill', for a page that was opened before that.)
const REQUESTS = [{ kind: 'staff', label: 'Call staff', sent: 'Staff called', toast: 'A member of our staff is on the way to your table.' }];

/** "Call staff" for a table — the request shows on the kitchen display. */
export default function TableService({ table, accessKey, className = '' }) {
  const toast = useToast();
  const [sent, setSent] = useState({});
  const [sending, setSending] = useState('');

  const send = async (request) => {
    setSending(request.kind);
    try {
      await api.post('/table-requests', { tableNumber: String(table), kind: request.kind, accessKey });
      setSent((s) => ({ ...s, [request.kind]: true }));
      toast(request.toast);
    } catch (err) {
      toast(errMsg(err, 'That didn’t go through. Please wave to one of our staff.'), { tone: 'error' });
    } finally {
      setSending('');
    }
  };

  return (
    <div className={`flex flex-wrap justify-center gap-2 ${className}`}>
      {REQUESTS.map((request) => (
        <button
          key={request.kind}
          type="button"
          disabled={sent[request.kind] || sending === request.kind}
          onClick={() => send(request)}
          className="rounded-full border border-sand-400 px-4 py-2 text-sm font-medium text-ink-800 transition-colors hover:border-ocean-500 hover:text-ocean-600 disabled:cursor-default disabled:border-sand-300 disabled:text-ink-400"
        >
          {sent[request.kind] ? `${request.sent} ✓` : request.label}
        </button>
      ))}
    </div>
  );
}
