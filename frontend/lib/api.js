import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attaches the admin JWT (if present in localStorage) to every request.
// Safe to call from client components only.
export function withAdminAuth(config = {}) {
  if (typeof window === 'undefined') return config;
  const token = window.localStorage.getItem('gokulam_admin_token');
  if (!token) return config;
  return {
    ...config,
    headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` },
  };
}

// Same idea for the kitchen dashboard, which uses a separate shared-password
// login (not the resort admin account) and its own token.
export function withKitchenAuth(config = {}) {
  if (typeof window === 'undefined') return config;
  const token = window.localStorage.getItem('gokulam_kitchen_token');
  if (!token) return config;
  return {
    ...config,
    headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` },
  };
}

// Housekeeping staff (bedding / toiletry / inspector) — per-person logins.
export function withStaffAuth(config = {}) {
  if (typeof window === 'undefined') return config;
  const token = window.localStorage.getItem('gokulam_staff_token');
  if (!token) return config;
  return {
    ...config,
    headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` },
  };
}

// Front desk endpoints (/desk/*) accept either a manager or a FrontDesk staff token.
export const authFor = (mode) => (mode === 'admin' ? withAdminAuth : withStaffAuth);

export default api;
export { API_URL };
