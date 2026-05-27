import { NextRequest, NextResponse } from 'next/server';
import type { ReOptData } from '@/lib/types';

interface ReOptRequest {
  lat: number;
  lng: number;
  annualConsumptionKwh: number;
  utilityRatePerKwh: number;
  systemCapacityKw: number;
  maxSystemKw?: number;
}

export async function POST(request: NextRequest) {
  const key = process.env.NREL_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'NREL key not configured' }, { status: 500 });
  }

  const body: ReOptRequest = await request.json();
  const { lat, lng, annualConsumptionKwh, utilityRatePerKwh, systemCapacityKw, maxSystemKw } = body;

  if (!lat || !lng || !annualConsumptionKwh || !utilityRatePerKwh) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // Submit ReOpt job
    const payload = {
      Scenario: {
        Site: {
          latitude: lat,
          longitude: lng,
          ElectricTariff: {
            blended_annual_rates_us_dollars_per_kwh: utilityRatePerKwh,
          },
          LoadProfile: {
            annual_kwh: annualConsumptionKwh,
          },
          PV: {
            min_kw: 0,
            max_kw: maxSystemKw ?? systemCapacityKw * 2,
          },
          ElectricStorage: {
            min_kwh: 0,
            max_kwh: 30,
          },
          Financial: {
            om_cost_escalation_pct: 0,
            offtaker_discount_pct: 0.083,
            offtaker_tax_pct: 0.26,
            analysis_years: 25,
            federal_itc_pct: 0,
          },
        },
      },
    };

    const submitRes = await fetch(
      `https://developer.nrel.gov/api/reopt/v2/job?api_key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!submitRes.ok) {
      return NextResponse.json({ error: 'ReOpt submission failed' }, { status: 502 });
    }

    const { run_uuid } = await submitRes.json();
    if (!run_uuid) {
      return NextResponse.json({ error: 'No run_uuid returned' }, { status: 502 });
    }

    // Poll for results — max 90 seconds
    const maxAttempts = 18;
    const pollIntervalMs = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(pollIntervalMs);

      const pollRes = await fetch(
        `https://developer.nrel.gov/api/reopt/v2/job/${run_uuid}/results?api_key=${key}`
      );
      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const status = pollData?.outputs?.Scenario?.status;

      if (status === 'optimal') {
        const site     = pollData.outputs?.Scenario?.Site;
        const pv       = site?.PV;
        const storage  = site?.ElectricStorage;
        const fin      = site?.Financial;

        const reopt: ReOptData = {
          optimalSystemKw:    Math.round((pv?.size_kw       ?? 0) * 10) / 10,
          optimalBatteryKwh:  storage?.size_kwh > 0.1 ? Math.round(storage.size_kwh * 10) / 10 : undefined,
          npvDollars:         Math.round(fin?.npv           ?? 0),
          irrPercent:         Math.round((fin?.irr          ?? 0) * 10) / 10,
          paybackYears:       Math.round((fin?.simple_payback_years ?? 0) * 10) / 10,
          lcoePerKwh:         Math.round((fin?.lcoe_real_dollars_per_kwh ?? 0) * 1000) / 1000,
        };

        return NextResponse.json(reopt);
      }

      if (status === 'error' || status === 'timed out') {
        return NextResponse.json({ error: `ReOpt status: ${status}` }, { status: 502 });
      }
    }

    return NextResponse.json({ error: 'ReOpt timed out' }, { status: 504 });
  } catch (err) {
    console.error('[reopt] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
