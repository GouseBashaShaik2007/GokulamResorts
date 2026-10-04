'use client';

import { useEffect, useRef, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import useModal from '../../lib/useModal';
import { errMsg } from '../../lib/bookingUi';
import { useToast } from '@/components/ui/Toast';

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

// --- Image drag-and-drop upload, with reordering and a cover choice -------

function ImageUploader({ images, onChange, error, setError }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList).filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        // eslint-disable-next-line no-await-in-loop -- sequential keeps upload order == drop order
        const res = await api.post('/admin/upload-image?type=room', formData, withAdminAuth());
        uploaded.push(res.data.url);
      }
      onChange([...images, ...uploaded]);
    } catch (err) {
      setError(errMsg(err, 'Could not upload one or more photos'));
    } finally {
      setUploading(false);
    }
  };

  const move = (index, delta) => {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const makeCover = (index) => {
    if (index === 0) return;
    const next = [...images];
    const [photo] = next.splice(index, 1);
    next.unshift(photo);
    onChange(next);
  };

  const removeAt = (index) => onChange(images.filter((_, i) => i !== index));

  return (
    <div>
      <label className="label">Photos</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm transition ${
          dragOver ? 'border-gold-400 bg-gold-500/10 text-gold-700' : 'border-navy-600 text-navy-400 hover:border-navy-500'
        }`}
      >
        {uploading ? 'Uploading…' : 'Drag photos here, or click to choose files (JPG, PNG, WEBP)'}
        <input
          ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
          className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((url, i) => (
            <div key={url} className={`relative overflow-hidden rounded-lg border ${i === 0 ? 'border-gold-400 ring-1 ring-gold-400' : 'border-navy-700'}`}>
              <img src={url} alt="" className="h-20 w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-ocean-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Cover</span>
              )}
              {/* Always visible: a hover-only bar can't be reached on a tablet. */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/65 px-1 py-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`} className="px-1 text-xs text-white disabled:opacity-30">◀</button>
                {i !== 0 && (
                  <button type="button" onClick={() => makeCover(i)} className="px-1 text-[10px] text-gold-200 underline">cover</button>
                )}
                <button type="button" onClick={() => removeAt(i)} aria-label={`Remove photo ${i + 1}`} className="px-1 text-xs text-red-300">✕</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label={`Move photo ${i + 1} later`} className="px-1 text-xs text-white disabled:opacity-30">▶</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Slide-over add/edit panel ---------------------------------------------

function RoomFormPanel({ open, onClose, editingRoom, onSaved }) {
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
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-navy-400 hover:bg-navy-800 hover:text-navy-100">✕</button>
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

// --- Delete: overflow menu + type-the-name confirmation ---------------------

function DeleteRoomDialog({ room, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const matches = confirmText.trim() === room.name;
  const dialogRef = useModal(true, onClose);
  const toast = useToast();

  const submit = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/admin/rooms/${room.id}`, withAdminAuth());
      onDeleted();
      onClose();
      toast(`${room.name} removed from the site`);
    } catch (err) {
      setError(errMsg(err, 'Could not delete room'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-label={`Remove ${room.name}`} tabIndex={-1} className="w-full max-w-md rounded-2xl border border-red-500/30 bg-navy-950 p-6 focus:outline-none">
        <h2 className="font-serif text-lg font-bold text-navy-50">Remove &quot;{room.name}&quot;?</h2>
        <p className="mt-2 text-sm text-navy-300">
          This removes it from public listings. Past bookings for this room type are kept. Type the room name to
          confirm.
        </p>
        <input
          autoFocus
          className="input-field mt-3"
          placeholder={room.name}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button
            onClick={submit}
            disabled={!matches || deleting}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: '#B42318' }}
          >
            {deleting ? 'Removing…' : 'Remove Room'}
          </button>
          <button onClick={onClose} className="btn-outline">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function RoomRowMenu({ room, onEdit, onRequestDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg border border-navy-700 px-2.5 py-1.5 text-sm text-navy-300 hover:bg-navy-800" aria-label="Room actions">
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-navy-700 bg-navy-900 py-1 shadow-lg">
            <button onClick={() => { setOpen(false); onEdit(); }} className="block w-full px-4 py-2 text-left text-sm text-navy-200 hover:bg-navy-800">
              Edit
            </button>
            <button
              onClick={() => { setOpen(false); onRequestDelete(); }}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-navy-800"
              style={{ color: '#B42318' }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Main: list-first view ---------------------------------------------

export default function RoomsManager() {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deletingRoom, setDeletingRoom] = useState(null);

  const loadRooms = async () => {
    try {
      const res = await api.get('/admin/rooms', withAdminAuth());
      setRooms(res.data.rooms);
    } catch (err) {
      setError(errMsg(err, 'Failed to load rooms'));
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const openAdd = () => {
    setEditingRoom(null);
    setPanelOpen(true);
  };
  const openEdit = (room) => {
    setEditingRoom(room);
    setPanelOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-navy-400">{rooms.length} room type{rooms.length === 1 ? '' : 's'}</p>
        <button onClick={openAdd} className="btn-gold px-4 py-2 text-sm">+ Add room</button>
      </div>

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

      <div className="space-y-3">
        {rooms.map((room) => (
          <div key={room.id} className="flex items-center gap-4 rounded-xl border border-navy-700 bg-navy-900 p-4">
            {room.images?.[0] ? (
              <img src={room.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-navy-600 text-[10px] text-navy-500">
                No photo
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-navy-50">
                {room.name} {!room.is_active && <span className="ml-2 text-xs text-red-700">(inactive)</span>}
              </p>
              <p className="text-sm text-navy-400">
                ₹{Number(room.price_per_night).toLocaleString('en-IN')} / night · {room.units_count} room{room.units_count === 1 ? '' : 's'} · Up to {room.capacity} guests
              </p>
            </div>
            <button onClick={() => openEdit(room)} className="rounded-lg border border-gold-500/50 px-3 py-1.5 text-xs text-gold-600 hover:bg-gold-500/10">
              Edit
            </button>
            <RoomRowMenu room={room} onEdit={() => openEdit(room)} onRequestDelete={() => setDeletingRoom(room)} />
          </div>
        ))}
        {rooms.length === 0 && <p className="text-navy-400">No rooms yet — add your first one.</p>}
      </div>

      <RoomFormPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        editingRoom={editingRoom}
        onSaved={loadRooms}
      />

      {deletingRoom && (
        <DeleteRoomDialog room={deletingRoom} onClose={() => setDeletingRoom(null)} onDeleted={loadRooms} />
      )}
    </div>
  );
}
