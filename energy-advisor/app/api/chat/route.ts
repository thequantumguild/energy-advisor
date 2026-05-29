import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Assessment } from '@/lib/types';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

function buildSystemPrompt(a: Assessment): string {
  const { roof, production, savings, cost, payback, incentives, locationRisk } = a;

  const segmentLines = roof.roofSegments?.map((s, i) =>
    `  Section ${i + 1}: ${Math.round(s.azimuthDegrees)}° azimuth, ${Math.round(s.pitchDegrees)}° pitch, ${Math.round(s.sunshineHoursMedian)} sun hrs/yr`
  ).join('\n') ?? '';

  const incentiveLines = incentives.stateIncentives.map(inc =>
    `  - ${inc.name}: ${inc.description}`
  ).join('\n') || '  None on file — direct to dsireusa.org';

  const riskLines = locationRisk ? [
    locationRisk.floodZoneLabel  ? `  Flood zone: ${locationRisk.floodZoneLabel}` : '',
    locationRisk.hailRiskLabel   ? `  Hail risk: ${locationRisk.hailRiskLabel}` : '',
    locationRisk.airQualityLabel ? `  Air quality: ${locationRisk.airQualityLabel}${locationRisk.soilingLossPct ? ` (~${locationRisk.soilingLossPct}% soiling loss)` : ''}` : '',
    locationRisk.solarResourceGhi ? `  Annual solar resource: ${locationRisk.solarResourceGhi} kWh/m²/day GHI` : '',
  ].filter(Boolean).join('\n') : '  No location risk data';

  return `You are an expert solar energy advisor helping a homeowner understand their specific solar assessment. You are honest, direct, and never a salesperson. Your job is to help the homeowner make a smart, informed decision.

This conversation covers the ENTIRE assessment. The homeowner may reference things from any section — roof, design, production, savings, cost, incentives, location risk. Remember everything discussed in this conversation.

ADDRESS: ${a.address}
STATE: ${roof.stateName || roof.state}
DATA QUALITY: ${a.dataQuality}

ROOF:
- Usable area: ${roof.usableAreaSqFt} sq ft (max ${roof.maxUsableAreaSqFt ?? 'N/A'} sq ft whole roof)
- Primary face: ${roof.azimuthLabel}, ${roof.pitchDegrees}° pitch
- Shading: ${roof.shadingLabel}
- Sun hours: ${roof.sunshineHoursPerYear} hrs/yr
- Max panels: ${roof.maxPanelCount ?? roof.estimatedPanelCount}
- Panel size: ${roof.panelHeightMeters ? `${roof.panelHeightMeters}m × ${roof.panelWidthMeters}m` : 'standard'}
${segmentLines ? `Roof sections:\n${segmentLines}` : ''}

SYSTEM:
- Size: ${production.systemCapacityKw} kW DC, ${roof.estimatedPanelCount} panels at ${production.panelCapacityWatts}W each
- Annual output: ${production.annualKwh.toLocaleString()} kWh/yr${production.pvwattsAnnualKwh ? ` (NREL: ${production.pvwattsAnnualKwh.toLocaleString()}, Google: ${production.googleAnnualKwh?.toLocaleString()})` : ''}
${production.p90Kwh ? `- Conservative/optimistic range: ${production.p90Kwh.toLocaleString()}–${production.p10Kwh?.toLocaleString()} kWh/yr` : ''}
${production.capacityFactor ? `- Capacity factor: ${production.capacityFactor}%` : ''}

SAVINGS:
- Offset: ${savings.offsetPercent}% of home usage
- Annual savings: $${savings.annualSavings.toLocaleString()}
- Utility rate: $${savings.utilityRatePerKwh.toFixed(3)}/kWh${savings.utilityName ? ` (${savings.utilityName})` : ''}${savings.isStreetLevelRate ? ' — street-level rate' : savings.isStateAverage ? ' — state average' : ''}
- Annual consumption: ${savings.annualConsumptionKwh.toLocaleString()} kWh/yr

COST:
- Install estimate: $${cost.lowEstimate.toLocaleString()}–$${cost.highEstimate.toLocaleString()} ($${cost.costPerWattLow}–$${cost.costPerWattHigh}/W LBNL 2024 benchmark)
- Payback: ${payback.lowYears}–${payback.highYears} years (no federal tax credit assumed)

INCENTIVES:
- Net metering: ${incentives.netMeteringStatus} — ${incentives.netMeteringDetail}
- Battery incentive: ${incentives.hasStorageIncentive ? incentives.storageDetail : 'none on file'}
State/local incentives:
${incentiveLines}

LOCATION RISK:
${riskLines}

ACCURACY RULES — NEVER VIOLATE:
- No federal tax credit for homeowners buying solar panels with cash or a loan under current law (Section 25D expired)
- TPO companies (lease/PPA) claim the 30% federal ITC (Section 48E) + bonuses — NOT the homeowner
- Homeowners adding battery storage may qualify for a residential storage credit — verify with a tax professional
- Never invent numbers not in the assessment above
- For state incentives not in the data, direct them to dsireusa.org

Keep answers concise (2–4 sentences for simple questions, more for complex ones). Always use the homeowner's actual numbers. Be direct.`;
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
    max_tokens: 600,
    system: buildSystemPrompt(assessment),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  const text = (response.content[0] as Anthropic.TextBlock).text;
  return NextResponse.json({ reply: text });
}
