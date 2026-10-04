// Shared formatting for booking screens (guest, front desk, manager).

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const STATUS_LABEL = {
  pending_payment: 'Pending payment',
  paid: 'Paid · awaiting approval',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  no_show: 'No-show',
};

export const STATUS_STYLE = {
  pending_payment: 'bg-navy-700 text-navy-200',
  paid: 'bg-gold-500/15 text-gold-600',
  confirmed: 'bg-blue-400/10 text-blue-700',
  checked_in: 'bg-green-500/15 text-green-700',
  checked_out: 'bg-navy-700 text-navy-300',
  cancelled: 'bg-red-500/10 text-red-700',
  rejected: 'bg-red-500/10 text-red-700',
  no_show: 'bg-orange-400/10 text-orange-700',
};

export function StatusBadge({ status }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] || ''}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export const fmtDate = (iso) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (t) =>
  t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Resort-local (IST) today as YYYY-MM-DD, regardless of the device's timezone.
export const todayIST = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const errMsg = (err, fallback) => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join('. ');
  return data?.message || fallback;
};

export const ID_TYPES = [
  { value: 'Aadhaar', label: 'Aadhaar (masked)' },
  { value: 'Passport', label: 'Passport' },
  { value: 'DrivingLicense', label: 'Driving licence' },
];
