import { NextRequest, NextResponse } from 'next/server';
import type { Assessment, AssessmentRequest, StateIncentive, RoofSegment } from '@/lib/types';
import {
  azimuthToLabel,
  shadingFromSunshineHours,
  metersSquaredToSqFt,
  equivalentHomes,
} from '@/lib/utils';
import {
  STATE_AVG_CONSUMPTION_KWH,
  DEFAULT_ANNUAL_CONSUMPTION_KWH,
  DEFAULT_UTILITY_RATE_PER_KWH,
  FEDERAL_ITC_PERCENT,
  COST_PER_WATT_LOW,
  COST_PER_WATT_HIGH,
  NET_METERING,
  DEFAULT_NET_METERING,
  STATE_INCENTIVES,
  DEFAULT_STATE_INCENTIVES,
} from '@/lib/fallbacks';

export async function POST(request: NextRequest) {
  try {
    const body: AssessmentRequest = await request.json();
    const { address, monthlyBill, hasHighLoads, shadingOverride } = body;

    if (!address?.trim()) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    // ── Step 1: Geocode ──────────────────────────────────────────────────────
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const geocodeRes = await fetch(geocodeUrl, { next: { revalidate: 3600 } });
    const geocodeData = await geocodeRes.json();

    if (geocodeData.status !== 'OK' || !geocodeData.results?.length) {
      return NextResponse.json(
        { error: 'Address not found. Please check the address and try again.' },
        { status: 400 }
      );
    }

    const location = geocodeData.results[0].geometry.location;
    const lat: number = location.lat;
    const lng: number = location.lng;
    const formattedAddress: string = geocodeData.results[0].formatted_address;

    let stateAbbr = '';
    let stateName = '';
    for (const component of geocodeData.results[0].address_components) {
      if (component.types.includes('administrative_area_level_1')) {
        stateAbbr = component.short_name;
        stateName = component.long_name;
        break;
      }
    }

    // ── Step 2: Fire API calls in parallel ───────────────────────────────────
    const [solarData, eiaRate] = await Promise.all([
      fetchSolarData(lat, lng),
      fetchEIARate(stateAbbr),
    ]);

    // ── Step 3: Extract roof data from Google Solar API ──────────────────────
    const solarPotential = solarData?.solarPotential;

    let panelCount = 20;
    let panelCapacityWatts = 400;
    let systemCapacityKw = 8;
    let usableAreaSqFt = 600;
    let pitchDegrees = 20;
    let azimuthDegrees = 180; // default south
    let sunshineHoursPerYear = 1600;
    let roofSegments: RoofSegment[] | undefined;
    let dataQuality: 'high' | 'medium' | 'low' = 'low';
    const warnings: string[] = [];

    if (solarPotential) {
      dataQuality = 'high';
      panelCapacityWatts = solarPotential.panelCapacityWatts || 400;
      panelCount = solarPotential.maxArrayPanelsCount || 20;
      systemCapacityKw = (panelCount * panelCapacityWatts) / 1000;
      usableAreaSqFt = metersSquaredToSqFt(solarPotential.maxArrayAreaMeters2 || 60);
      sunshineHoursPerYear = solarPotential.maxSunshineHoursPerYear || 1600;

      // Use the primary roof segment (largest ground area) for pitch + azimuth
      const segments: SolarSegment[] = solarPotential.roofSegmentStats || [];
      if (segments.length > 0) {
        const primary = segments.reduce((best, seg) =>
          (seg.stats?.groundAreaMeters2 ?? 0) > (best.stats?.groundAreaMeters2 ?? 0)
            ? seg
            : best,
          segments[0]
        );
        pitchDegrees = primary.pitchDegrees ?? 20;
        azimuthDegrees = primary.azimuthDegrees ?? 180;

        // Use median sunshine hours from this segment if available
        const q = primary.stats?.sunshineQuantiles;
        if (q && q.length >= 6) {
          sunshineHoursPerYear = q[5]; // p50
        }
      }

      // Build per-segment data for map overlay
      roofSegments = segments
        .filter(seg => seg.center?.latitude && seg.center?.longitude)
        .map(seg => ({
          centerLat: seg.center!.latitude,
          centerLng: seg.center!.longitude,
          pitchDegrees: seg.pitchDegrees ?? 20,
          azimuthDegrees: seg.azimuthDegrees ?? 180,
          areaMeters2: seg.stats?.areaMeters2 ?? 0,
          sunshineHoursMedian: seg.stats?.sunshineQuantiles?.[5] ?? sunshineHoursPerYear,
        }));

      // If we have a monthly bill, find the optimal panel count from Google Solar configs
      if (monthlyBill && monthlyBill > 0) {
        const rate = eiaRate ?? DEFAULT_UTILITY_RATE_PER_KWH;
        const annualConsumption = (monthlyBill / rate) * 12;
        const configs: SolarPanelConfig[] = solarPotential.solarPanelConfigs || [];
        if (configs.length > 0) {
          // Target DC output = annual consumption ÷ 0.80 (accounts for AC conversion + losses)
          const targetDcKwh = annualConsumption / 0.80;
          let bestConfig = configs[configs.length - 1]; // default to max
          for (const config of configs) {
            if ((config.yearlyEnergyDcKwh ?? 0) >= targetDcKwh) {
              bestConfig = config;
              break;
            }
          }
          panelCount = bestConfig.panelsCount;
          systemCapacityKw = (panelCount * panelCapacityWatts) / 1000;
        }
      }
    } else {
      warnings.push(
        "Google Solar doesn't have detailed imagery for this address yet. Numbers are estimated from regional averages."
      );
      dataQuality = 'low';
    }

    // ── Step 4: Apply user shading override ─────────────────────────────────
    let shadingLossFactor = 1.0;
    if (shadingOverride === 'lots') {
      shadingLossFactor = 0.85;
    } else if (shadingOverride === 'partially') {
      shadingLossFactor = 0.95;
    }

    // ── Step 5: Apply high-load consumption factor ───────────────────────────
    let consumptionFactor = 1.0;
    if (hasHighLoads === 'yes') {
      consumptionFactor = 1.35; // EV + pool + heat pump ~ +35% typical
    }

    // ── Step 6: PVWatts production estimate ──────────────────────────────────
    let annualKwh = 0;
    let monthlyKwh: number[] | undefined;
    const pvwattsResult = await fetchPVWatts(
      lat,
      lng,
      systemCapacityKw,
      azimuthDegrees,
      pitchDegrees
    );

    if (pvwattsResult !== null) {
      annualKwh = pvwattsResult.acAnnual * shadingLossFactor;
      monthlyKwh = pvwattsResult.acMonthly?.map(v => Math.round(v * shadingLossFactor));
    } else if (solarPotential?.solarPanelConfigs?.length) {
      // Fallback: use Google Solar DC estimate × AC conversion factor
      const configs: SolarPanelConfig[] = solarPotential.solarPanelConfigs;
      const closest = configs.reduce((prev, curr) =>
        Math.abs(curr.panelsCount - panelCount) <
        Math.abs(prev.panelsCount - panelCount)
          ? curr
          : prev,
        configs[0]
      );
      annualKwh = (closest.yearlyEnergyDcKwh ?? 0) * 0.80 * shadingLossFactor;
      warnings.push(
        'Production estimate uses Google Solar data — PVWatts was unavailable.'
      );
    } else {
      // Last resort: national average production factor
      annualKwh = systemCapacityKw * 1400 * shadingLossFactor;
      warnings.push(
        'Production is estimated using national averages. Add your address for a location-specific result.'
      );
    }

    // ── Step 7: Savings calculation ──────────────────────────────────────────
    const utilityRate = eiaRate ?? DEFAULT_UTILITY_RATE_PER_KWH;
    let annualConsumptionKwh =
      STATE_AVG_CONSUMPTION_KWH[stateAbbr] ?? DEFAULT_ANNUAL_CONSUMPTION_KWH;
    let isStateAverage = true;

    if (monthlyBill && monthlyBill > 0) {
      annualConsumptionKwh = (monthlyBill / utilityRate) * 12;
      isStateAverage = false;
    }

    annualConsumptionKwh *= consumptionFactor;

    // Savings = value of the portion of production that offsets consumption
    const usableKwh = Math.min(annualKwh, annualConsumptionKwh);
    const annualSavings = usableKwh * utilityRate;
    const offsetPercent = Math.min(
      100,
      Math.round((annualKwh / annualConsumptionKwh) * 100)
    );

    // ── Step 8: Cost range (LBNL benchmark) ──────────────────────────────────
    const costLow = systemCapacityKw * 1000 * COST_PER_WATT_LOW;
    const costHigh = systemCapacityKw * 1000 * COST_PER_WATT_HIGH;
    const costMidpoint = (costLow + costHigh) / 2;

    // ── Step 9: Incentives ───────────────────────────────────────────────────
    const federalITCDollars = costMidpoint * FEDERAL_ITC_PERCENT;
    const stateIncentives: StateIncentive[] =
      STATE_INCENTIVES[stateAbbr] ?? DEFAULT_STATE_INCENTIVES;

    const netMetering = NET_METERING[stateAbbr] ?? DEFAULT_NET_METERING;
    const storageIncentive = stateIncentives.find(
      (i) =>
        i.name.toLowerCase().includes('storage') ||
        i.name.toLowerCase().includes('battery') ||
        i.name.toLowerCase().includes('sgip')
    );

    // ── Step 10: Payback range ───────────────────────────────────────────────
    const netCostLow = costLow * (1 - FEDERAL_ITC_PERCENT);
    const netCostHigh = costHigh * (1 - FEDERAL_ITC_PERCENT);

    // Optimistic payback uses slightly higher savings assumption (+5% annual utility escalation baked in)
    const paybackLowRaw = netCostLow / (annualSavings * 1.05);
    const paybackHighRaw = netCostHigh / annualSavings;

    const shadingInfo = shadingFromSunshineHours(sunshineHoursPerYear);

    const assessment: Assessment = {
      address: formattedAddress,
      roof: {
        usableAreaSqFt,
        azimuthDegrees,
        azimuthLabel: azimuthToLabel(azimuthDegrees),
        pitchDegrees: Math.round(pitchDegrees),
        shadingScore: shadingInfo.score,
        shadingLabel: shadingInfo.label,
        estimatedPanelCount: panelCount,
        sunshineHoursPerYear: Math.round(sunshineHoursPerYear),
        roofSegments,
        lat,
        lng,
        state: stateAbbr,
        stateName,
      },
      production: {
        annualKwh: Math.round(annualKwh),
        systemCapacityKw: Math.round(systemCapacityKw * 10) / 10,
        equivalentHomes: equivalentHomes(annualKwh),
        monthlyKwh,
      },
      savings: {
        offsetPercent,
        annualSavings: Math.round(annualSavings),
        utilityRatePerKwh: utilityRate,
        stateAbbr,
        annualConsumptionKwh: Math.round(annualConsumptionKwh),
        isStateAverage,
      },
      cost: {
        lowEstimate: Math.round(costLow),
        highEstimate: Math.round(costHigh),
        costPerWattLow: COST_PER_WATT_LOW,
        costPerWattHigh: COST_PER_WATT_HIGH,
        systemCapacityKw: Math.round(systemCapacityKw * 10) / 10,
      },
      incentives: {
        federalITCPercent: FEDERAL_ITC_PERCENT * 100,
        federalITCDollars: Math.round(federalITCDollars),
        stateIncentives,
        netMeteringStatus: netMetering.status,
        netMeteringDetail: netMetering.detail,
        hasStorageIncentive: !!storageIncentive,
        storageDetail: storageIncentive?.description,
      },
      payback: {
        lowYears: Math.max(4, Math.round(paybackLowRaw)),
        highYears: Math.max(5, Math.round(paybackHighRaw)),
        netCostAfterITC: Math.round(
          ((costLow + costHigh) / 2) * (1 - FEDERAL_ITC_PERCENT)
        ),
      },
      generatedAt: new Date().toISOString(),
      dataQuality,
      warnings: warnings.length > 0 ? warnings : undefined,
      roofImageUrl: `/api/satellite?lat=${lat}&lng=${lng}`,
    };

    return NextResponse.json(assessment);
  } catch (err) {
    console.error('[assess] error:', err);
    return NextResponse.json(
      {
        error:
          'Something went wrong while pulling your assessment. Please try again.',
      },
      { status: 500 }
    );
  }
}

