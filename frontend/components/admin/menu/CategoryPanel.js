'use client';

import { useState } from 'react';
import { useConfirm } from '@/components/ui/Confirm';

const emptyForm = { name: '', sortOrder: 0 };

/** Menu categories: add, rename, reorder, hide and restore. */
export default function CategoryPanel({ categories, onSave, onHide, onRestore }) {
  const ask = useConfirm();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null); // the category being edited

  const reset = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    const saved = await onSave(editing?.id, { name: form.name, sortOrder: Number(form.sortOrder) || 0 });
    if (saved) reset();
  };

  const hide = async (category) => {
    const ok = await ask({
      title: `Hide ${category.name}?`,
      body: 'Its dishes disappear from the guest menu until you restore it. Nothing is deleted.',
      confirmLabel: 'Hide category',
    });
    if (ok) onHide(category);
  };

  return (
    <div className="card p-6">
      <h2 className="font-serif text-xl font-bold text-ink-900">{editing ? `Edit category: ${editing.name}` : 'Categories'}</h2>
      <form onSubmit={submit} className="mt-4 flex flex-wrap gap-3">
        <input
          aria-label="Category name"
          className="input-field min-w-[10rem] flex-1" placeholder="Category name" required
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
        <input
          aria-label="Position on the menu (lowest first)"
          title="Position on the menu (lowest first)"
          type="number" className="input-field w-24" placeholder="Position"
          value={form.sortOrder}
          onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
        />
        <button type="submit" className="btn-primary px-4">{editing ? 'Save' : 'Add'}</button>
        {editing && <button type="button" onClick={reset} className="btn-outline px-4">Cancel</button>}
      </form>

      <div className="mt-4 space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-sand-300 bg-sand-200 p-3">
            <span className="text-ink-900">
              {c.name} {!c.is_active && <span className="ml-2 text-xs text-red-700">(hidden)</span>}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(c);
                  setForm({ name: c.name, sortOrder: c.sort_order });
                }}
                className="rounded-lg border border-gold-500/50 px-3 py-1 text-xs text-gold-600 hover:bg-gold-500/10"
              >
                Edit
              </button>
              {c.is_active ? (
                <button onClick={() => hide(c)} className="rounded-lg border border-red-500/50 px-3 py-1 text-xs text-red-700 hover:bg-red-500/10">
                  Hide
                </button>
              ) : (
                <button onClick={() => onRestore(c)} className="rounded-lg border border-green-500/50 px-3 py-1 text-xs text-green-700 hover:bg-green-500/10">
                  Restore
                </button>
              )}
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-ink-400">No categories yet.</p>}
      </div>
    </div>
  );
}
