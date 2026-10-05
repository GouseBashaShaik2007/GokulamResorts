/**
 * Staff sign-ins, kept in cookies the page's scripts cannot read (httpOnly).
 *
 * Each staff tool has its own cookie, so a manager, a cook and the front desk
 * can all be signed in on one device:
 *   gk_admin    the manager's screens          (/api/admin, /api/desk)
 *   gk_kitchen  the kitchen display            (/api/kitchen)
 *   gk_staff    front desk and housekeeping    (/api/staff, /api/desk)
 *
 * The cookie holds the same signed token the API always issued; it is simply
 * no longer handed to the browser's JavaScript, where an injected script could
 * have copied it.
 *
 * The browser only sends these cookies when the site and the API are on the
 * same site — the same domain or sub-domains of one (gokulamresorts.in and
 * api.gokulamresorts.in). They are sent with `SameSite=Strict`, so no other
 * website can make a signed-in request on a staff member's behalf.
 *
 *   COOKIE_DOMAIN    optional, e.g. ".gokulamresorts.in", to share the cookie
 *                    with every sub-domain. Empty: the API's own host only.
 *   COOKIE_SAMESITE  optional: strict (default) | lax | none. "none" is only
 *                    for a site and API on unrelated domains; browsers that
 *                    block third-party cookies will still refuse it.
 */
const jwt = require('jsonwebtoken');

const COOKIES = { admin: 'gk_admin', kitchen: 'gk_kitchen', staff: 'gk_staff' };

function cookieOptions() {
  const sameSite = ['strict', 'lax', 'none'].includes(String(process.env.COOKIE_SAMESITE || '').toLowerCase())
    ? process.env.COOKIE_SAMESITE.toLowerCase()
    : 'strict';
  return {
    httpOnly: true,
    // https only, except on a developer's own machine (http://localhost).
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

function readCookies(header) {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const at = part.indexOf('=');
    if (at === -1) continue;
    const name = part.slice(0, at).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(at + 1).trim());
    } catch {
      // a value that isn't valid encoding is not one of ours
    }
  }
  return cookies;
}

/** Sets the sign-in cookie; it expires when the token inside it does. */
function startSession(res, section, token) {
  const { exp } = jwt.decode(token);
  res.cookie(COOKIES[section], token, { ...cookieOptions(), maxAge: Math.max(0, exp * 1000 - Date.now()) });
}

function endSession(res, section) {
  res.clearCookie(COOKIES[section], cookieOptions());
}

// An explicit "Authorization: Bearer" header (scripts, tests) comes first.
function bearerToken(req) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/** The sign-in token for one staff tool, or null: a Bearer header, else that tool's cookie. */
function tokenFor(req, section) {
  return bearerToken(req) || readCookies(req.headers.cookie)[COOKIES[section]] || null;
}

/** For a live-update connection: `auth.section` names the tool whose cookie to use. */
function tokenForSocket(handshake) {
  const auth = handshake.auth || {};
  if (auth.token) return auth.token;
  return COOKIES[auth.section] ? readCookies(handshake.headers.cookie)[COOKIES[auth.section]] || null : null;
}

module.exports = { COOKIES, startSession, endSession, bearerToken, tokenFor, tokenForSocket, readCookies };
