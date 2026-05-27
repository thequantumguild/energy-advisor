import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const PROMPT = `Extract from this utility bill and respond ONLY with valid JSON, no other text:
{
  "monthlyKwh": <average monthly kWh usage as a number, or null>,
  "annualKwh": <total annual kWh if shown, or null>,
  "ratePerKwh": <price per kWh in dollars, e.g. 0.14, or null>,
  "utilityName": <utility company name, or null>,
  "totalBillDollars": <total amount due this month as a number, or null>
}`;

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get('bill') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const isPDF   = file.type === 'application/pdf';
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (!isPDF && !isImage) {
    return NextResponse.json({ error: 'Upload a JPG, PNG, or PDF.' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const client = new Anthropic({ apiKey: key });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileBlock: any = isPDF
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: file.type,           data: base64 } };

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
  });

  const raw = (message.content[0] as Anthropic.TextBlock).text.trim();
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'Could not parse bill. Try a clearer photo or PDF.' }, { status: 422 });
  }
}
