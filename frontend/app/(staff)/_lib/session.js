// Shared helpers for the staff-side (admin / kitchen / staff / frontdesk)
// sign-in flows. Lives inside the (staff) route group on purpose (an
// underscore-prefixed folder is invisible to the router) instead of
// frontend/lib/, which the guest-site build owns.
//
// The real sign-in is a cookie the API sets, which this code cannot read
// (httpOnly) — that is the security boundary; every API route checks it.
// Alongside it the page sets a small, non-sensitive "I'm signed in" marker
// cookie on the site's own address. middleware.js reads that marker to send
// someone who isn't signed in to the login page *before* any page renders,
// instead of the page rendering empty and only then finding out. The marker
// carries no identity — losing or forging it only ever gets you bounced to a
// login form, never past the API's own check.

export const SESSION_COOKIES = {
  admin: 'gokulam_admin_session',
  kitchen: 'gokulam_kitchen_session',
  staff: 'gokulam_staff_session', // shared by /staff and /frontdesk
};

// Kept in rough sync with how long each sign-in lasts on the API, so the
// marker doesn't outlive (or expire long before) the sign-in it stands for.
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
