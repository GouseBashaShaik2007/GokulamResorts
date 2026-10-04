import ContactForm from '@/components/site/ContactForm';
import QuickActions from '@/components/site/QuickActions';
import PageHeader from '@/components/ui/PageHeader';
import { CONTACT_REASONS } from '@/lib/contactReasons';
import { hotelJsonLd, jsonLd } from '@/lib/jsonLd';
import { getContact } from '@/lib/server-api';
import { directionsUrl, mapEmbedUrl, telHref } from '@/lib/site';

export const metadata = {
  title: 'Contact',
  description:
    'Contact Gokulam Resorts at Chirala Beach, Andhra Pradesh: email, directions, and an enquiry form for stays, dining, weddings and events.',
};

export default async function ContactPage({ searchParams }) {
  const contact = await getContact(); // as saved in Admin → Settings
  const tel = telHref(contact);
  // /contact?reason=Wedding opens the form on that reason.
  const reason = CONTACT_REASONS.includes(searchParams.reason) ? searchParams.reason : undefined;

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <PageHeader eyebrow="Get in touch" title="Contact us" />

        <QuickActions contact={contact} className="mt-8" />

        <div className="mt-12 grid gap-10 lg:grid-cols-[2fr_3fr]">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-navy-50">Gokulam Resorts</h2>
            <dl className="mt-6 space-y-5 text-sm">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-navy-400">Address</dt>
                <dd className="mt-1 text-navy-100">
                  <a href={directionsUrl(contact)} target="_blank" rel="noopener noreferrer" className="hover:text-ocean-600">{contact.address}</a>
                </dd>
              </div>
              {tel && (
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-navy-400">Phone</dt>
                  <dd className="mt-1 text-navy-100"><a href={tel} className="hover:text-ocean-600">{contact.phone}</a></dd>
                </div>
              )}
              <div>
                <dt className="font-semibold uppercase tracking-wide text-navy-400">Email</dt>
                <dd className="mt-1 text-navy-100"><a href={`mailto:${contact.email}`} className="hover:text-ocean-600">{contact.email}</a></dd>
              </div>
              {(contact.checkInTime || contact.checkOutTime) && (
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-navy-400">Check-in / check-out</dt>
                  <dd className="mt-1 text-navy-100">
                    {[contact.checkInTime && `Check-in from ${contact.checkInTime}`, contact.checkOutTime && `check-out by ${contact.checkOutTime}`].filter(Boolean).join(' · ')}
                  </dd>
                </div>
              )}
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

          <ContactForm initialReason={reason} />
        </div>
      </div>

      {/* The address in words above the map, for anyone who can't use the map itself. */}
      <section aria-labelledby="find-us" className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <h2 id="find-us" className="font-serif text-2xl font-semibold text-navy-50">Find us</h2>
        <p className="mt-2 text-navy-200">
          {contact.address}.{' '}
          <a href={directionsUrl(contact)} target="_blank" rel="noopener noreferrer" className="font-semibold text-ocean-600 underline underline-offset-2">
            Open in Google Maps
          </a>
        </p>
      </section>
      <iframe
        title="Map of Chirala"
        src={mapEmbedUrl(contact)}
        className="h-96 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

      {/* Name, address and phone in the format search engines read. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(hotelJsonLd(contact)) }} />
    </div>
  );
}
