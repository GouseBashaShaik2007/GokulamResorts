'use client';

import { useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import MenuManager from '../../components/admin/MenuManager';
import FoodOrdersManager from '../../components/admin/FoodOrdersManager';
import TableQrCodes from '../../components/admin/TableQrCodes';
import HousekeepingManager from '../../components/admin/HousekeepingManager';
import BookingsManager from '../../components/admin/BookingsManager';

const TOKEN_KEY = 'gokulam_admin_token';

const emptyRoomForm = {
  name: '',
  description: '',
  pricePerNight: '',
  capacity: 2,
  sizeSqft: '',
  bedType: '',
  amenities: '',
  images: '',
};

function LoginForm({ onLoggedIn }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/admin/login', form);
      window.localStorage.setItem(TOKEN_KEY, res.data.token);
      onLoggedIn(res.data.admin);
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-24 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Resort Admin</p>
        <h1 className="mt-2 font-serif text-2xl font-bold text-navy-50">Sign in</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" type="email" required className="input-field"
              value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password" type="password" required className="input-field"
              value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-navy-400">
          Default credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in the backend .env (set via{' '}
          <code className="text-gold-400">npm run db:seed</code>).
        </p>
      </div>
    </div>
  );
}

function RoomsManager() {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(emptyRoomForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadRooms = async () => {
    try {
      const res = await api.get('/admin/rooms', withAdminAuth());
      setRooms(res.data.rooms);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load rooms');
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const resetForm = () => {
    setForm(emptyRoomForm);
    setEditingId(null);
  };

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const toPayload = () => ({
    name: form.name,
    description: form.description,
    pricePerNight: Number(form.pricePerNight),
    capacity: Number(form.capacity),
    sizeSqft: form.sizeSqft ? Number(form.sizeSqft) : null,
    bedType: form.bedType || null,
    amenities: form.amenities ? form.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [],
    images: form.images ? form.images.split(',').map((s) => s.trim()).filter(Boolean) : [],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      if (editingId) {
        await api.put(`/admin/rooms/${editingId}`, toPayload(), withAdminAuth());
        setMessage('Room updated.');
      } else {
        await api.post('/admin/add-room', toPayload(), withAdminAuth());
        setMessage('Room added.');
      }
      resetForm();
      loadRooms();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save room');
    }
  };

  const startEdit = (room) => {
    setEditingId(room.id);
    setForm({
      name: room.name,
      description: room.description,
      pricePerNight: room.price_per_night,
      capacity: room.capacity,
      sizeSqft: room.size_sqft || '',
      bedType: room.bed_type || '',
      amenities: (room.amenities || []).join(', '),
      images: (room.images || []).join(', '),
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this room from public listings?')) return;
    try {
      await api.delete(`/admin/rooms/${id}`, withAdminAuth());
      loadRooms();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete room');
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">
          {editingId ? `Edit Room #${editingId}` : 'Add a New Room'}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input-field" value={form.name} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" rows={3} className="input-field" value={form.description} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price / night (₹)</label>
              <input name="pricePerNight" type="number" min="0" step="1" required className="input-field" value={form.pricePerNight} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input name="capacity" type="number" min="1" required className="input-field" value={form.capacity} onChange={handleChange} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Size (sq.ft.)</label>
              <input name="sizeSqft" type="number" min="0" className="input-field" value={form.sizeSqft} onChange={handleChange} />
            </div>
          </div>
          <div>
            <label className="label">Bed Type</label>
            <input name="bedType" className="input-field" value={form.bedType} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Amenities (comma separated)</label>
            <input name="amenities" className="input-field" value={form.amenities} onChange={handleChange} placeholder="Sea View, Free WiFi, Breakfast" />
          </div>
          <div>
            <label className="label">Image URLs (comma separated)</label>
            <input name="images" className="input-field" value={form.images} onChange={handleChange} placeholder="https://..." />
          </div>

          {message && <p className="text-sm text-green-300">{message}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" className="btn-gold flex-1">{editingId ? 'Save Changes' : 'Add Room'}</button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn-outline">Cancel</button>
            )}
          </div>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">All Rooms</h2>
        <div className="mt-4 space-y-3">
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-navy-800 p-4">
              <div>
                <p className="font-medium text-navy-50">
                  {room.name} {!room.is_active && <span className="ml-2 text-xs text-red-300">(inactive)</span>}
                </p>
                <p className="text-sm text-navy-400">
                  ₹{Number(room.price_per_night).toLocaleString('en-IN')} / night · {room.units_count} room numbers · cap {room.capacity}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(room)} className="rounded-lg border border-gold-500/50 px-3 py-1.5 text-xs text-gold-400 hover:bg-gold-500/10">
                  Edit
                </button>
                <button onClick={() => handleDelete(room.id)} className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {rooms.length === 0 && <p className="text-navy-400">No rooms yet.</p>}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('rooms');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (token) setAdmin({ loggedIn: true });
    setChecked(true);
  }, []);

  const handleLogout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setAdmin(null);
  };

  if (!checked) return null;

  if (!admin) {
    return <LoginForm onLoggedIn={(a) => setAdmin(a)} />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Resort Admin</p>
          <h1 className="section-heading mt-1">Dashboard</h1>
        </div>
        <button onClick={handleLogout} className="btn-outline">Log Out</button>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setTab('rooms')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${tab === 'rooms' ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'}`}
        >
          Manage Rooms
        </button>
        <button
          onClick={() => setTab('bookings')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${tab === 'bookings' ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'}`}
        >
          Bookings
        </button>
        <button
          onClick={() => setTab('menu')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${tab === 'menu' ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'}`}
        >
          Manage Menu
        </button>
        <button
          onClick={() => setTab('foodOrders')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${tab === 'foodOrders' ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'}`}
        >
          Food Orders
        </button>
        <button
          onClick={() => setTab('qrCodes')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${tab === 'qrCodes' ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'}`}
        >
          Table QR Codes
        </button>
        <button
          onClick={() => setTab('housekeeping')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${tab === 'housekeeping' ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'}`}
        >
          Housekeeping
        </button>
      </div>

      {tab === 'rooms' && <RoomsManager />}
      {tab === 'bookings' && <BookingsManager />}
      {tab === 'menu' && <MenuManager />}
      {tab === 'foodOrders' && <FoodOrdersManager />}
      {tab === 'qrCodes' && <TableQrCodes />}
      {tab === 'housekeeping' && <HousekeepingManager />}
    </div>
  );
}
