import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.SITE_PASSWORD;

function buildPage(redirect: string, error = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Energy Advisor — Private Beta</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0f1e;
      font-family: 'Inter', system-ui, sans-serif;
      overflow: hidden;
    }

    .bg {
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(251,191,36,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 60% 40% at 80% 100%, rgba(59,130,246,0.08) 0%, transparent 60%);
      pointer-events: none;
    }

    .grid {
      position: fixed;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }

    .card {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 420px;
      padding: 48px 40px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      backdrop-filter: blur(20px);
      box-shadow: 0 25px 80px rgba(0,0,0,0.5);
    }

    .icon {
      width: 48px;
      height: 48px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon svg {
      width: 48px;
      height: 48px;
      color: #fbbf24;
      filter: drop-shadow(0 0 12px rgba(251,191,36,0.4));
    }

    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }

    .sub {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 32px;
      line-height: 1.5;
    }

    .label {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 8px;
    }

    input[type="password"] {
      width: 100%;
      padding: 14px 18px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      font-size: 15px;
      color: #f8fafc;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      margin-bottom: 14px;
      letter-spacing: 0.05em;
    }

    input[type="password"]::placeholder { color: rgba(255,255,255,0.2); letter-spacing: 0; }

    input[type="password"]:focus {
      border-color: rgba(251,191,36,0.5);
      box-shadow: 0 0 0 3px rgba(251,191,36,0.08);
    }

    button {
      width: 100%;
      padding: 14px;
      background: #fbbf24;
      color: #0a0f1e;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }

    button:hover { background: #f59e0b; }
    button:active { transform: scale(0.99); }

    .error {
      margin-top: 12px;
      font-size: 12px;
      color: #f87171;
      text-align: center;
    }

    .footer {
      margin-top: 28px;
      font-size: 11px;
      color: rgba(255,255,255,0.18);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="bg"></div>
  <div class="grid"></div>
  <div class="card">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0z" />
      </svg>
    </div>
    <h1>Energy Advisor</h1>
    <p class="sub">Private beta — by invitation only.</p>
    <form method="POST" action="/api/auth?redirect=${encodeURIComponent(redirect)}">
      <p class="label">Access code</p>
      <input type="password" name="password" placeholder="••••••••••" autofocus autocomplete="current-password" />
      <button type="submit">Enter</button>
      ${error ? '<p class="error">Incorrect code. Try again.</p>' : ''}
    </form>
    <p class="footer">The Quantum Guild</p>
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
