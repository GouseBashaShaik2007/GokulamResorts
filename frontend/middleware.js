import { NextResponse } from 'next/server';

// Server-side gate for the staff surfaces. Runs before any page renders, so
// someone who isn't signed in and opens /admin (etc.) is sent to its login
// page at once, instead of the page rendering empty and only then finding
// out. See app/(staff)/_lib/session.js for what the marker cookie is (and
// isn't) — a convenience only; the real sign-in is a separate cookie that the
// API checks on every request, whatever this marker says.
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
