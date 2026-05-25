import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.SITE_PASSWORD;

function buildPage(redirect: string, error = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Private — Energy Advisor</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@300;400&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
      background-color: #1c2128;
      background-image:
        radial-gradient(ellipse 120% 80% at 50% 0%, rgba(120,140,160,0.18) 0%, transparent 60%),
        radial-gradient(ellipse 80% 60% at 20% 100%, rgba(60,80,100,0.2) 0%, transparent 50%),
        radial-gradient(ellipse 60% 40% at 80% 80%, rgba(80,100,120,0.15) 0%, transparent 50%);
      overflow: hidden;
    }

    /* Fog layers */
    .fog {
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(ellipse 200% 30% at 50% 100%, rgba(200,210,220,0.06) 0%, transparent 60%),
        radial-gradient(ellipse 150% 20% at 30% 85%, rgba(180,200,215,0.05) 0%, transparent 50%);
    }

    /* Subtle wave texture */
    .texture {
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.03;
      background-image: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255,255,255,1) 2px,
        rgba(255,255,255,1) 3px
      );
    }

    .container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 24px;
    }

    /* The sign */
    .sign {
      position: relative;
      background: #f5f0e8;
      border: 3px solid #8b7355;
      border-radius: 4px;
      padding: 36px 48px 32px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow:
        0 4px 0 #6b5635,
        0 8px 32px rgba(0,0,0,0.5),
        inset 0 1px 0 rgba(255,255,255,0.6),
        inset 0 -1px 0 rgba(0,0,0,0.1);
    }

    /* Wood grain effect */
    .sign::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 2px;
      background: repeating-linear-gradient(
        92deg,
        transparent,
        transparent 8px,
        rgba(139,115,85,0.06) 8px,
        rgba(139,115,85,0.06) 9px
      );
      pointer-events: none;
    }

    /* Nail dots */
    .sign::after {
      content: '· ·';
      position: absolute;
      top: 10px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 20px;
      color: #8b7355;
      letter-spacing: 280px;
      opacity: 0.5;
    }

    .sign-icon {
      font-size: 36px;
      margin-bottom: 8px;
      display: block;
    }

    .sign-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: 700;
      font-size: 26px;
      color: #2c1810;
      letter-spacing: -0.01em;
      line-height: 1.1;
      margin-bottom: 4px;
    }

    .sign-sub {
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: 13px;
      color: #6b5635;
      margin-bottom: 24px;
      letter-spacing: 0.02em;
    }

    .sign hr {
      border: none;
      border-top: 1px solid #c4a882;
      margin: 0 -8px 24px;
    }

    input[type="password"] {
      width: 100%;
      padding: 11px 16px;
      background: rgba(255,255,255,0.7);
      border: 1.5px solid #c4a882;
      border-radius: 4px;
      font-size: 15px;
      color: #2c1810;
      outline: none;
      font-family: 'Inter', system-ui, sans-serif;
      transition: border-color 0.2s, box-shadow 0.2s;
      margin-bottom: 12px;
      letter-spacing: 0.05em;
    }

    input[type="password"]::placeholder {
      color: #b09a7a;
      letter-spacing: 0;
      font-style: italic;
    }

    input[type="password"]:focus {
      border-color: #8b7355;
      box-shadow: 0 0 0 3px rgba(139,115,85,0.12);
      background: rgba(255,255,255,0.9);
    }

    button {
      width: 100%;
      padding: 11px;
      background: #2c1810;
      color: #f5f0e8;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      transition: background 0.2s;
    }

    button:hover { background: #3d2418; }

    .error {
      font-size: 12px;
      color: #8b2020;
      margin-top: 10px;
      font-style: italic;
    }

    .tagline {
      font-size: 11px;
      color: rgba(200,210,220,0.35);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="fog"></div>
  <div class="texture"></div>
  <div class="container">
    <div class="sign">
      <span class="sign-icon">🚫</span>
      <p class="sign-title">No Soliciting</p>
      <p class="sign-sub">Private access only</p>
      <hr />
      <form method="POST" action="/api/auth?redirect=${encodeURIComponent(redirect)}">
        <input type="password" name="password" placeholder="knock knock..." autofocus autocomplete="current-password" />
        <button type="submit">Enter</button>
        ${error ? '<p class="error">Wrong password. Try again.</p>' : ''}
      </form>
    </div>
    <p class="tagline">The Quantum Guild</p>
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get('redirect') || '/';
  return new NextResponse(buildPage(redirect), { headers: { 'Content-Type': 'text/html' } });
}

export async function POST(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get('redirect') || '/';
  const form = await request.formData();
  const password = form.get('password')?.toString();

  if (!PASSWORD || password !== PASSWORD) {
    return new NextResponse(buildPage(redirect, true), { headers: { 'Content-Type': 'text/html' } });
  }

  const response = NextResponse.redirect(new URL(redirect, request.url));
  response.cookies.set('site-auth', PASSWORD, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
