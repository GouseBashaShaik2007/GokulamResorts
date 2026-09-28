import MenuBrowser from '../../../components/MenuBrowser';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function getMenu() {
  try {
    const [categoriesRes, itemsRes] = await Promise.all([
      fetch(`${API_URL}/menu/categories`, { cache: 'no-store' }),
      fetch(`${API_URL}/menu/items`, { cache: 'no-store' }),
    ]);
    const categories = categoriesRes.ok ? (await categoriesRes.json()).categories || [] : [];
    const items = itemsRes.ok ? (await itemsRes.json()).items || [] : [];
    return { categories, items };
  } catch (err) {
    return { categories: [], items: [] };
  }
}

export const metadata = { title: 'Order Food — Gokulam Resorts' };

export default async function TableOrderPage({ params }) {
  const { categories, items } = await getMenu();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="eyebrow">Table {params.tableId}</p>
        <h1 className="section-heading mt-2">Order Food to Your Table</h1>
        <p className="mx-auto mt-4 max-w-2xl text-navy-300">
          Browse the menu, add what you like, and place your order — it goes straight to our kitchen.
        </p>
      </div>

      {items.length > 0 ? (
        <MenuBrowser categories={categories} items={items} orderContext={{ type: 'table', tableId: params.tableId }} />
      ) : (
        <div className="card p-8 text-center text-navy-300">
          The menu isn&apos;t available right now. Please check back shortly.
        </div>
      )}
    </div>
  );
}
