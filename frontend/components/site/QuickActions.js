import Icon from '@/components/ui/Icon';
import { directionsUrl, telHref, whatsappUrl } from '@/lib/site';

/**
 * Call · WhatsApp · Email · Directions, as large buttons. Call and WhatsApp
 * appear once those numbers are set in Admin → Settings.
 * `contact`: the resort's details. `whatsappText`: what a WhatsApp chat opens with.
 */
export default function QuickActions({ contact, whatsappText = 'Hello Gokulam Resorts, ', className = '' }) {
  const tel = telHref(contact);
  const wa = whatsappUrl(whatsappText, contact);
  const actions = [
    tel && { href: tel, icon: 'call', label: 'Call' },
    wa && { href: wa, icon: 'whatsapp', label: 'WhatsApp', external: true },
    { href: `mailto:${contact.email}`, icon: 'email', label: 'Email' },
    { href: directionsUrl(contact), icon: 'directions', label: 'Directions', external: true },
  ].filter(Boolean);

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {actions.map((action) => (
        <a
          key={action.label}
          href={action.href}
          {...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-navy-700 bg-navy-950 px-4 py-5 text-sm font-semibold text-navy-50 transition-colors hover:border-ocean-400 hover:text-ocean-600 sm:max-w-[14rem]"
        >
          <Icon name={action.icon} className="h-6 w-6 text-ocean-500" />
          {action.label}
        </a>
      ))}
    </div>
  );
}
