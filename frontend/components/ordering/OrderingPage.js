import MenuBrowser from '@/components/MenuBrowser';
import ScanToOrder from '@/components/site/ScanToOrder';
import TableService from '@/components/site/TableService';
import PageHeader from '@/components/ui/PageHeader';
import { getMenu, hasOrderAccess } from '@/lib/server-api';

const COUNTER_STEPS = [
  'Add dishes to your order',
  'Enter your name and place it',
  'Pay at the restaurant counter',
  'Collect it at the counter when your order page says “Ready”',
];

/**
 * The ordering screen behind a QR code: one table's, or the restaurant
 * counter's (Admin → QR Codes prints both).
 *
 * `table`: the table number, or null for the counter. `searchParams.k`: the
 * key the code carries. Without the right key there is no ordering — the page
 * explains how to scan a code instead.
 */
export default async function OrderingPage({ table = null, searchParams }) {
  const accessKey = typeof searchParams.k === 'string' ? searchParams.k : '';
  if (!(await hasOrderAccess({ table, key: accessKey }))) return <ScanToOrder />;

  // Fresh, and with sold-out dishes included (shown greyed out).
  const { categories, items } = await getMenu({ fresh: true, all: true });
  const orderContext = table ? { type: 'table', tableId: table, accessKey } : { type: 'counter', accessKey };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader size="compact" title={table ? 'Order to your table' : 'Order at the counter'} className="mb-6 text-center">
        {table ? (
          <>
            <p className="mx-auto mt-3 max-w-2xl text-navy-300">
              Browse the menu, add what you like, and place your order — it goes straight to our kitchen. You pay at
              your table; there is nothing to pay online.
            </p>
            <TableService table={table} accessKey={accessKey} className="mt-5" />
          </>
        ) : (
          <ol className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-navy-300">
            {COUNTER_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ocean-500 text-xs font-semibold text-white" aria-hidden="true">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        )}
      </PageHeader>

      {items.length > 0 ? (
        <MenuBrowser categories={categories} items={items} orderContext={orderContext} />
      ) : (
        <div className="card p-8 text-center text-navy-300">The menu isn&apos;t available right now. Please check back shortly.</div>
      )}
    </div>
  );
}
