'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { errMsg, fmtDateTime } from '../../../lib/bookingUi';
import { ISSUE_KIND_LABEL } from '../../../lib/roomIssues';
import useCleaningSocket from '../../../lib/useCleaningSocket';
import { useConfirm } from '../../ui/Confirm';
import { useToast } from '../../ui/Toast';

const KIND_STYLE = {
  repair: 'bg-orange-400/10 text-orange-800',
  damage: 'bg-red-500/10 text-red-700',
  lost_property: 'bg-blue-400/10 text-blue-700',
  other: 'bg-sand-300 text-ink-700',
};

/**
 * Admin → Housekeeping: problems housekeeping reported from the rooms — a
 * broken tap, a stain, something a guest left behind. The manager opens the
 * photo, deals with it, and marks it resolved. New reports arrive live.
 * Hidden while there is nothing open and nothing to look back at.
 */
export default function RoomIssues() {
  const ask = useConfirm();
  const toast = useToast();
  const [issues, setIssues] = useState(null); // null until loaded
  const [showResolved, setShowResolved] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/room-issues', { params: { status: showResolved ? 'all' : 'open' } });
      setIssues(res.data.issues);
    } catch (err) {
      // An API server started before this existed answers 404: say nothing rather than alarm.
      if (err?.response?.status === 404) setUnavailable(true);
      else toast(errMsg(err, 'Could not load the reported problems'), { tone: 'error' });
    }
  }, [showResolved, toast]);

  useEffect(() => {
    load();
  }, [load]);
  useCleaningSocket('admin', load, 'issue:update');

  const viewPhoto = async (issue) => {
    // Opened first, inside the click, so the browser doesn't block it as a pop-up.
    const tab = window.open('', '_blank');
    try {
      const res = await api.get(`/admin/room-issues/${issue.id}/photo-url`);
      if (tab) tab.location = res.data.url;
      else window.location.assign(res.data.url);
    } catch (err) {
      tab?.close();
      toast(errMsg(err, 'Could not open the photo'), { tone: 'error' });
    }
  };

  const resolve = async (issue) => {
    const note = await ask({
      title: `Room ${issue.unit_number}: mark this resolved?`,
      body: issue.description,
      confirmLabel: 'Mark resolved',
      input: { label: 'What was done (optional)', placeholder: 'e.g. Plumber replaced the washer', validate: (v) => (v.length > 500 ? 'Keep the note under 500 characters.' : '') },
    });
    if (note === null) return;
    try {
      await api.post(`/admin/room-issues/${issue.id}/resolve`, { note: note.trim() || undefined });
      toast(`Room ${issue.unit_number}: resolved.`);
    } catch (err) {
      toast(errMsg(err, 'Could not mark it resolved'), { tone: 'error' });
    }
    load();
  };

  if (unavailable || !issues) return null;
  const open = issues.filter((i) => i.status === 'open');
  if (open.length === 0 && !showResolved) {
    return (
      <p className="text-sm text-ink-400">
        No problems reported by housekeeping.{' '}
        <button type="button" onClick={() => setShowResolved(true)} className="font-semibold text-ocean-600 underline">Show resolved ones</button>
      </p>
    );
  }

  return (
    <section className="card p-5" aria-labelledby="room-issues-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="room-issues-title" className="font-serif text-xl font-bold text-ink-900">
          Problems reported by housekeeping <span className="font-sans text-sm font-normal text-ink-400">({open.length} open)</span>
        </h2>
        <button type="button" onClick={() => setShowResolved((v) => !v)} aria-pressed={showResolved} className="text-sm font-medium text-ocean-600 underline">
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>
      </div>
      <ul className="mt-4 space-y-3">
        {issues.map((issue) => (
          <li key={issue.id} className={`rounded-xl border border-sand-300 bg-sand-200 p-4 ${issue.status === 'resolved' ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-2xl font-bold text-ink-900">{issue.unit_number}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${KIND_STYLE[issue.kind] || KIND_STYLE.other}`}>{ISSUE_KIND_LABEL[issue.kind] || issue.kind}</span>
                  {issue.status === 'resolved' && <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-800">Resolved</span>}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-800">{issue.description}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {issue.room_type} · reported by {issue.reported_by} · {fmtDateTime(issue.created_at)}
                </p>
                {issue.resolution_note && <p className="mt-1 text-xs text-ink-500">Resolved: {issue.resolution_note}</p>}
              </div>
              <div className="flex flex-none flex-wrap gap-2">
                {issue.has_photo && (
                  <button type="button" onClick={() => viewPhoto(issue)} className="rounded-lg border border-sand-400 px-3 py-1.5 text-sm text-ink-700 hover:bg-sand-300">
                    View photo<span className="sr-only"> for room {issue.unit_number}</span>
                  </button>
                )}
                {issue.status === 'open' && (
                  <button type="button" onClick={() => resolve(issue)} className="rounded-lg bg-ocean-500 px-3 py-1.5 text-sm font-semibold text-white">
                    Mark resolved
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-400">Photos are kept privately and deleted a month after a problem is resolved.</p>
    </section>
  );
}
