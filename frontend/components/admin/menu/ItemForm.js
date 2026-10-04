'use client';

import { useState } from 'react';
import VegMark from '@/components/ui/VegMark';
import { ALLERGENS, SPICE_RATING_LABEL } from '@/lib/foodOrders';

const emptyForm = {
  categoryId: '',
  name: '',
  description: '',
  price: '',
  image: '',
  isVeg: true,
  isJain: false,
  spiceAdjustable: false,
  spiceRating: 0,
  allergens: [],
};

const formFor = (item) =>
  item
    ? {
        categoryId: item.category_id,
        name: item.name,
        description: item.description || '',
        price: item.price,
        image: item.image || '',
        isVeg: item.is_veg,
        isJain: item.is_jain || false,
        spiceAdjustable: item.spice_adjustable || false,
        spiceRating: item.spice_rating || 0,
        allergens: item.allergens || [],
      }
    : emptyForm;

/**
 * Add a dish, or edit `item`. Give it key={item?.id ?? 'new'} so the fields
 * start fresh whenever a different dish is opened.
 */
export default function ItemForm({ item, categories, onSave, onCancel, uploadPhoto }) {
  const [form, setForm] = useState(() => formFor(item));
  const [uploading, setUploading] = useState(false);

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleAllergen = (value) =>
    setForm((p) => ({ ...p, allergens: p.allergens.includes(value) ? p.allergens.filter((a) => a !== value) : [...p.allergens, value] }));

  const submit = async (e) => {
    e.preventDefault();
    const saved = await onSave(item?.id, {
      categoryId: Number(form.categoryId),
      name: form.name,
      description: form.description,
      price: Number(form.price),
      image: form.image || null,
      isVeg: form.isVeg,
      isJain: form.isJain,
      spiceAdjustable: form.spiceAdjustable,
      spiceRating: Number(form.spiceRating),
      allergens: form.allergens,
    });
    if (saved && !item) setForm(emptyForm);
  };

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadPhoto(file);
    if (url) setForm((p) => ({ ...p, image: url }));
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div className="card p-6">
      <h2 className="font-serif text-xl font-bold text-navy-50">{item ? `Edit: ${item.name}` : 'Add a Menu Item'}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="dish-category">Category</label>
          <select id="dish-category" name="categoryId" required className="input-field" value={form.categoryId} onChange={change}>
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dish-name">Name</label>
          <input id="dish-name" name="name" required className="input-field" value={form.name} onChange={change} />
        </div>
        <div>
          <label className="label" htmlFor="dish-description">Description</label>
          <textarea id="dish-description" name="description" rows={2} className="input-field" value={form.description} onChange={change} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="dish-price">Price (₹)</label>
            <input id="dish-price" name="price" type="number" min="0" step="1" required className="input-field" value={form.price} onChange={change} />
          </div>
          <div>
            <label className="label" htmlFor="dish-spice">How spicy it is</label>
            <select id="dish-spice" name="spiceRating" className="input-field" value={form.spiceRating} onChange={change}>
              <option value={0}>Not spicy / don&apos;t show</option>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{SPICE_RATING_LABEL[n]}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="label">Diet</legend>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-navy-200">
            <div className="inline-flex overflow-hidden rounded-lg border border-navy-600">
              {[
                { veg: true, label: 'Veg' },
                { veg: false, label: 'Non-veg' },
              ].map((option) => (
                <label
                  key={option.label}
                  className={`flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ocean-400 ${
                    form.isVeg === option.veg ? 'bg-navy-700 text-navy-50' : 'bg-white text-navy-300'
                  }`}
                >
                  <input
                    type="radio" name="dishDiet" className="sr-only" checked={form.isVeg === option.veg}
                    // A dish that isn't vegetarian can't be Jain.
                    onChange={() => setForm((p) => ({ ...p, isVeg: option.veg, isJain: option.veg ? p.isJain : false }))}
                  />
                  <VegMark veg={option.veg} />
                  {option.label}
                </label>
              ))}
            </div>
            <label className={`flex items-center gap-2 ${form.isVeg ? '' : 'text-navy-400'}`}>
              <input name="isJain" type="checkbox" checked={form.isJain} disabled={!form.isVeg} onChange={change} />
              Jain (no onion, garlic or root vegetables)
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Contains</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-navy-200">
            {ALLERGENS.map((a) => (
              <label key={a.value} className="flex items-center gap-2">
                <input type="checkbox" checked={form.allergens.includes(a.value)} onChange={() => toggleAllergen(a.value)} />
                {a.label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-navy-400">Guests see these on the menu, e.g. “Contains nuts, dairy”. Tick everything the dish is cooked with.</p>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-navy-200">
          <input name="spiceAdjustable" type="checkbox" checked={form.spiceAdjustable} onChange={change} />
          Let guests choose the spice level (Mild / Medium / Hot) when ordering
        </label>

        <div>
          <label className="label" htmlFor="dish-photo">Photo</label>
          <div className="flex items-center gap-4">
            {form.image ? (
              <img src={form.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-navy-600 text-xs text-navy-400">None</div>
            )}
            <div className="flex-1">
              <input
                id="dish-photo"
                type="file" accept="image/jpeg,image/png,image/webp"
                onChange={pickPhoto} disabled={uploading}
                className="block w-full text-sm text-navy-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ocean-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ocean-600"
              />
              {uploading && <p className="mt-1 text-xs text-navy-400" role="status">Uploading…</p>}
              {form.image && !uploading && (
                <button type="button" onClick={() => setForm((p) => ({ ...p, image: '' }))} className="mt-1 text-xs text-red-700 hover:underline">
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={uploading} className="btn-gold flex-1 disabled:opacity-60">{item ? 'Save Changes' : 'Add Item'}</button>
          {item && <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>}
        </div>
      </form>
    </div>
  );
}
