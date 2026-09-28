'use client';

import { useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';

const emptyCategoryForm = { name: '', sortOrder: 0 };
const emptyItemForm = { categoryId: '', name: '', description: '', price: '', image: '', isVeg: true };

export default function MenuManager() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadCategories = async () => {
    try {
      const res = await api.get('/admin/menu/categories', withAdminAuth());
      setCategories(res.data.categories);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load categories');
    }
  };

  const loadItems = async () => {
    try {
      const res = await api.get('/admin/menu/items', withAdminAuth());
      setItems(res.data.items);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load menu items');
    }
  };

  useEffect(() => {
    loadCategories();
    loadItems();
  }, []);

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategoryForm);
    setEditingCategoryId(null);
  };

  const startEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryForm({ name: category.name, sortOrder: category.sort_order });
  };

  const handleSubmitCategory = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const payload = { name: categoryForm.name, sortOrder: Number(categoryForm.sortOrder) || 0 };
      if (editingCategoryId) {
        await api.put(`/admin/menu/categories/${editingCategoryId}`, payload, withAdminAuth());
        setMessage('Category updated.');
      } else {
        await api.post('/admin/menu/categories', payload, withAdminAuth());
        setMessage('Category added.');
      }
      resetCategoryForm();
      loadCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Remove this category from the menu?')) return;
    try {
      await api.delete(`/admin/menu/categories/${id}`, withAdminAuth());
      loadCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete category');
    }
  };

  const handleReactivateCategory = async (id) => {
    try {
      await api.put(`/admin/menu/categories/${id}`, { isActive: true }, withAdminAuth());
      loadCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not restore category');
    }
  };

  const itemToPayload = () => ({
    categoryId: Number(itemForm.categoryId),
    name: itemForm.name,
    description: itemForm.description,
    price: Number(itemForm.price),
    image: itemForm.image || null,
    isVeg: itemForm.isVeg,
  });

  const handleItemChange = (e) => {
    const { name, value, type, checked } = e.target;
    setItemForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const resetItemForm = () => {
    setItemForm(emptyItemForm);
    setEditingItemId(null);
  };

  const handleSubmitItem = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      if (editingItemId) {
        await api.put(`/admin/menu/items/${editingItemId}`, itemToPayload(), withAdminAuth());
        setMessage('Item updated.');
      } else {
        await api.post('/admin/menu/items', itemToPayload(), withAdminAuth());
        setMessage('Item added.');
      }
      resetItemForm();
      loadItems();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save item');
    }
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setItemForm({
      categoryId: item.category_id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      image: item.image || '',
      isVeg: item.is_veg,
    });
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Remove this item from the menu?')) return;
    try {
      await api.delete(`/admin/menu/items/${id}`, withAdminAuth());
      loadItems();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete item');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/admin/upload-image?type=food', formData, withAdminAuth());
      setItemForm((p) => ({ ...p, image: res.data.url }));
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not upload photo');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRestoreItem = async (id) => {
    try {
      await api.put(`/admin/menu/items/${id}`, { isAvailable: true }, withAdminAuth());
      loadItems();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not restore item');
    }
  };

  return (
    <div className="space-y-8">
      {message && <p className="text-sm text-green-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-serif text-xl font-bold text-navy-50">
            {editingCategoryId ? `Edit Category #${editingCategoryId}` : 'Categories'}
          </h2>
          <form onSubmit={handleSubmitCategory} className="mt-4 flex gap-3">
            <input
              className="input-field" placeholder="Category name" required
              value={categoryForm.name}
              onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              type="number" className="input-field w-24" placeholder="Order"
              value={categoryForm.sortOrder}
              onChange={(e) => setCategoryForm((p) => ({ ...p, sortOrder: e.target.value }))}
            />
            <button type="submit" className="btn-gold px-4">{editingCategoryId ? 'Save' : 'Add'}</button>
            {editingCategoryId && (
              <button type="button" onClick={resetCategoryForm} className="btn-outline px-4">Cancel</button>
            )}
          </form>
          <div className="mt-4 space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-navy-800 p-3">
                <span className="text-navy-50">
                  {c.name} {!c.is_active && <span className="ml-2 text-xs text-red-300">(inactive)</span>}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditCategory(c)}
                    className="rounded-lg border border-gold-500/50 px-3 py-1 text-xs text-gold-400 hover:bg-gold-500/10"
                  >
                    Edit
                  </button>
                  {c.is_active ? (
                    <button
                      onClick={() => handleDeleteCategory(c.id)}
                      className="rounded-lg border border-red-500/50 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivateCategory(c.id)}
                      className="rounded-lg border border-green-500/50 px-3 py-1 text-xs text-green-300 hover:bg-green-500/10"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
            {categories.length === 0 && <p className="text-navy-400">No categories yet.</p>}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-serif text-xl font-bold text-navy-50">
            {editingItemId ? `Edit Item #${editingItemId}` : 'Add a Menu Item'}
          </h2>
          <form onSubmit={handleSubmitItem} className="mt-4 space-y-4">
            <div>
              <label className="label">Category</label>
              <select
                name="categoryId" required className="input-field"
                value={itemForm.categoryId} onChange={handleItemChange}
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Name</label>
              <input name="name" required className="input-field" value={itemForm.name} onChange={handleItemChange} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea name="description" rows={2} className="input-field" value={itemForm.description} onChange={handleItemChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Price (₹)</label>
                <input name="price" type="number" min="0" step="1" required className="input-field" value={itemForm.price} onChange={handleItemChange} />
              </div>
              <div className="flex items-end gap-2 pb-3">
                <input id="isVeg" name="isVeg" type="checkbox" checked={itemForm.isVeg} onChange={handleItemChange} />
                <label htmlFor="isVeg" className="text-sm text-navy-200">Vegetarian</label>
              </div>
            </div>
            <div>
              <label className="label">Photo</label>
              <div className="flex items-center gap-4">
                {itemForm.image ? (
                  <img src={itemForm.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-navy-600 text-xs text-navy-500">
                    None
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload} disabled={uploadingImage}
                    className="block w-full text-sm text-navy-300 file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy-950 hover:file:bg-gold-400"
                  />
                  {uploadingImage && <p className="mt-1 text-xs text-navy-400">Uploading...</p>}
                  {itemForm.image && !uploadingImage && (
                    <button
                      type="button"
                      onClick={() => setItemForm((p) => ({ ...p, image: '' }))}
                      className="mt-1 text-xs text-red-300 hover:underline"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-gold flex-1">{editingItemId ? 'Save Changes' : 'Add Item'}</button>
              {editingItemId && (
                <button type="button" onClick={resetItemForm} className="btn-outline">Cancel</button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">All Menu Items</h2>
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-navy-800 p-4">
              <div className="flex items-center gap-3">
                {item.image ? (
                  <img src={item.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-navy-600 text-[10px] text-navy-500">
                    No photo
                  </div>
                )}
                <div>
                  <p className="font-medium text-navy-50">
                    {item.name} {!item.is_available && <span className="ml-2 text-xs text-red-300">(unavailable)</span>}
                  </p>
                  <p className="text-sm text-navy-400">
                    {item.category_name} · ₹{Number(item.price).toLocaleString('en-IN')} · {item.is_veg ? 'Veg' : 'Non-Veg'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEditItem(item)} className="rounded-lg border border-gold-500/50 px-3 py-1.5 text-xs text-gold-400 hover:bg-gold-500/10">
                  Edit
                </button>
                {item.is_available ? (
                  <button onClick={() => handleDeleteItem(item.id)} className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                    Delete
                  </button>
                ) : (
                  <button onClick={() => handleRestoreItem(item.id)} className="rounded-lg border border-green-500/50 px-3 py-1.5 text-xs text-green-300 hover:bg-green-500/10">
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-navy-400">No menu items yet.</p>}
        </div>
      </div>
    </div>
  );
}
