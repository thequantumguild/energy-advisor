import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.SITE_PASSWORD;

function buildPage(redirect: string, error = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Private — Energy Advocate</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
      background-color: #0a0a0a;
    }

    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
      padding: 24px;
      width: 100%;
    }

    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 40px 44px 36px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    }

    .card-icon {
      font-size: 40px;
      margin-bottom: 16px;
      display: block;
      line-height: 1;
    }

    .card-title {
      font-weight: 900;
      font-size: 28px;
      color: #0a0a0a;
      letter-spacing: -0.03em;
      line-height: 1;
      margin-bottom: 6px;
    }

    .card-sub {
      font-size: 13px;
      font-weight: 400;
      color: #888;
      margin-bottom: 28px;
      letter-spacing: 0;
    }

    .divider {
      border: none;
      border-top: 1px solid #e8e8e8;
      margin: 0 0 24px;
    }

    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      background: #f5f5f5;
      border: 1.5px solid transparent;
      border-radius: 8px;
      font-size: 15px;
      color: #0a0a0a;
      outline: none;
      font-family: 'Inter', system-ui, sans-serif;
      transition: border-color 0.15s, background 0.15s;
      margin-bottom: 10px;
    }

    input[type="password"]::placeholder {
      color: #aaa;
      font-style: italic;
    }

    input[type="password"]:focus {
      border-color: #0a0a0a;
      background: #fff;
    }

    button {
      width: 100%;
      padding: 12px;
      background: #0a0a0a;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      transition: background 0.15s;
    }

    button:hover { background: #222; }

    .error {
      font-size: 12px;
      color: #cc3333;
      margin-top: 10px;
      font-style: italic;
    }

    .tagline {
      font-size: 10px;
      font-weight: 500;
      color: rgba(255,255,255,0.2);
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <span class="card-icon">🚫</span>
      <p class="card-title">No Soliciting</p>
      <p class="card-sub">Leave the pitch at the door.</p>
      <hr class="divider" />
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

  const dest = new URL(redirect, request.url).toString();
  const response = new NextResponse(
    `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${dest}" /><script>window.location.replace(${JSON.stringify(dest)})</script></head><body></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
  response.cookies.set('site-auth', PASSWORD, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
