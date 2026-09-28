'use client';

import { useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';

const STATUS_STYLE = {
  new: 'bg-gold-500/10 text-gold-400',
  preparing: 'bg-blue-400/10 text-blue-300',
  ready: 'bg-green-500/10 text-green-300',
  served: 'bg-navy-700 text-navy-300',
  cancelled: 'bg-red-500/10 text-red-300',
};

export default function FoodOrdersManager() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/food-orders', withAdminAuth())
      .then((res) => setOrders(res.data.orders))
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load food orders'));
  }, []);

  return (
    <div className="card overflow-x-auto p-6">
      <h2 className="font-serif text-xl font-bold text-navy-50">Food Orders</h2>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <table className="mt-4 w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-navy-700 text-navy-400">
            <th className="py-2 pr-4">#</th>
            <th className="py-2 pr-4">Source</th>
            <th className="py-2 pr-4">Items</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-navy-800 text-navy-100">
              <td className="py-2 pr-4">{o.id}</td>
              <td className="py-2 pr-4">
                {o.table_number ? `Table ${o.table_number}` : o.customer_name || 'Kiosk'}
                <div className="text-xs text-navy-400">{new Date(o.created_at).toLocaleString('en-IN')}</div>
              </td>
              <td className="py-2 pr-4">
                {o.items.map((i) => `${i.item_name} ×${i.quantity}`).join(', ')}
              </td>
              <td className="py-2 pr-4">₹{Number(o.total_amount).toLocaleString('en-IN')}</td>
              <td className="py-2 pr-4">
                <span className={`rounded-full px-2 py-1 text-xs capitalize ${STATUS_STYLE[o.status] || ''}`}>
                  {o.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p className="mt-4 text-navy-400">No food orders yet.</p>}
    </div>
  );
}
