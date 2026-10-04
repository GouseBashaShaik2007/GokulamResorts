'use client';

import { useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../../lib/api';
import useModal from '../../../lib/useModal';
import { errMsg } from '../../../lib/bookingUi';
import { useToast } from '@/components/ui/Toast';
import ImageUploader from './ImageUploader';

// Offered as one-tap choices so the same amenity is worded the same on every room.
const STANDARD_AMENITIES = [
  'Air Conditioning', 'Free WiFi', 'Breakfast Included', 'Sea View', 'Garden View', 'Private Balcony',
  'TV', 'Mini Fridge', 'Hot Water', 'Tea / Coffee Maker', 'Room Service', 'Power Backup',
];

// Amenities are edited as one comma-separated line; these read and change it.
const parseAmenities = (text) => String(text || '').split(',').map((a) => a.trim()).filter(Boolean);
const sameAmenity = (a, b) => a.toLowerCase() === b.toLowerCase();
const hasAmenity = (text, name) => parseAmenities(text).some((a) => sameAmenity(a, name));
const toggleAmenity = (text, name) => {
  const list = parseAmenities(text);
  return (hasAmenity(text, name) ? list.filter((a) => !sameAmenity(a, name)) : [...list, name]).join(', ');
};

const emptyForm = {
  name: '',
  description: '',
  pricePerNight: '',
  capacity: 2,
  sizeSqft: '',
  bedType: '',
  amenities: '',
  images: [],
};

/** Slide-over to add a room type, or edit `editingRoom`. */
export default function RoomFormPanel({ open, onClose, editingRoom, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const panelRef = useModal(open, onClose);

  useEffect(() => {
    if (!open) return;
    setError('');
    setImageError('');
    if (editingRoom) {
      setForm({
        name: editingRoom.name,
        description: editingRoom.description,
        pricePerNight: editingRoom.price_per_night,
        capacity: editingRoom.capacity,
        sizeSqft: editingRoom.size_sqft || '',
        bedType: editingRoom.bed_type || '',
        amenities: (editingRoom.amenities || []).join(', '),
        images: editingRoom.images || [],
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, editingRoom]);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const toPayload = () => ({
    name: form.name,
    description: form.description,
    pricePerNight: Number(form.pricePerNight),
    capacity: Number(form.capacity),
    sizeSqft: form.sizeSqft ? Number(form.sizeSqft) : null,
    bedType: form.bedType || null,
    amenities: parseAmenities(form.amenities),
    images: form.images,
  });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingRoom) {
        await api.put(`/admin/rooms/${editingRoom.id}`, toPayload(), withAdminAuth());
      } else {
        await api.post('/admin/add-room', toPayload(), withAdminAuth());
      }
      onSaved();
      onClose();
      toast(editingRoom ? 'Room saved' : 'Room added');
    } catch (err) {
      setError(errMsg(err, 'Could not save room'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={editingRoom ? `Edit ${editingRoom.name}` : 'Add a new room'}
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-navy-700 bg-navy-950 p-6 shadow-2xl focus:outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-navy-50">{editingRoom ? `Edit ${editingRoom.name}` : 'Add a New Room'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-navy-400 hover:bg-navy-800 hover:text-navy-100">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input aria-label="Name" name="name" required className="input-field" value={form.name} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea aria-label="Description" name="description" rows={3} className="input-field" value={form.description} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price / night (₹)</label>
              <input aria-label="Price / night (₹)" name="pricePerNight" type="number" min="0" step="1" required className="input-field" value={form.pricePerNight} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Max guests</label>
              <input aria-label="Max guests" name="capacity" type="number" min="1" required className="input-field" value={form.capacity} onChange={handleChange} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Size (sq.ft.)</label>
              <input aria-label="Size (sq.ft.)" name="sizeSqft" type="number" min="0" className="input-field" value={form.sizeSqft} onChange={handleChange} />
            </div>
          </div>
          <div>
            <label className="label">Bed Type</label>
            <input aria-label="Bed Type" name="bedType" className="input-field" value={form.bedType} onChange={handleChange} />
          </div>
          <fieldset>
            <legend className="label">Amenities</legend>
            {/* Tapping a standard one keeps the wording the same across rooms ("Free WiFi", not "wifi" / "Wi-Fi"). */}
            <div className="flex flex-wrap gap-2">
              {STANDARD_AMENITIES.map((name) => {
                const on = hasAmenity(form.amenities, name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setForm((p) => ({ ...p, amenities: toggleAmenity(p.amenities, name) }))}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-navy-700 text-navy-200 hover:border-ocean-300'}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <input
              aria-label="All amenities, comma separated"
              name="amenities"
              className="input-field mt-3"
              value={form.amenities}
              onChange={handleChange}
              placeholder="Add any others, separated by commas"
            />
            <p className="mt-1 text-xs text-navy-400">Shown to guests on the room page, in this order.</p>
          </fieldset>

          <ImageUploader
            images={form.images}
            onChange={(images) => setForm((p) => ({ ...p, images }))}
            error={imageError}
            setError={setImageError}
          />

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-gold flex-1 disabled:opacity-60">
              {saving ? 'Saving…' : editingRoom ? 'Save Changes' : 'Add Room'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </>
  );
}
