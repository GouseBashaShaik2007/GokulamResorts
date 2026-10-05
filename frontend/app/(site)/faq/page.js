import Link from 'next/link';
import FaqList from '@/components/site/FaqList';
import PageHeader from '@/components/ui/PageHeader';
import { faqJsonLd, faqsWith } from '@/lib/faqs';
import { jsonLd } from '@/lib/jsonLd';
import { getContact } from '@/lib/server-api';

export const metadata = {
  title: 'FAQ & Policies',
  description:
    'Answers about booking, payment, GST, check-in ID, extending a stay, cancellations and refunds at Gokulam Resorts, Chirala Beach.',
};

export default async function FaqPage() {
  const faqs = faqsWith(await getContact());
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader eyebrow="FAQ &amp; policies" title="Good to know" />

      <FaqList sections={faqs} />

      <p className="mt-12 text-ink-500">
        Something else? <Link href="/contact" className="text-ocean-600 underline">Contact us</Link>.
      </p>

      {/* The same questions and answers, in the format search engines read. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd(faqs)) }} />
    </div>
  );
}
