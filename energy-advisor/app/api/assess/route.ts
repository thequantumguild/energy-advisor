import { NextRequest, NextResponse } from 'next/server';
import type {
  Assessment, AssessmentRequest, StateIncentive,
  RoofSegment, PanelConfig, WholeRoofStats, GoogleFinancialSummary, FluxMapData,
  AdderEstimate, SavingsProjection, YearlyProjectionPoint,
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
    const {
      address, monthlyBill, hasHighLoads, shadingOverride,
      lat: overrideLat, lng: overrideLng,
      electricLoads, stayYears, roofAge, batteryInterest, paymentPreference,
      panelTier, inverterType,
    } = body;

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

    const [solarData, eiaRate, nrelRateResult, dataLayers, eiaCAGR] = await Promise.all([
      fetchSolarData(solarLat, solarLng),
      fetchEIARate(stateAbbr),
      fetchNRELUtilityRate(solarLat, solarLng),
      fetchDataLayers(solarLat, solarLng),
      fetchEIAHistoricalCAGR(stateAbbr),
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
            monthlyBillDollars:     parseInt(best.monthlyBill?.units ?? '0'),
            lifetimeSavingsDollars: parseInt(cash.savings?.presentValueOfSavingsLifetime?.units ?? '0'),
            netMeteringAllowed:     details.netMeteringAllowed ?? false,
            solarPercentage:        details.solarPercentage ?? 0,
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

    // Snow loss by state (added on top of PVWatts base 14% losses)
    const SNOW_LOSS_PCT: Record<string, number> = {
      MN: 5, WI: 4, MI: 4, ND: 5, SD: 4, MT: 4, WY: 3, CO: 3,
      VT: 5, NH: 4, ME: 5, NY: 3, PA: 3, OH: 3, IN: 3, IL: 3,
      MA: 3, RI: 2, CT: 2, NJ: 2, MD: 2, WV: 2, IA: 3, NE: 2,
      MO: 2, KY: 1, VA: 1, ID: 3, WA: 2, OR: 1,
    };
    const snowLoss = SNOW_LOSS_PCT[stateAbbr] ?? 0;
    // Inverter efficiency adjustment to base losses
    const INVERTER_EFFICIENCY: Record<string, number> = { string: 96.5, micro: 98.0, optimizer: 97.5 };
    const inverterEfficiencyPct = INVERTER_EFFICIENCY[inverterType ?? ''] ?? 96.5;
    // PVWatts losses = base 14% + snow. Inverter efficiency is already embedded in module_type.
    const pvwattsLosses = Math.min(30, 14 + snowLoss);
    const systemLossPct = pvwattsLosses;

    const pvwattsResult = await fetchPVWatts(solarLat, solarLng, systemCapacityKw, azimuthDegrees, pitchDegrees, pvwattsLosses);
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

    // Adjust for known high loads from refinement form
    if (electricLoads?.includes('ev'))         annualConsumptionKwh += 3500;
    if (electricLoads?.includes('pool'))        annualConsumptionKwh += 2000;
    if (electricLoads?.includes('heat_pump'))   annualConsumptionKwh += 2500;
    if (electricLoads?.includes('elec_water'))  annualConsumptionKwh += 1200;

    // Flags from refinement
    if (stayYears === '<5') {
      const avgPayback = Math.round((systemCapacityKw * 1000 * (COST_PER_WATT_LOW + COST_PER_WATT_HIGH) / 2) / ((annualConsumptionKwh * Math.min(annualKwh, annualConsumptionKwh) / annualConsumptionKwh) * utilityRate));
      if (avgPayback > 5) {
        warnings.push(`You mentioned planning to move within 5 years. The estimated payback period is longer — solar adds value when you sell, but confirm with a real estate professional in your market.`);
      }
    }
    if (roofAge === 'aging') {
      warnings.push('Your roof may be over 15 years old. Most installers require a roof in good condition before installing panels — get a roofer\'s assessment first to avoid paying twice.');
    }
    if (batteryInterest === 'yes' || batteryInterest === 'maybe') {
      warnings.push('You expressed interest in battery storage — see the NREL ReOpt optimization below for sizing and economics. The Section 25D residential storage credit may also apply.');
    }
    if (paymentPreference === 'lease_ppa') {
      warnings.push('You\'re open to a lease or PPA. The tools section has a contract scanner to review terms before you sign — escalators and home-sale clauses are the details that matter most.');
    }

    const usableKwh    = Math.min(annualKwh, annualConsumptionKwh);
    const annualSavings = usableKwh * utilityRate;
    const offsetPercent = Math.min(100, Math.round((annualKwh / annualConsumptionKwh) * 100));

    // ── Step 7: Cost + incentives + payback ──────────────────────────────────
    const costLow      = systemCapacityKw * 1000 * COST_PER_WATT_LOW;
    const costHigh     = systemCapacityKw * 1000 * COST_PER_WATT_HIGH;
    const stateIncentives: StateIncentive[] = STATE_INCENTIVES[stateAbbr] ?? DEFAULT_STATE_INCENTIVES;
    const netMetering = NET_METERING[stateAbbr] ?? DEFAULT_NET_METERING;
    const storageIncentive = stateIncentives.find(i =>
      i.name.toLowerCase().includes('storage') ||
      i.name.toLowerCase().includes('battery') ||
      i.name.toLowerCase().includes('sgip')
    );

    const paybackLowRaw  = costLow  / (annualSavings * 1.05);
    const paybackHighRaw = costHigh / annualSavings;

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
        p90Kwh: Math.round(annualKwh * 0.90),
        p10Kwh: Math.round(annualKwh * 1.10),
        inverterType: inverterType ?? undefined,
        inverterEfficiencyPct,
        systemLossPct,
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
        stateIncentives,
        netMeteringStatus: netMetering.status,
        netMeteringDetail: netMetering.detail,
        hasStorageIncentive: !!storageIncentive,
        storageDetail: storageIncentive?.description,
      },
      payback: {
        lowYears:  Math.max(5, Math.round(paybackLowRaw)),
        highYears: Math.max(6, Math.round(paybackHighRaw)),
        grossCost: Math.round((costLow + costHigh) / 2),
      },
      generatedAt: new Date().toISOString(),
      dataQuality,
      warnings: warnings.length > 0 ? warnings : undefined,
      roofImageUrl: `/api/satellite?lat=${lat}&lng=${lng}`,
      googleFinancial,
      fluxMap,
      projection: buildProjection(annualSavings, annualKwh, utilityRate, annualConsumptionKwh, eiaCAGR, panelTier),
      adders: buildAdders(systemCapacityKw, electricLoads, roofAge),
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
  tilt: number,
  losses = 14,
): Promise<PVWattsResult | null> {
  const key = process.env.NREL_API_KEY;
  if (!key) { console.error('[pvwatts] NREL_API_KEY is not set'); return null; }
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
      losses: losses.toString(),
    });
    const res = await fetch(`https://developer.nrel.gov/api/pvwatts/v8.json?${params}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[pvwatts] ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    if (data.errors?.length) { console.error('[pvwatts] API errors:', data.errors); return null; }
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
  } catch (err) {
    console.error('[pvwatts] fetch threw:', err);
    return null;
  }
}

// ── NREL Utility Rates V3 ────────────────────────────────────────────────────

async function fetchNRELUtilityRate(lat: number, lng: number): Promise<{ rate: number; utilityName: string } | null> {
  const key = process.env.NREL_API_KEY;
  if (!key) { console.error('[nrel-rates] NREL_API_KEY is not set'); return null; }
  try {
    const params = new URLSearchParams({ api_key: key, lat: lat.toString(), lon: lng.toString() });
    const res = await fetch(
      `https://developer.nrel.gov/api/utility_rates/v3.json?${params}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) {
      console.error(`[nrel-rates] ${res.status}`);
      return null;
    }
    const data = await res.json();
    const rate = data?.outputs?.residential;
    if (rate == null) { console.error('[nrel-rates] no residential rate in response'); return null; }
    return {
      rate: parseFloat(rate),
      utilityName: data?.outputs?.utility_name ?? '',
    };
  } catch (err) {
    console.error('[nrel-rates] fetch threw:', err);
    return null;
  }
}

