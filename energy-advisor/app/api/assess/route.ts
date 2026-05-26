import { NextRequest, NextResponse } from 'next/server';
import type {
  Assessment, AssessmentRequest, StateIncentive,
  RoofSegment, PanelConfig, WholeRoofStats, GoogleFinancialSummary, FluxMapData,
} from '@/lib/types';
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
    const { address, monthlyBill, hasHighLoads, shadingOverride, lat: overrideLat, lng: overrideLng } = body;

    if (!address?.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
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

    // ── Step 2: Fire all external APIs in parallel ────────────────────────────
    const solarLat = overrideLat ?? lat;
    const solarLng = overrideLng ?? lng;

    const [solarData, eiaRate, nrelRateResult, dataLayers] = await Promise.all([
      fetchSolarData(solarLat, solarLng),
      fetchEIARate(stateAbbr),
      fetchNRELUtilityRate(solarLat, solarLng),
      fetchDataLayers(solarLat, solarLng),
    ]);

    // ── Step 3: Extract roof data from Google Solar API ──────────────────────
    const solarPotential = solarData?.solarPotential;

    let panelCount = 20;
    let panelCapacityWatts = 400;
    let systemCapacityKw = 8;
    let usableAreaSqFt = 600;
    let pitchDegrees = 20;
    let azimuthDegrees = 180;
    let sunshineHoursPerYear = 1600;
    let roofSegments: RoofSegment[] | undefined;
    let panelConfigs: PanelConfig[] | undefined;
    let imageryDate: string | undefined;
    let imageryQuality: 'HIGH' | 'MEDIUM' | 'LOW' | undefined;
    let carbonOffsetKgPerMwh: number | undefined;
    let panelLifetimeYears: number | undefined;
    let panelHeightMeters: number | undefined;
    let panelWidthMeters: number | undefined;
    let wholeRoofStats: WholeRoofStats | undefined;
    let googleFinancial: GoogleFinancialSummary | undefined;
    let maxPanelCount: number | undefined;
    let maxUsableAreaSqFt: number | undefined;
    let dataQuality: 'high' | 'medium' | 'low' = 'low';
    const warnings: string[] = [];

    if (solarPotential) {
      dataQuality = 'high';
      panelCapacityWatts = solarPotential.panelCapacityWatts || 400;
      panelCount = solarPotential.maxArrayPanelsCount || 20;
      maxPanelCount = solarPotential.maxArrayPanelsCount;
      maxUsableAreaSqFt = solarPotential.maxArrayAreaMeters2
        ? metersSquaredToSqFt(solarPotential.maxArrayAreaMeters2)
        : undefined;
      systemCapacityKw = (panelCount * panelCapacityWatts) / 1000;
      usableAreaSqFt = metersSquaredToSqFt(solarPotential.maxArrayAreaMeters2 || 60);
      sunshineHoursPerYear = solarPotential.maxSunshineHoursPerYear || 1600;
      imageryQuality = solarData?.imageryQuality ?? undefined;

      const segments: SolarSegment[] = solarPotential.roofSegmentStats || [];
      if (segments.length > 0) {
        const primary = segments.reduce((best, seg) =>
          (seg.stats?.groundAreaMeters2 ?? 0) > (best.stats?.groundAreaMeters2 ?? 0) ? seg : best,
          segments[0]
        );
        pitchDegrees = primary.pitchDegrees ?? 20;
        azimuthDegrees = primary.azimuthDegrees ?? 180;
        const q = primary.stats?.sunshineQuantiles;
        if (q && q.length >= 6) sunshineHoursPerYear = q[5];
      }

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

      panelConfigs = (solarPotential.solarPanelConfigs || []).map((c: SolarPanelConfig) => ({
        panelsCount: c.panelsCount,
        yearlyEnergyDcKwh: c.yearlyEnergyDcKwh ?? 0,
        segmentSummaries: c.roofSegmentSummaries?.map((s: SolarSegmentSummary) => ({
          segmentIndex: s.segmentIndex ?? 0,
          panelsCount: s.panelsCount ?? 0,
          yearlyEnergyDcKwh: s.yearlyEnergyDcKwh ?? 0,
        })),
      }));

      carbonOffsetKgPerMwh = solarPotential.carbonOffsetFactorKgPerMwh ?? undefined;
      panelLifetimeYears   = solarPotential.panelLifetimeYears ?? undefined;
      panelHeightMeters    = solarPotential.panelHeightMeters ?? undefined;
      panelWidthMeters     = solarPotential.panelWidthMeters ?? undefined;

      const wrs = solarPotential.wholeRoofStats;
      if (wrs?.sunshineQuantiles?.length) {
        wholeRoofStats = {
          areaMeters2:       wrs.areaMeters2 ?? 0,
          groundAreaMeters2: wrs.groundAreaMeters2 ?? 0,
          sunshineQuantiles: wrs.sunshineQuantiles,
        };
      }

      const img = solarData?.imageryDate;
      if (img?.year && img?.month) {
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        imageryDate = `${MONTHS[img.month - 1]} ${img.year}`;
      }

      const analyses: GoogleAnalysis[] = solarPotential.financialAnalyses || [];
      if (analyses.length > 0) {
        let best = analyses[Math.floor(analyses.length / 2)];
        if (monthlyBill && monthlyBill > 0) {
          let minDiff = Infinity;
          for (const a of analyses) {
            const diff = Math.abs(parseInt(a.monthlyBill?.units ?? '0') - monthlyBill);
            if (diff < minDiff) { minDiff = diff; best = a; }
          }
        }
        const cash    = best.cashPurchaseSavings;
        const details = best.financialDetails;
        if (cash && details) {
          googleFinancial = {
            monthlyBillDollars:      parseInt(best.monthlyBill?.units ?? '0'),
            paybackYears:            cash.paybackYears ?? 0,
            lifetimeSavingsDollars:  parseInt(cash.savings?.presentValueOfSavingsLifetime?.units ?? '0'),
            federalIncentiveDollars: parseInt(details.federalIncentive?.units ?? '0'),
            netMeteringAllowed:      details.netMeteringAllowed ?? false,
            solarPercentage:         details.solarPercentage ?? 0,
          };
        }
      }

      if (monthlyBill && monthlyBill > 0) {
        const rate = nrelRateResult?.rate ?? eiaRate ?? DEFAULT_UTILITY_RATE_PER_KWH;
        const annualConsumption = (monthlyBill / rate) * 12;
        const configs: SolarPanelConfig[] = solarPotential.solarPanelConfigs || [];
        if (configs.length > 0) {
          const targetDcKwh = annualConsumption / 0.80;
          let bestConfig = configs[configs.length - 1];
          for (const config of configs) {
            if ((config.yearlyEnergyDcKwh ?? 0) >= targetDcKwh) { bestConfig = config; break; }
          }
          panelCount = bestConfig.panelsCount;
          systemCapacityKw = (panelCount * panelCapacityWatts) / 1000;
        }
      }
    } else {
      warnings.push("Google Solar doesn't have detailed imagery for this address yet. Numbers are estimated from regional averages.");
      dataQuality = 'low';
    }

    // ── Step 4: Shading + load adjustments ───────────────────────────────────
    let shadingLossFactor = 1.0;
    if (shadingOverride === 'lots')      shadingLossFactor = 0.85;
    else if (shadingOverride === 'partially') shadingLossFactor = 0.95;

    let consumptionFactor = 1.0;
    if (hasHighLoads === 'yes') consumptionFactor = 1.35;

    // ── Step 5: Production from both sources ─────────────────────────────────
    let pvwattsAnnualKwh: number | undefined;
    let googleAnnualKwh: number | undefined;
    let monthlyKwh: number[] | undefined;
    let dcAnnualKwh: number | undefined;
    let dcMonthlyKwh: number[] | undefined;
    let poaMonthly: number[] | undefined;
    let solradAnnual: number | undefined;
    let capacityFactor: number | undefined;

    const pvwattsResult = await fetchPVWatts(solarLat, solarLng, systemCapacityKw, azimuthDegrees, pitchDegrees);
    if (pvwattsResult !== null) {
      pvwattsAnnualKwh = Math.round(pvwattsResult.acAnnual * shadingLossFactor);
      monthlyKwh       = pvwattsResult.acMonthly?.map(v => Math.round(v * shadingLossFactor));
      dcAnnualKwh      = pvwattsResult.dcAnnual   ? Math.round(pvwattsResult.dcAnnual   * shadingLossFactor) : undefined;
      dcMonthlyKwh     = pvwattsResult.dcMonthly?.map(v => Math.round(v * shadingLossFactor));
      poaMonthly       = pvwattsResult.poaMonthly?.map(v => Math.round(v));
      solradAnnual     = pvwattsResult.solradAnnual;
      capacityFactor   = pvwattsResult.capacityFactor;
    }

    if (solarPotential?.solarPanelConfigs?.length) {
      const configs: SolarPanelConfig[] = solarPotential.solarPanelConfigs;
      const closest = configs.reduce((prev, curr) =>
        Math.abs(curr.panelsCount - panelCount) < Math.abs(prev.panelsCount - panelCount) ? curr : prev,
        configs[0]
      );
      googleAnnualKwh = Math.round((closest.yearlyEnergyDcKwh ?? 0) * 0.80 * shadingLossFactor);
    }

    let annualKwh = 0;
    let productionConfidence: 'high' | 'medium' | 'low' | undefined;

    if (pvwattsAnnualKwh != null && googleAnnualKwh != null) {
      annualKwh = pvwattsAnnualKwh;
      const avg = (pvwattsAnnualKwh + googleAnnualKwh) / 2;
      const diffPct = (Math.abs(pvwattsAnnualKwh - googleAnnualKwh) / avg) * 100;
      productionConfidence = diffPct < 10 ? 'high' : diffPct < 20 ? 'medium' : 'low';
    } else if (pvwattsAnnualKwh != null) {
      annualKwh = pvwattsAnnualKwh;
    } else if (googleAnnualKwh != null) {
      annualKwh = googleAnnualKwh;
      warnings.push('Production estimate uses Google Solar data — PVWatts was unavailable.');
    } else {
      annualKwh = Math.round(systemCapacityKw * 1400 * shadingLossFactor);
      warnings.push('Production is estimated using national averages.');
    }

    // ── Step 6: Utility rate — NREL street-level beats EIA state average ──────
    const utilityRate = nrelRateResult?.rate ?? eiaRate ?? DEFAULT_UTILITY_RATE_PER_KWH;
    const utilityName = nrelRateResult?.utilityName;
    const isStreetLevelRate = nrelRateResult?.rate != null;

    let annualConsumptionKwh = STATE_AVG_CONSUMPTION_KWH[stateAbbr] ?? DEFAULT_ANNUAL_CONSUMPTION_KWH;
    let isStateAverage = true;

    if (monthlyBill && monthlyBill > 0) {
      annualConsumptionKwh = (monthlyBill / utilityRate) * 12;
      isStateAverage = false;
    }
    annualConsumptionKwh *= consumptionFactor;

    const usableKwh    = Math.min(annualKwh, annualConsumptionKwh);
    const annualSavings = usableKwh * utilityRate;
    const offsetPercent = Math.min(100, Math.round((annualKwh / annualConsumptionKwh) * 100));

    // ── Step 7: Cost + incentives + payback ──────────────────────────────────
    const costLow      = systemCapacityKw * 1000 * COST_PER_WATT_LOW;
    const costHigh     = systemCapacityKw * 1000 * COST_PER_WATT_HIGH;
    const costMidpoint = (costLow + costHigh) / 2;
    const federalITCDollars = costMidpoint * FEDERAL_ITC_PERCENT;

    const stateIncentives: StateIncentive[] = STATE_INCENTIVES[stateAbbr] ?? DEFAULT_STATE_INCENTIVES;
    const netMetering = NET_METERING[stateAbbr] ?? DEFAULT_NET_METERING;
    const storageIncentive = stateIncentives.find(i =>
      i.name.toLowerCase().includes('storage') ||
      i.name.toLowerCase().includes('battery') ||
      i.name.toLowerCase().includes('sgip')
    );

    const netCostLow  = costLow  * (1 - FEDERAL_ITC_PERCENT);
    const netCostHigh = costHigh * (1 - FEDERAL_ITC_PERCENT);
    const paybackLowRaw  = netCostLow  / (annualSavings * 1.05);
    const paybackHighRaw = netCostHigh / annualSavings;

    const shadingInfo = shadingFromSunshineHours(sunshineHoursPerYear);

    // ── Step 8: Data Layers flux map metadata ─────────────────────────────────
    let fluxMap: FluxMapData | undefined;
    if (dataLayers?.annualFluxUrl && dataLayers?.boundingBox) {
      const bb = dataLayers.boundingBox;
      fluxMap = {
        annualFluxUrl: dataLayers.annualFluxUrl,
        monthlyFluxUrl: dataLayers.monthlyFluxUrl,
        maskUrl: dataLayers.maskUrl,
        bounds: {
          north: bb.ne?.latitude  ?? (solarLat + 0.001),
          south: bb.sw?.latitude  ?? (solarLat - 0.001),
          east:  bb.ne?.longitude ?? (solarLng + 0.001),
          west:  bb.sw?.longitude ?? (solarLng - 0.001),
        },
      };
    }

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
        imageryDate,
        imageryQuality,
        carbonOffsetKgPerMwh,
        panelLifetimeYears,
        panelHeightMeters,
        panelWidthMeters,
        wholeRoofStats,
        maxPanelCount,
        maxUsableAreaSqFt: maxUsableAreaSqFt ? Math.round(maxUsableAreaSqFt) : undefined,
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
        panelConfigs,
        panelCapacityWatts,
        pvwattsAnnualKwh,
        googleAnnualKwh,
        productionConfidence,
        capacityFactor,
        dcAnnualKwh,
        dcMonthlyKwh,
        poaMonthly,
        solradAnnual,
      },
      savings: {
        offsetPercent,
        annualSavings: Math.round(annualSavings),
        utilityRatePerKwh: utilityRate,
        utilityName,
        stateAbbr,
        annualConsumptionKwh: Math.round(annualConsumptionKwh),
        isStateAverage,
        isStreetLevelRate,
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
        netCostAfterITC: Math.round(((costLow + costHigh) / 2) * (1 - FEDERAL_ITC_PERCENT)),
      },
      generatedAt: new Date().toISOString(),
      dataQuality,
      warnings: warnings.length > 0 ? warnings : undefined,
      roofImageUrl: `/api/satellite?lat=${lat}&lng=${lng}`,
      googleFinancial,
      fluxMap,
    };

    return NextResponse.json(assessment);
  } catch (err) {
    console.error('[assess] error:', err);
    return NextResponse.json(
      { error: 'Something went wrong while pulling your assessment. Please try again.' },
      { status: 500 }
    );
  }
}

