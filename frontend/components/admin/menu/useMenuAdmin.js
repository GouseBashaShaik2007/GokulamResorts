'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { withAdminAuth } from '@/lib/api';
import { errMsg } from '@/lib/bookingUi';
import { useToast } from '@/components/ui/Toast';

/**
 * The menu as the admin sees it (hidden categories and sold-out dishes
 * included), plus every action on it. Each action says whether it worked in a
 * toast and resolves to true/false, so a form knows whether to clear itself.
 */
export default function useMenuAdmin() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);

  // Every request goes through here: one place for the success and failure messages.
  const call = useCallback(
    async (request, { done, failed }) => {
      try {
        const res = await request();
        if (done) toast(done);
        return res;
      } catch (err) {
        toast(errMsg(err, failed), { tone: 'error' });
        return null;
      }
    },
    [toast]
  );

  const loadCategories = useCallback(async () => {
    const res = await call(() => api.get('/admin/menu/categories', withAdminAuth()), { failed: 'Could not load categories' });
    if (res) setCategories(res.data.categories);
  }, [call]);

  const loadItems = useCallback(async () => {
    const res = await call(() => api.get('/admin/menu/items', withAdminAuth()), { failed: 'Could not load menu items' });
    if (res) setItems(res.data.items);
  }, [call]);

  useEffect(() => {
    loadCategories();
    loadItems();
  }, [loadCategories, loadItems]);

  // Runs a change, then refreshes whichever lists it touches.
  const change = async (request, messages, reload) => {
    const ok = !!(await call(request, messages));
    if (ok) reload.forEach((load) => load());
    return ok;
  };

  return {
    categories,
    items,

    /** Add (no id) or update a category: { name, sortOrder }. */
    saveCategory: (id, payload) =>
      change(
        () => (id ? api.put(`/admin/menu/categories/${id}`, payload, withAdminAuth()) : api.post('/admin/menu/categories', payload, withAdminAuth())),
        { done: id ? 'Category updated.' : 'Category added.', failed: 'Could not save category' },
        [loadCategories, loadItems] // dishes carry their category's name
      ),
    hideCategory: (category) =>
      change(
        () => api.delete(`/admin/menu/categories/${category.id}`, withAdminAuth()),
        { done: `${category.name} hidden from the guest menu.`, failed: 'Could not hide that category' },
        [loadCategories]
      ),
    restoreCategory: (category) =>
      change(
        () => api.put(`/admin/menu/categories/${category.id}`, { isActive: true }, withAdminAuth()),
        { done: `${category.name} is back on the guest menu.`, failed: 'Could not restore category' },
        [loadCategories]
      ),

    /** Add (no id) or update a dish. */
    saveItem: (id, payload) =>
      change(
        () => (id ? api.put(`/admin/menu/items/${id}`, payload, withAdminAuth()) : api.post('/admin/menu/items', payload, withAdminAuth())),
        { done: id ? `${payload.name} updated.` : `${payload.name} added to the menu.`, failed: 'Could not save item' },
        [loadItems]
      ),
    markSoldOut: (item) =>
      change(
        () => api.delete(`/admin/menu/items/${item.id}`, withAdminAuth()),
        { done: `${item.name} marked sold out.`, failed: 'Could not mark that item sold out' },
        [loadItems]
      ),
    restoreItem: (item) =>
      change(
        () => api.put(`/admin/menu/items/${item.id}`, { isAvailable: true }, withAdminAuth()),
        { done: `${item.name} is back on the menu.`, failed: 'Could not put that item back on the menu' },
        [loadItems]
      ),

    /** Uploads a dish photo; resolves to its address, or null if it failed. */
    uploadPhoto: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await call(() => api.post('/admin/upload-image?type=food', formData, withAdminAuth()), { failed: 'Could not upload photo' });
      return res ? res.data.url : null;
    },
  };
}
