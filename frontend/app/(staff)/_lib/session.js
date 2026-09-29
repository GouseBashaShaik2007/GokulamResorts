// Shared helpers for the staff-side (admin / kitchen / staff / frontdesk)
// login flows. Lives inside the (staff) route group on purpose (an
// underscore-prefixed folder is invisible to the router) instead of
// frontend/lib/, which the guest-site build owns.
//
// Each section keeps its real auth token in localStorage, sent as a Bearer
// header on every API call (see lib/api.js) — that's the actual security
// boundary and is unchanged. Alongside it we set a small, non-sensitive
// "I'm signed in" marker cookie. middleware.js reads that cookie to decide
// whether to redirect to the section's login page *before* any page ever
// renders, instead of the page rendering blank and only then discovering
// (client-side, after hydration) that there's no token. The cookie carries
// no token/identity — losing or forging it only ever gets you bounced to a
// login form, never past the real API auth.

export const SESSION_COOKIES = {
  admin: 'gokulam_admin_session',
  kitchen: 'gokulam_kitchen_session',
  staff: 'gokulam_staff_session', // shared by /staff and /frontdesk
};

// Kept in rough sync with each backend token's own expiresIn so the cookie
// doesn't outlive (or expire long before) the token it's standing in for.
const MAX_AGE_SECONDS = {
  admin: 8 * 60 * 60, // JWT_EXPIRES_IN
  kitchen: 12 * 60 * 60, // KITCHEN_JWT_EXPIRES_IN
  staff: 12 * 60 * 60, // STAFF_JWT_EXPIRES_IN
};

export function markSignedIn(section) {
  if (typeof document === 'undefined') return;
  const name = SESSION_COOKIES[section];
  const maxAge = MAX_AGE_SECONDS[section];
  document.cookie = `${name}=1; path=/; max-age=${maxAge}; samesite=lax`;
}

export function clearSignedIn(section) {
  if (typeof document === 'undefined') return;
  const name = SESSION_COOKIES[section];
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}
