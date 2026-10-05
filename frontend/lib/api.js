import axios from 'axios';
import { API_URL } from './apiUrl';

// Staff sign-ins are kept by the browser in cookies this code cannot read
// (the API sets them at sign-in; see backend/src/utils/session.js).
// `withCredentials` makes the browser send them with each request, so no
// request here carries a token of its own.
//
// No default Content-Type: axios picks JSON for objects and multipart for
// FormData by itself. Forcing JSON here turned file uploads into JSON.
const api = axios.create({ baseURL: API_URL, withCredentials: true });

/**
 * The front desk screens can be used by the front desk or by a manager, and
 * one browser may hold both sign-ins. This says which one a request is made
 * as, so a check-in or a payment is recorded against the right person:
 *
 *   const auth = deskAs(mode);            // mode: 'admin' | 'desk'
 *   api.get('/desk/overview', auth());
 *   api.get('/desk/bookings', auth({ params }));
 */
const actingAs = (who) => (config = {}) => ({ ...config, headers: { ...(config.headers || {}), 'X-Desk-As': who } });
// One function per role, made once: components list `auth` in their effect
// dependencies, and a new function on every render would reload them forever.
const AS = { admin: actingAs('admin'), staff: actingAs('staff') };
export const deskAs = (mode) => (mode === 'admin' ? AS.admin : AS.staff);

export default api;
export { API_URL };
