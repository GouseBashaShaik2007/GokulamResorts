import { NextResponse } from 'next/server';

// Server-side gate for the staff surfaces. Runs before any page renders, so
// an unauthenticated hit on /admin (etc.) gets redirected to its login page
// immediately instead of the page rendering, then discovering client-side
// that there's no token and flashing blank. See app/(staff)/_lib/session.js
// for what the cookie is (and isn't) — it's a UX signal only; every API
// route still independently verifies the real JWT server-side regardless of
// this cookie.
const SECTIONS = [
  { prefix: '/admin', login: '/admin/login', cookie: 'gokulam_admin_session' },
  { prefix: '/kitchen', login: '/kitchen/login', cookie: 'gokulam_kitchen_session' },
  { prefix: '/staff', login: '/staff/login', cookie: 'gokulam_staff_session' },
  { prefix: '/frontdesk', login: '/staff/login', cookie: 'gokulam_staff_session' },
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  for (const section of SECTIONS) {
    const isLoginPage = pathname === section.login;
    const inSection = pathname === section.prefix || pathname.startsWith(`${section.prefix}/`);
    if (!isLoginPage && !inSection) continue;

    const signedIn = Boolean(request.cookies.get(section.cookie)?.value);

    if (isLoginPage && signedIn) {
      // Already signed in — skip the login screen.
      return NextResponse.redirect(new URL(section.prefix, request.url));
    }
    if (inSection && !isLoginPage && !signedIn) {
      return NextResponse.redirect(new URL(section.login, request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/kitchen/:path*', '/staff/:path*', '/frontdesk/:path*'],
};