// ── EIA Electricity Retail Rate (state-level fallback) ───────────────────────

async function fetchEIAHistoricalCAGR(stateAbbr: string): Promise<{ rate: number; source: 'eia_historical' | 'national_average' }> {
  const key = process.env.EIA_API_KEY;
  const NATIONAL_AVG = { rate: 0.027, source: 'national_average' as const };
  if (!key || !stateAbbr) return NATIONAL_AVG;
  try {
    const url =
      `https://api.eia.gov/v2/electricity/retail-sales/data/` +
      `?api_key=${key}` +
      `&frequency=annual&data[]=price` +
      `&facets[sectorid][]=RES&facets[stateid][]=${stateAbbr}` +
      `&sort[0][column]=period&sort[0][direction]=asc&length=12`;
    const res = await fetch(url, { next: { revalidate: 86400 * 30 } });
    if (!res.ok) return NATIONAL_AVG;
    const data = await res.json();
    const rows: { period: string; price: string }[] = data?.response?.data ?? [];
    if (rows.length < 5) return NATIONAL_AVG;
    const oldest = parseFloat(rows[0].price) / 100;
    const newest = parseFloat(rows[rows.length - 1].price) / 100;
    const years = rows.length - 1;
    if (!oldest || !newest || oldest <= 0) return NATIONAL_AVG;
    const cagr = Math.pow(newest / oldest, 1 / years) - 1;
    return { rate: Math.max(0.01, Math.min(0.06, cagr)), source: 'eia_historical' };
  } catch {
    return NATIONAL_AVG;
  }
}

