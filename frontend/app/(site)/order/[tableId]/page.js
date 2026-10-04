import { notFound } from 'next/navigation';
import MenuBrowser from '@/components/MenuBrowser';
import { getMenu } from '@/lib/server-api';

// Table links come from the printed QR codes (Admin → QR Codes prints 1–100).
// Anything else — /order/999, /order/hello — is not a table.
const tableNumber = (raw) => (/^[1-9]\d{0,2}$/.test(raw) && Number(raw) <= 100 ? Number(raw) : null);

export function generateMetadata({ params }) {
  const table = tableNumber(params.tableId);
  return { title: table ? `Table ${table} — Order` : 'Order', robots: { index: false, follow: false } };
}

export default async function TableOrderPage({ params }) {
  const table = tableNumber(params.tableId);
  if (!table) notFound();

  const { categories, items } = await getMenu({ fresh: true });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-4 text-center">
        <p className="eyebrow">Table {table}</p>
        <h1 className="section-heading mt-2">Order Food to Your Table</h1>
        <p className="mx-auto mt-4 max-w-2xl text-navy-300">
          Browse the menu, add what you like, and place your order — it goes straight to our kitchen.
        </p>
      </div>

      {items.length > 0 ? (
        <MenuBrowser categories={categories} items={items} orderContext={{ type: 'table', tableId: table }} />
      ) : (
        <div className="card p-8 text-center text-navy-300">
          The menu isn&apos;t available right now. Please check back shortly.
        </div>
      )}
    </div>
  );
}
