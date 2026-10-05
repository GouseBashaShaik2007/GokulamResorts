'use client';

// Mobile number with a country prefix (+91 by default). Indian numbers are
// shown as "98765 43210" while typing. onChange receives the full number,
// e.g. "+919876543210".
export const PREFIXES = ['+91', '+971', '+1', '+44', '+65', '+966', '+974'];

export const splitPhone = (full = '') => {
  const prefix = PREFIXES.find((p) => full.startsWith(p)) || '+91';
  return { prefix, local: full.startsWith(prefix) ? full.slice(prefix.length) : full.replace(/^\+/, '') };
};

const formatLocal = (prefix, digits) =>
  prefix === '+91' && digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5, 10)}` : digits;

/** A full number is usable: 10 digits starting 6–9 for India, at least 6 digits elsewhere. */
export function isValidPhone(full = '') {
  const { prefix, local } = splitPhone(full);
  const digits = local.replace(/\D/g, '');
  return prefix === '+91' ? /^[6-9]\d{9}$/.test(digits) : digits.length >= 6;
}

export default function PhoneInput({ id, value, onChange, required, onBlur, invalid = false, describedBy }) {
  const { prefix, local } = splitPhone(value);
  const digits = local.replace(/\D/g, '');
  const max = prefix === '+91' ? 10 : 14;

  return (
    <div className={`flex overflow-hidden rounded-lg border bg-sand-200 focus-within:border-ocean-400 focus-within:ring-1 focus-within:ring-ocean-400 ${invalid ? 'border-red-600' : 'border-sand-400'}`}>
      <select
        aria-label="Country code"
        value={prefix}
        onChange={(e) => onChange(e.target.value + digits)}
        className="border-r border-sand-400 bg-transparent pl-3 pr-1 text-ink-900 focus:outline-none"
      >
        {PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required={required}
        onBlur={onBlur}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={prefix === '+91' ? '98765 43210' : ''}
        value={formatLocal(prefix, digits)}
        onChange={(e) => onChange(prefix + e.target.value.replace(/\D/g, '').slice(0, max))}
        pattern={prefix === '+91' ? '\\d{5} \\d{5}' : '[\\d ]{6,16}'}
        title={prefix === '+91' ? 'Enter the 10-digit mobile number' : 'Enter the mobile number'}
        className="w-full bg-transparent px-3 py-3 tracking-wide text-ink-900 placeholder:text-ink-400 focus:outline-none"
      />
    </div>
  );
}