function buildProjection(
  annualSavings: number,
  annualKwh: number,
  utilityRate: number,
  annualConsumptionKwh: number,
  eia: { rate: number; source: 'eia_historical' | 'national_average' },
  panelTier?: 'premium' | 'standard' | 'budget',
): SavingsProjection {
  const { rate: escalation, source } = eia;
  const yearlyData: YearlyProjectionPoint[] = [];
  let cumulative = 0;
  const DEGRADATION_BY_TIER = { premium: 0.003, standard: 0.005, budget: 0.007 };
  const PANEL_DEGRADATION = DEGRADATION_BY_TIER[panelTier ?? 'standard'];

  for (let yr = 1; yr <= 25; yr++) {
    const rateThisYear = utilityRate * Math.pow(1 + escalation, yr);
    const productionThisYear = annualKwh * Math.pow(1 - PANEL_DEGRADATION, yr - 1);
    const selfConsumed = Math.min(productionThisYear, annualConsumptionKwh);
    const annualBillWithout = annualConsumptionKwh * rateThisYear;
    const annualBillWith = Math.max(0, (annualConsumptionKwh - selfConsumed) * rateThisYear);
    const savings = annualBillWithout - annualBillWith;
    cumulative += savings;
    yearlyData.push({
      year: yr,
      monthlyBillWithout: Math.round(annualBillWithout / 12),
      monthlyBillWith: Math.round(annualBillWith / 12),
      annualSavings: Math.round(savings),
      cumulativeSavings: Math.round(cumulative),
    });
  }

  void annualSavings;
  return {
    escalationRate: escalation,
    escalationSource: source,
    totalSavings25yr: Math.round(cumulative),
    yearlyData,
    degradationRate: PANEL_DEGRADATION,
  };
}

function buildAdders(
  systemCapacityKw: number,
  electricLoads?: string[],
  roofAge?: string,
): AdderEstimate[] | undefined {
  const adders: AdderEstimate[] = [];

  // Main panel upgrade — likely needed for systems > 8 kW on older homes
  if (systemCapacityKw > 8) {
    adders.push({
      type: 'panel_upgrade',
      label: 'Main panel upgrade (MPU)',
      lowEstimate: 1500,
      highEstimate: 3500,
      likelihood: 'possible',
      note: `${systemCapacityKw} kW system may exceed 100A service capacity. Ask your installer to inspect your electrical panel — an upgrade is often required.`,
    });
  }

  // Roof replacement — flagged if aging
  if (roofAge === 'aging') {
    adders.push({
      type: 'roof_replacement',
      label: 'Roof replacement (before install)',
      lowEstimate: 8000,
      highEstimate: 18000,
      likelihood: 'likely',
      note: 'Roofs over 15 years typically need replacement before solar installation. Installers will not warranty panels on a failing roof. Get a roofer quote first.',
    });
  }

  // EV charger
  if (electricLoads?.includes('ev')) {
    adders.push({
      type: 'ev_charger',
      label: 'Level 2 EV charger install',
      lowEstimate: 600,
      highEstimate: 1400,
      likelihood: 'likely',
      note: 'Adding a 240V Level 2 charger while the electrician is already on-site for solar is cost-efficient. Covers EVSE hardware + install labor.',
    });
  }

  return adders.length > 0 ? adders : undefined;
}

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