// ── Google Solar buildingInsights ────────────────────────────────────────────

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

interface SolarSegmentSummary {
  segmentIndex?: number;
  panelsCount?: number;
  yearlyEnergyDcKwh?: number;
  pitchDegrees?: number;
  azimuthDegrees?: number;
}

interface SolarPanelConfig {
  panelsCount: number;
  yearlyEnergyDcKwh?: number;
  roofSegmentSummaries?: SolarSegmentSummary[];
}

interface GoogleAnalysis {
  monthlyBill?: { units?: string };
  cashPurchaseSavings?: {
    paybackYears?: number;
    savings?: { presentValueOfSavingsLifetime?: { units?: string } };
  };
  financialDetails?: {
    federalIncentive?: { units?: string };
    netMeteringAllowed?: boolean;
    solarPercentage?: number;
  };
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

// ── Google Solar Data Layers ─────────────────────────────────────────────────

async function fetchDataLayers(lat: number, lng: number) {
  try {
    const url =
      `https://solar.googleapis.com/v1/dataLayers:get` +
      `?location.latitude=${lat}&location.longitude=${lng}` +
      `&radiusMeters=50&pixelSizeMeters=0.5` +
      `&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── NREL PVWatts V8 ──────────────────────────────────────────────────────────

interface PVWattsResult {
  acAnnual: number;
  acMonthly: number[];
  dcAnnual?: number;
  dcMonthly?: number[];
  poaMonthly?: number[];
  solradAnnual?: number;
  capacityFactor?: number;
}

async function fetchPVWatts(
  lat: number, lng: number,
  systemCapacityKw: number,
  azimuth: number,
  tilt: number
): Promise<PVWattsResult | null> {
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
      array_type: '1',
      module_type: '1',
      losses: '14',
    });
    const res = await fetch(`https://developer.nrel.gov/api/pvwatts/v8.json?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const o = data.outputs;
    if (o?.ac_annual == null) return null;
    return {
      acAnnual:      o.ac_annual     as number,
      acMonthly:    (o.ac_monthly    as number[]) ?? [],
      dcAnnual:      o.dc_annual     as number | undefined,
      dcMonthly:    (o.dc_monthly    as number[]) ?? undefined,
      poaMonthly:   (o.poa_monthly   as number[]) ?? undefined,
      solradAnnual:  o.solrad_annual as number | undefined,
      capacityFactor: o.capacity_factor as number | undefined,
    };
  } catch {
    return null;
  }
}

// ── NREL Utility Rates V3 ────────────────────────────────────────────────────

async function fetchNRELUtilityRate(lat: number, lng: number): Promise<{ rate: number; utilityName: string } | null> {
  const key = process.env.NREL_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({ api_key: key, lat: lat.toString(), lon: lng.toString() });
    const res = await fetch(
      `https://developer.nrel.gov/api/utility_rates/v3.json?${params}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.outputs?.residential;
    if (rate == null) return null;
    return {
      rate: parseFloat(rate),
      utilityName: data?.outputs?.utility_name ?? '',
    };
  } catch {
    return null;
  }
}

// ── EIA Electricity Retail Rate (state-level fallback) ───────────────────────

async function fetchEIARate(stateAbbr: string): Promise<number | null> {
  const key = process.env.EIA_API_KEY;
  if (!key || !stateAbbr) return null;
  try {
    const url =
      `https://api.eia.gov/v2/electricity/retail-sales/data/` +
      `?api_key=${key}` +
      `&frequency=monthly&data[]=price` +
      `&facets[sectorid][]=RES&facets[stateid][]=${stateAbbr}` +
      `&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    const priceCents = data?.response?.data?.[0]?.price;
    if (priceCents == null) return null;
    return parseFloat(priceCents) / 100;
  } catch {
    return null;
  }
}
