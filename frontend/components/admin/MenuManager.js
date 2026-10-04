'use client';

import { useState } from 'react';
import useMenuAdmin from './menu/useMenuAdmin';
import CategoryPanel from './menu/CategoryPanel';
import ItemForm from './menu/ItemForm';
import ItemList from './menu/ItemList';

/** Admin → Menu: categories, the dish form, and the list of every dish. */
export default function MenuManager() {
  const menu = useMenuAdmin();
  const [editingItem, setEditingItem] = useState(null);

  const saveItem = async (id, payload) => {
    const saved = await menu.saveItem(id, payload);
    if (saved) setEditingItem(null);
    return saved;
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <CategoryPanel categories={menu.categories} onSave={menu.saveCategory} onHide={menu.hideCategory} onRestore={menu.restoreCategory} />
        <div id="dish-form" className="scroll-mt-24">
          <ItemForm
            key={editingItem?.id ?? 'new'}
            item={editingItem}
            categories={menu.categories}
            onSave={saveItem}
            onCancel={() => setEditingItem(null)}
            uploadPhoto={menu.uploadPhoto}
          />
        </div>
      </div>

      <ItemList
        items={menu.items}
        onEdit={(item) => {
          setEditingItem(item);
          // The form is above the list; bring it into view.
          document.getElementById('dish-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onSoldOut={menu.markSoldOut}
        onRestore={menu.restoreItem}
      />
    </div>
  );
}
