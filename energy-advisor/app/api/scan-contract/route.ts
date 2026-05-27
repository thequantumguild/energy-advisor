import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const PROMPT = `You are an expert solar contract attorney reviewing a homeowner's solar agreement (lease, PPA, loan, or cash purchase contract).

Read the entire document and return ONLY valid JSON with this structure:
{
  "contractType": <"lease" | "ppa" | "loan" | "cash" | "unknown">,
  "termYears": <contract term in years as number or null>,
  "annualEscalatorPct": <annual payment escalator % as number or null>,
  "earlyTerminationFee": <description of early termination fee as string or null>,
  "homeSaleClause": <exact language or summary of what happens when homeowner sells as string or null>,
  "bankruptcyClause": <what happens if the company goes bankrupt as string or null>,
  "performanceGuarantee": <description of any production/performance guarantee or null>,
  "removalResponsibility": <who pays to remove panels at end of term as string or null>,
  "endOfTermOptions": <what happens at contract end — purchase option, renewal, removal as string or null>,
  "dataOwnership": <who owns monitoring/production data as string or null>,
  "flags": [
    {
      "severity": <"red" | "yellow" | "green">,
      "category": <short label like "Escalator" | "Home Sale" | "Termination Fee" | "Bankruptcy" | "Performance" | "End of Term" | "Data">,
      "issue": <plain-language description of the issue in 1-2 sentences>,
      "quote": <exact clause language from the document, max 200 chars, or null>
    }
  ]
}

Flag these as RED: escalator >3%, no performance guarantee, punishing termination fees, transfer clauses that could block a home sale, company-favorable bankruptcy terms.
Flag these as YELLOW: escalator 1-3%, unclear transfer terms, no end-of-term purchase option, data shared with third parties.
Flag these as GREEN: strong performance guarantee, clear home-sale transfer process, 0% escalator, homeowner-favorable terms.`;

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get('contract') as File | null;
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
    max_tokens: 2048,
    messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
  });

  const raw = (message.content[0] as Anthropic.TextBlock).text.trim();
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'Could not parse contract. Try a clearer PDF.' }, { status: 422 });
  }
}
