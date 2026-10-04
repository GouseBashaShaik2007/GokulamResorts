import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Where each staff tool keeps its login token in localStorage.
export const TOKEN_KEYS = {
  admin: 'gokulam_admin_token',
  kitchen: 'gokulam_kitchen_token', // per-cook PIN login, separate from the admin account
  staff: 'gokulam_staff_token', // front desk and housekeeping (bedding / toiletry / inspector)
};

// Builds a helper that adds that tool's token to a request config:
//   api.get('/admin/rooms', withAdminAuth())
// Client components only; on the server it returns the config untouched.
const withToken = (tokenKey) => (config = {}) => {
  if (typeof window === 'undefined') return config;
  const token = window.localStorage.getItem(tokenKey);
  if (!token) return config;
  return {
    ...config,
    headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` },
  };
};

export const withAdminAuth = withToken(TOKEN_KEYS.admin);
export const withKitchenAuth = withToken(TOKEN_KEYS.kitchen);
export const withStaffAuth = withToken(TOKEN_KEYS.staff);

// Front desk endpoints (/desk/*) accept either a manager or a FrontDesk staff token.
export const authFor = (mode) => (mode === 'admin' ? withAdminAuth : withStaffAuth);

export default api;
export { API_URL };
