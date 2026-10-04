import ContactForm from '@/components/site/ContactForm';
import { CONTACT, directionsUrl, mapEmbedUrl, telHref, whatsappUrl } from '@/lib/site';

export const metadata = {
  title: 'Contact',
  description:
    'Contact Gokulam Resorts at Chirala Beach, Andhra Pradesh: email, directions, and an enquiry form for stays, weddings and events.',
};

const ICONS = {
  call: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z',
  whatsapp: 'M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.2-5.4A8.4 8.4 0 1 1 21 11.5Z',
  email: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 2-10 7L2 6',
  directions: 'M3 11l19-9-9 19-2-8-8-2Z',
};

function QuickButton({ href, icon, label, external }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex flex-1 flex-col items-center gap-2 rounded-2xl border sm:max-w-[14rem] border-navy-700 bg-navy-950 px-4 py-5 text-sm font-semibold text-navy-50 transition-colors hover:border-ocean-400 hover:text-ocean-600"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-ocean-500" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ICONS[icon]} />
      </svg>
      {label}
    </a>
  );
}

export default function ContactPage() {
  const wa = whatsappUrl('Hello Gokulam Resorts, ');
  const tel = telHref();
  const quick = [
    tel && { href: tel, icon: 'call', label: 'Call' },
    wa && { href: wa, icon: 'whatsapp', label: 'WhatsApp', external: true },
    { href: `mailto:${CONTACT.email}`, icon: 'email', label: 'Email' },
    { href: directionsUrl(), icon: 'directions', label: 'Directions', external: true },
  ].filter(Boolean);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="eyebrow">Get in touch</p>
        <h1 className="display-heading mt-2 text-4xl md:text-5xl">Contact us</h1>

        <div className="mt-8 flex flex-wrap gap-3">
          {quick.map((q) => <QuickButton key={q.label} {...q} />)}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[2fr_3fr]">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-navy-50">Gokulam Resorts</h2>
            <dl className="mt-6 space-y-5 text-sm">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-navy-400">Address</dt>
                <dd className="mt-1 text-navy-100">
                  <a href={directionsUrl()} target="_blank" rel="noopener noreferrer" className="hover:text-ocean-600">{CONTACT.address}</a>
                </dd>
              </div>
              {tel && (
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-navy-400">Phone</dt>
                  <dd className="mt-1 text-navy-100"><a href={tel} className="hover:text-ocean-600">{CONTACT.phone}</a></dd>
                </div>
              )}
              <div>
                <dt className="font-semibold uppercase tracking-wide text-navy-400">Email</dt>
                <dd className="mt-1 text-navy-100"><a href={`mailto:${CONTACT.email}`} className="hover:text-ocean-600">{CONTACT.email}</a></dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-navy-400">Front desk</dt>
                <dd className="mt-1 text-navy-100">Open 24 hours, every day</dd>
              </div>
            </dl>
            <p className="mt-8 rounded-xl bg-navy-900 p-4 text-sm text-navy-300">
              Planning a wedding or event? Choose <strong className="text-navy-100">Wedding</strong> or{' '}
              <strong className="text-navy-100">Event</strong> in the form with your dates and we&apos;ll come back to
              you with availability.
            </p>
          </div>

          <ContactForm />
        </div>
      </div>

      <iframe
        title="Map of Chirala"
        src={mapEmbedUrl()}
        className="h-96 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
