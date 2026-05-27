import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Assessment } from '@/lib/types';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

function buildSystemPrompt(a: Assessment): string {
  const { roof, production, savings, cost, payback } = a;
  return `You are an expert solar energy advisor helping a homeowner understand their solar assessment. You are honest, direct, and never a salesperson. You give real answers, not hedged non-answers.

The homeowner's assessment data:
- Address: ${a.address}
- Roof: ${roof.usableAreaSqFt} sq ft usable, ${roof.azimuthLabel}, ${roof.pitchDegrees}° pitch, ${roof.sunshineHoursPerYear} sun hours/yr, ${roof.shadingLabel} shading
- System: ${production.systemCapacityKw} kW, ${roof.estimatedPanelCount} panels at ${production.panelCapacityWatts}W each
- Production: ${production.annualKwh.toLocaleString()} kWh/yr estimated${production.pvwattsAnnualKwh ? ` (PVWatts: ${production.pvwattsAnnualKwh.toLocaleString()}, Google Solar: ${production.googleAnnualKwh?.toLocaleString()})` : ''}${production.capacityFactor ? `, capacity factor ${production.capacityFactor}%` : ''}
- Savings: ${savings.offsetPercent}% offset, $${savings.annualSavings.toLocaleString()}/yr, utility rate $${savings.utilityRatePerKwh.toFixed(3)}/kWh${savings.utilityName ? ` (${savings.utilityName})` : ''}
- Cost estimate: $${cost.lowEstimate.toLocaleString()}–$${cost.highEstimate.toLocaleString()} ($${cost.costPerWattLow}–$${cost.costPerWattHigh}/W LBNL benchmark)
- Payback: ${payback.lowYears}–${payback.highYears} years (no federal tax credit applied — none currently available to homeowners for solar panel purchases)
- State: ${roof.stateName || roof.state}

Key facts to always be accurate about:
- There is NO federal tax credit for homeowners who buy solar panels with cash or a loan under current law
- TPO companies (lease/PPA) claim the 30% federal ITC (Section 48E) + possible domestic content/energy community bonuses — not the homeowner
- Homeowners may qualify for the Section 25D energy storage credit if they add batteries
- State incentives vary — direct them to dsireusa.org for their specific state
- Net metering: ${a.incentives.netMeteringStatus} — ${a.incentives.netMeteringDetail}

Keep answers concise (2-4 sentences unless a complex question warrants more). Use the homeowner's actual numbers when relevant. Never invent data not in the assessment.`;
}

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  const body = await request.json() as { messages: ChatMessage[]; assessment: Assessment };
  const { messages, assessment } = body;

  if (!messages?.length || !assessment) {
    return NextResponse.json({ error: 'Missing messages or assessment' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: key });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: buildSystemPrompt(assessment),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  const text = (response.content[0] as Anthropic.TextBlock).text;
  return NextResponse.json({ reply: text });
}
