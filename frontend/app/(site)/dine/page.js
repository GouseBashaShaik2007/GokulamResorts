import MenuBrowser from '@/components/MenuBrowser';
import ScanToOrder from '@/components/site/ScanToOrder';
import { getMenu, hasOrderAccess } from '@/lib/server-api';

// An ordering screen, not a landing page: /dining is the one to index.
export const metadata = { title: 'Dine With Us', robots: { index: false, follow: false } };

// Reached by scanning the QR code at the restaurant counter, which carries a
// key (Admin → QR Codes). Without it there is no ordering — see ScanToOrder.
export default async function KioskPage({ searchParams }) {
  const accessKey = typeof searchParams.k === 'string' ? searchParams.k : '';
  if (!(await hasOrderAccess({ key: accessKey }))) return <ScanToOrder />;

  const { categories, items } = await getMenu({ fresh: true });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-4 text-center">
        <p className="eyebrow">Restaurant</p>
        <h1 className="section-heading mt-2">Dine With Us</h1>
        <ol className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-navy-300">
          {['Add dishes to your order', 'Enter your name and place it', 'Pay at the restaurant counter', 'Collect it at the counter when your order page says “Ready”'].map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ocean-500 text-xs font-semibold text-white" aria-hidden="true">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {items.length > 0 ? (
        <MenuBrowser categories={categories} items={items} orderContext={{ type: 'kiosk', accessKey }} />
      ) : (
        <div className="card p-8 text-center text-navy-300">
          The menu isn&apos;t available right now. Please check back shortly.
        </div>
      )}
    </div>
  );
}
