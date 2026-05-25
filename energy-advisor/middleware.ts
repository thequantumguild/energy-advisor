import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.SITE_PASSWORD;

export function middleware(request: NextRequest) {
  if (!PASSWORD) return NextResponse.next();

  const auth = request.cookies.get('site-auth')?.value;
  if (auth === PASSWORD) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/auth')) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/api/auth';
  url.searchParams.set('redirect', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
