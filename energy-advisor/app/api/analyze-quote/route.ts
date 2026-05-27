import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const LBNL_LOW = 2.70;
const LBNL_HIGH = 3.50;

const PROMPT = `You are an expert solar industry analyst reviewing a homeowner's installer quote.

Extract and return ONLY valid JSON with this exact structure (use null for any field not found):
{
  "systemKw": <system size in kW as number>,
  "totalPriceDollars": <total price before incentives as number>,
  "pricePerWatt": <calculated or stated $/W as number>,
  "panelBrand": <panel manufacturer name>,
  "panelModel": <panel model>,
  "panelWatts": <individual panel wattage as number>,
  "inverterBrand": <inverter brand>,
  "inverterModel": <inverter model>,
  "panelWarrantyYears": <panel product warranty in years as number>,
  "performanceWarrantyYears": <panel power output warranty in years as number>,
  "inverterWarrantyYears": <inverter warranty in years as number>,
  "workmanshipWarrantyYears": <installer workmanship warranty in years as number>,
  "contractType": <"cash" | "loan" | "lease" | "ppa" | null>,
  "loanRatePct": <APR if loan as number>,
  "loanTermYears": <loan term in years as number>,
  "annualEscalatorPct": <annual payment escalator % if lease/PPA as number>,
  "ppaRatePerKwh": <PPA rate in $/kWh if PPA as number>,
  "monitoring": <monitoring system name or null>,
  "productionGuaranteePct": <production guarantee % if stated as number>,
  "notes": <any other important terms or clauses worth flagging as a string, or null>
}`;

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get('quote') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const isPDF   = file.type === 'application/pdf';
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (!isPDF && !isImage) return NextResponse.json({ error: 'Upload a PDF, JPG, or PNG.' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const client = new Anthropic({ apiKey: key });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileBlock: any = isPDF
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: file.type,          data: base64 } };

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
  });

  const raw = (message.content[0] as Anthropic.TextBlock).text.trim();
  let quote: Record<string, unknown>;
  try {
    quote = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Could not parse quote. Try a clearer PDF.' }, { status: 422 });
  }

  // Build flags
  const flags: { severity: 'red' | 'yellow' | 'green'; message: string }[] = [];

  const ppw = quote.pricePerWatt as number | null
    ?? (quote.totalPriceDollars && quote.systemKw
      ? (quote.totalPriceDollars as number) / ((quote.systemKw as number) * 1000)
      : null);

  if (ppw != null) {
    if (ppw > LBNL_HIGH * 1.2) {
      const pct = Math.round(((ppw - LBNL_HIGH) / LBNL_HIGH) * 100);
      flags.push({ severity: 'red', message: `Price is ${pct}% above the LBNL national benchmark ($${LBNL_LOW}–$${LBNL_HIGH}/W). Ask the installer to justify the markup line by line.` });
    } else if (ppw > LBNL_HIGH) {
      flags.push({ severity: 'yellow', message: `Price is above the LBNL benchmark ceiling of $${LBNL_HIGH}/W. Not a dealbreaker but worth negotiating.` });
    } else if (ppw >= LBNL_LOW) {
      flags.push({ severity: 'green', message: `Price of $${ppw.toFixed(2)}/W is within the LBNL national benchmark range ($${LBNL_LOW}–$${LBNL_HIGH}/W).` });
    } else {
      flags.push({ severity: 'yellow', message: `Price of $${ppw.toFixed(2)}/W is below the LBNL floor — verify system quality and warranty terms carefully.` });
    }
  }

  if (!quote.workmanshipWarrantyYears || (quote.workmanshipWarrantyYears as number) < 10) {
    flags.push({ severity: 'red', message: 'Workmanship warranty under 10 years is below industry standard. Industry norm is 10–25 years.' });
  }
  if (!quote.panelWarrantyYears || (quote.panelWarrantyYears as number) < 25) {
    flags.push({ severity: 'yellow', message: 'Panel product warranty should be 25 years. Confirm this is included.' });
  }
  if (!quote.inverterWarrantyYears || (quote.inverterWarrantyYears as number) < 10) {
    flags.push({ severity: 'yellow', message: 'Inverter warranty under 10 years — string inverters typically carry 10-12 years, microinverters 25 years.' });
  }
  if (quote.annualEscalatorPct && (quote.annualEscalatorPct as number) > 2.9) {
    flags.push({ severity: 'red', message: `Annual escalator of ${quote.annualEscalatorPct}% is high. Over 20 years this compounds significantly. Push for 0–2%.` });
  }
  if (quote.contractType === 'lease' || quote.contractType === 'ppa') {
    flags.push({ severity: 'yellow', message: 'TPO product (lease/PPA): the company claims the 30% federal ITC and any domestic content bonus — not you. Understand home-sale transfer clauses before signing.' });
  }

  return NextResponse.json({ quote: { ...quote, pricePerWatt: ppw }, flags, lbnlRange: { low: LBNL_LOW, high: LBNL_HIGH } });
}