// ── Google Solar API ─────────────────────────────────────────────────────────

interface SolarSegment {
  pitchDegrees?: number;
  azimuthDegrees?: number;
  center?: { latitude: number; longitude: number };
  stats?: {
    areaMeters2?: number;
    groundAreaMeters2?: number;
    sunshineQuantiles?: number[];
  };
}

interface SolarPanelConfig {
  panelsCount: number;
  yearlyEnergyDcKwh?: number;
}

async function fetchSolarData(lat: number, lng: number) {
  try {
    const url =
      `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
      `?location.latitude=${lat}&location.longitude=${lng}` +
      `&requiredQuality=LOW` +
      `&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── NREL PVWatts V8 ──────────────────────────────────────────────────────────

async function fetchPVWatts(
  lat: number,
  lng: number,
  systemCapacityKw: number,
  azimuth: number,
  tilt: number
): Promise<{ acAnnual: number; acMonthly: number[] } | null> {
  const key = process.env.NREL_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({
      api_key: key,
      lat: lat.toString(),
      lon: lng.toString(),
      system_capacity: systemCapacityKw.toString(),
      azimuth: azimuth.toString(),
      tilt: tilt.toString(),
      array_type: '1',    // fixed roof mount
      module_type: '1',   // premium module
      losses: '14',
    });
    const res = await fetch(
      `https://developer.nrel.gov/api/pvwatts/v8.json?${params}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const acAnnual = data.outputs?.ac_annual as number;
    const acMonthly = data.outputs?.ac_monthly as number[];
    if (acAnnual == null) return null;
    return { acAnnual, acMonthly: acMonthly ?? [] };
  } catch {
    return null;
  }
}

// ── EIA Electricity Retail Rate ──────────────────────────────────────────────

async function fetchEIARate(stateAbbr: string): Promise<number | null> {
  const key = process.env.EIA_API_KEY;
  if (!key || !stateAbbr) return null;
  try {
    const url =
      `https://api.eia.gov/v2/electricity/retail-sales/data/` +
      `?api_key=${key}` +
      `&frequency=monthly` +
      `&data[]=price` +
      `&facets[sectorid][]=RES` +
      `&facets[stateid][]=${stateAbbr}` +
      `&sort[0][column]=period` +
      `&sort[0][direction]=desc` +
      `&offset=0&length=1`;
    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
    if (!res.ok) return null;
    const data = await res.json();
    const priceCents = data?.response?.data?.[0]?.price;
    if (priceCents == null) return null;
    return parseFloat(priceCents) / 100; // cents/kWh → $/kWh
  } catch {
    return null;
  }
}
