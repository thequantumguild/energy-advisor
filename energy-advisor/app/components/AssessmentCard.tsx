'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Assessment, StateIncentive, ReOptData } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import SolarMap from './SolarMap';
import SolarSegmentOverlay from './SolarSegmentOverlay';
import MonthlyProductionChart from './MonthlyProductionChart';
import PanelSlider from './PanelSlider';
import RoofHistogram from './RoofHistogram';
import FluxMap from './FluxMap';
import SharpenForm from './SharpenForm';
import AssessmentChat from './AssessmentChat';

// PDF renderer uses browser APIs — load client-side only
const DownloadPDFButton = dynamic(() => import('./AssessmentPDF'), { ssr: false });

interface SharpenValues {
  monthlyBill?: number;
  shadingOverride?: 'yes' | 'partially' | 'lots';
  electricLoads?: string[];
  stayYears?: '<5' | '5-10' | '10+';
  roofAge?: 'new' | 'good' | 'aging' | 'unknown';
  batteryInterest?: 'yes' | 'maybe' | 'no';
  paymentPreference?: 'cash' | 'loan' | 'lease_ppa' | 'unsure';
}

interface Props {
  assessment: Assessment;
  onLocationRefine?: (lat: number, lng: number) => void;
  onSharpen?: (values: SharpenValues) => void;
  isRefining?: boolean;
}

export default function AssessmentCard({ assessment, onLocationRefine, onSharpen, isRefining }: Props) {
  const { roof, production, savings, cost, incentives, payback } = assessment;

  const [refineOpen, setRefineOpen] = useState(false);
  // Shared state: which segments are active based on panel slider position
  const [activeSegmentIndices, setActiveSegmentIndices] = useState<number[] | undefined>(undefined);

  // ReOpt — loads asynchronously after main assessment renders
  const [reopt, setReopt] = useState<ReOptData | null>(null);
  const [reoptLoading, setReoptLoading] = useState(false);

  useEffect(() => {
    setReoptLoading(true);
    fetch('/api/reopt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: roof.lat,
        lng: roof.lng,
        annualConsumptionKwh: savings.annualConsumptionKwh,
        utilityRatePerKwh: savings.utilityRatePerKwh,
        systemCapacityKw: production.systemCapacityKw,
        maxSystemKw: roof.maxPanelCount && production.panelCapacityWatts
          ? (roof.maxPanelCount * production.panelCapacityWatts) / 1000
          : undefined,
      }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data && !data.error) setReopt(data); })
      .catch(() => null)
      .finally(() => setReoptLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment.generatedAt]);

  const avgPayback = (payback.lowYears + payback.highYears) / 2;
  const verdict = (() => {
    const shadingPenalty = roof.shadingScore === 'significant';
    if (avgPayback <= 8 && !shadingPenalty) return {
      level: 'strong' as const,
      headline: 'Solar looks like a strong fit for this home.',
      detail: `Based on your roof and local rates, you'd likely break even in ${payback.lowYears}–${payback.highYears} years and save an estimated ${formatCurrency(savings.annualSavings)}/yr. That's a solid investment — now make sure you're getting a fair deal.`,
    };
    if (avgPayback <= 12) return {
      level: 'moderate' as const,
      headline: 'Solar is worth exploring — the numbers are decent.',
      detail: `Payback is estimated at ${payback.lowYears}–${payback.highYears} years. That's workable for most homeowners staying 10+ years. Your utility rate and system size are the key levers — refine your numbers below to tighten the picture.`,
    };
    return {
      level: 'caution' as const,
      headline: 'Proceed carefully — the numbers need to work for you.',
      detail: `The estimated payback at ${payback.lowYears}–${payback.highYears} years is on the longer end. ${shadingPenalty ? 'Significant shading on your roof is a major factor. ' : ''}That doesn't mean solar is wrong, but you need to understand every cost and incentive before committing.`,
    };
  })();

  const verdictStyle = {
    strong:   { bg: 'bg-emerald-950', border: 'border-emerald-800', dot: 'bg-emerald-400', text: 'text-emerald-400', detail: 'text-emerald-200/70' },
    moderate: { bg: 'bg-amber-950',   border: 'border-amber-800',   dot: 'bg-amber-400',   text: 'text-amber-400',   detail: 'text-amber-200/70' },
    caution:  { bg: 'bg-slate-900',   border: 'border-slate-700',   dot: 'bg-slate-400',   text: 'text-slate-300',   detail: 'text-slate-400' },
  }[verdict.level];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 animate-fade-up">

      {/* Verdict banner */}
      <div className={`rounded-2xl border px-6 py-5 ${verdictStyle.bg} ${verdictStyle.border}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${verdictStyle.dot}`} />
          <div>
            <p className={`text-base font-bold mb-1 ${verdictStyle.text}`}>{verdict.headline}</p>
            <p className={`text-sm leading-relaxed ${verdictStyle.detail}`}>{verdict.detail}</p>
          </div>
        </div>
      </div>

      {/* Address banner + actions */}
      <div className="flex items-start justify-between gap-4 px-1">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Assessment for</p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">{assessment.address}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <DataQualityBadge quality={assessment.dataQuality} />
          <DownloadPDFButton assessment={assessment} />
        </div>
      </div>

      {/* Refine your numbers — collapsible top panel */}
      {onSharpen && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setRefineOpen(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0z" />
              </svg>
              <span className="text-sm font-semibold text-slate-800">Refine your numbers</span>
              <span className="text-xs text-slate-400">Upload your bill or answer a few questions for a tighter estimate</span>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${refineOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </button>
          {refineOpen && (
            <div className="px-6 pb-6 border-t border-slate-100">
              <div className="pt-5">
                <SharpenForm onSubmit={onSharpen} isLoading={isRefining ?? false} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ask about your assessment — top of page */}
      <AssessmentChat assessment={assessment} />

      {/* Warnings */}
      {assessment.warnings?.map((w, i) => (
        <div key={i} className="flex gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <WarningIcon />
          {w}
        </div>
      ))}

      {/* Roof — full width */}
      <RoofSection
        roof={roof}
        roofImageUrl={assessment.roofImageUrl}
        onLocationRefine={onLocationRefine}
        activeSegmentIndices={activeSegmentIndices}
      />

      {/* 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProductionSection
          production={production}
          utilityRate={savings.utilityRatePerKwh}
          onActiveSegments={setActiveSegmentIndices}
        />
        <SavingsSection savings={savings} />
        <CostSection cost={cost} />
        {roof.carbonOffsetKgPerMwh && (
          <CarbonSection
            annualKwh={production.annualKwh}
            carbonOffsetKgPerMwh={roof.carbonOffsetKgPerMwh}
            panelLifetimeYears={roof.panelLifetimeYears}
          />
        )}
      </div>

      {/* Full-width sections */}
      <IncentivesSection incentives={incentives} cost={cost} />
      <PaybackSection payback={payback} savings={savings} googleFinancial={assessment.googleFinancial} />
      <ReOptSection reopt={reopt} loading={reoptLoading} systemCapacityKw={production.systemCapacityKw} />
      <FlagsSection cost={cost} incentives={incentives} />
    </div>
  );
}

// ── Shared primitives ────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
      {children}
    </p>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${accent ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-xs text-slate-400 hover:text-blue-600 hover:underline transition-colors">
      Source: {label} →
    </a>
  );
}

function DataQualityBadge({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  const map = {
    high:   { label: 'Satellite data',    color: 'bg-green-100 text-green-700' },
    medium: { label: 'Estimated',         color: 'bg-amber-100 text-amber-700' },
    low:    { label: 'Regional estimate', color: 'bg-slate-100 text-slate-600' },
  };
  const { label, color } = map[quality];
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${color}`}>
      {label}
    </span>
  );
}

function WarningIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

// ── Section 1: Your Roof ─────────────────────────────────────────────────────

function RoofSection({
  roof, roofImageUrl, onLocationRefine, activeSegmentIndices,
}: {
  roof: Assessment['roof'];
  roofImageUrl?: string;
  onLocationRefine?: (lat: number, lng: number) => void;
  activeSegmentIndices?: number[];
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  const shadingColor = {
    minimal:     'bg-green-100 text-green-700',
    moderate:    'bg-amber-100 text-amber-700',
    significant: 'bg-red-100 text-red-700',
  }[roof.shadingScore];

  const peakSunHoursPerDay = (roof.sunshineHoursPerYear / 365).toFixed(1);
  const hasSegments     = !!(roof.roofSegments && roof.roofSegments.length > 0);
  const useInteractiveMap = hasSegments && !mapFailed;
  const hasMapContent = useInteractiveMap || (roofImageUrl && !imgFailed);

  const qualityColor = roof.imageryQuality === 'HIGH' ? 'text-green-600'
    : roof.imageryQuality === 'MEDIUM' ? 'text-amber-600' : 'text-slate-400';

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Your Roof</p>
        <div className="flex items-center gap-2">
          {roof.imageryQuality && (
            <span className={`text-xs font-medium ${qualityColor}`}>
              {roof.imageryQuality.toLowerCase()} quality imagery
            </span>
          )}
          {roof.imageryDate && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {roof.imageryDate}
            </span>
          )}
        </div>
      </div>

      {/* Side-by-side: Google map + Flux map */}
      <div className={`grid gap-3 mb-5 ${hasMapContent ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Left: Google satellite / interactive map */}
        {hasMapContent && (
          <div className="relative group cursor-pointer" onClick={() => setMapExpanded(true)}>
            <div className="rounded-xl overflow-hidden border border-slate-100 h-48">
              {useInteractiveMap ? (
                <div className="pointer-events-none h-full">
                  <SolarMap
                    centerLat={roof.lat}
                    centerLng={roof.lng}
                    segments={roof.roofSegments!}
                    onError={() => setMapFailed(true)}
                    onLocationRefine={onLocationRefine}
                    activeSegmentIndices={activeSegmentIndices}
                  />
                </div>
              ) : roofImageUrl && !imgFailed ? (
                <div className="relative w-full h-full">
                  <img src={roofImageUrl} alt="Satellite view of property"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={() => setImgFailed(true)}
                  />
                  {hasSegments && (
                    <SolarSegmentOverlay
                      centerLat={roof.lat} centerLng={roof.lng} segments={roof.roofSegments!}
                    />
                  )}
                </div>
              ) : null}
            </div>
            {/* Expand overlay */}
            <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                Expand map
              </span>
            </div>
            <p className="text-xs text-slate-400 text-center mt-1.5">
              {hasSegments ? 'Google Solar — roof segments' : 'Google Maps — satellite'}
            </p>
          </div>
        )}

        {/* Right: Solar flux heat map */}
        <div>
          <FluxMap lat={roof.lat} lng={roof.lng} compact />
        </div>
      </div>

      {/* Expanded map modal */}
      {mapExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setMapExpanded(false)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden w-full max-w-3xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">
                {hasSegments ? 'Interactive roof segments — Google Solar API' : 'Satellite imagery — Google Maps'}
              </p>
              <button
                onClick={() => setMapExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[480px]">
              {useInteractiveMap ? (
                <SolarMap
                  centerLat={roof.lat}
                  centerLng={roof.lng}
                  segments={roof.roofSegments!}
                  onError={() => { setMapFailed(true); setMapExpanded(false); }}
                  onLocationRefine={onLocationRefine}
                  activeSegmentIndices={activeSegmentIndices}
                />
              ) : roofImageUrl && !imgFailed ? (
                <img src={roofImageUrl} alt="Satellite view of property" className="w-full h-full object-cover" />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Sunshine distribution */}
      {roof.wholeRoofStats?.sunshineQuantiles && (
        <RoofHistogram sunshineQuantiles={roof.wholeRoofStats.sunshineQuantiles} />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        <Stat label="Usable solar area" value={`${formatNumber(roof.usableAreaSqFt)} sq ft`} />
        <Stat label="Orientation" value={roof.azimuthLabel} sub={`${roof.pitchDegrees}° pitch`} />
        <Stat
          label="Peak sun hours"
          value={`${peakSunHoursPerDay} hrs/day`}
          sub={`${formatNumber(roof.sunshineHoursPerYear)} hrs/yr`}
        />
        <div>
          <p className="text-xs text-slate-500 mb-1">Shading</p>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${shadingColor}`}>
            {roof.shadingLabel}
          </span>
          <p className="text-xs text-slate-400 mt-1.5">{roof.estimatedPanelCount} panels estimated</p>
        </div>
      </div>

      {(roof.panelHeightMeters || roof.panelWidthMeters || roof.panelLifetimeYears || roof.maxPanelCount) && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
          {roof.panelHeightMeters && roof.panelWidthMeters && (
            <span>Panel size: {(roof.panelHeightMeters * 100).toFixed(0)} × {(roof.panelWidthMeters * 100).toFixed(0)} cm</span>
          )}
          {roof.panelLifetimeYears && <span>Lifetime: {roof.panelLifetimeYears} yrs</span>}
          {roof.maxPanelCount && <span>Max panels: {roof.maxPanelCount}</span>}
          {roof.maxUsableAreaSqFt && <span>Max area: {formatNumber(roof.maxUsableAreaSqFt)} sq ft</span>}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-100">
        <SourceLink href="https://developers.google.com/maps/documentation/solar" label="Google Solar API" />
      </div>
    </Card>
  );
}

// ── Section 2: Estimated Production ─────────────────────────────────────────

function ProductionSection({
  production, utilityRate, onActiveSegments,
}: {
  production: Assessment['production'];
  utilityRate: number;
  onActiveSegments?: (indices: number[]) => void;
}) {
  const homes = production.equivalentHomes;
  const homesLabel =
    homes < 1 ? `About ${Math.round(homes * 10) / 10} of an average US home per year`
    : homes === 1 ? 'Enough to power 1 average US home per year'
    : `Enough to power ${homes} average US homes per year`;

  const hasDual = production.pvwattsAnnualKwh != null && production.googleAnnualKwh != null;
  const conf = production.productionConfidence;
  const confidenceBadge = {
    high:   'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    low:    'bg-red-100 text-red-700',
  }[conf ?? 'medium'] ?? 'bg-slate-100 text-slate-600';

  const lo = hasDual ? Math.min(production.pvwattsAnnualKwh!, production.googleAnnualKwh!) : null;
  const hi = hasDual ? Math.max(production.pvwattsAnnualKwh!, production.googleAnnualKwh!) : null;

  const dualExplainer = hasDual ? (() => {
    if (conf === 'high') return {
      headline: 'Both models agree — strong estimate.',
      body: `Two independent methods — NREL's weather simulation and Google's satellite roof model — came within 10% of each other. That agreement is a good sign. Your realistic annual output is around ${formatNumber(production.annualKwh)} kWh.`,
      action: null,
    };
    if (conf === 'medium') return {
      headline: 'Minor divergence — normal range.',
      body: `The two models differ by 10–20%, which is common. NREL uses historical weather patterns; Google models the actual shadows on your roof from satellite imagery. Your realistic range is ${formatNumber(lo!)}–${formatNumber(hi!)} kWh/yr. Plan around the middle.`,
      action: null,
    };
    return {
      headline: 'The models disagree — here\'s what that means for you.',
      body: `NREL's weather model projects ${formatNumber(production.pvwattsAnnualKwh!)} kWh using regional climate data. Google's satellite model sees ${formatNumber(production.googleAnnualKwh!)} kWh after mapping actual shadows on your roof. A gap this large almost always means shading — trees, chimneys, or neighboring structures — that the weather model doesn't account for.`,
      action: `Use ${formatNumber(lo!)}–${formatNumber(hi!)} kWh/yr as your planning range. Ask any installer for a shade report (Solmetric SunEye or similar) before signing a contract — it takes 20 minutes and closes this gap.`,
    };
  })() : null;

  return (
    <Card className="md:col-span-2">
      <SectionLabel>Estimated Production</SectionLabel>

      <div className="flex flex-wrap items-end gap-6 mb-1">
        <div>
          <p className="text-4xl font-bold text-slate-900">
            {formatNumber(production.annualKwh)}
            <span className="text-xl font-medium text-slate-400 ml-1">kWh / yr</span>
          </p>
          <p className="text-sm text-slate-500 mt-1">{homesLabel}</p>
        </div>
        <Stat label="System size" value={`${production.systemCapacityKw} kW`} sub="DC nameplate" />
        {production.panelCapacityWatts && (
          <Stat label="Panel capacity" value={`${production.panelCapacityWatts}W`} sub="per panel" />
        )}
        {production.capacityFactor != null && (
          <Stat
            label="Capacity factor"
            value={`${production.capacityFactor.toFixed(1)}%`}
            sub="actual ÷ theoretical max"
          />
        )}
      </div>

      {/* Dual source comparison */}
      {hasDual && dualExplainer && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4">

          {/* Two numbers side by side — Google primary (right), NREL secondary (left) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-0.5">NREL PVWatts V8</p>
              <p className="text-lg font-bold text-blue-600">
                {formatNumber(production.pvwattsAnnualKwh!)}
                <span className="text-sm font-normal text-blue-400 ml-1">kWh/yr</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">30-yr weather simulation</p>
            </div>
            <div className="border-l-2 border-emerald-200 pl-4">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-xs font-medium text-slate-500">Google Solar API</p>
                <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full">Primary</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">
                {formatNumber(production.googleAnnualKwh!)}
                <span className="text-sm font-normal text-emerald-400 ml-1">kWh/yr</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Satellite shadow modeling</p>
            </div>
          </div>

          {/* Confidence badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${confidenceBadge}`}>
              {conf === 'high' ? '● High confidence' : conf === 'medium' ? '◑ Medium confidence' : '○ Low confidence'}
            </span>
          </div>

          {/* What does this mean */}
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700">{dualExplainer.headline}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{dualExplainer.body}</p>
            {dualExplainer.action && (
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-xs text-amber-800 leading-relaxed"><strong>What to do:</strong> {dualExplainer.action}</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Extended PVWatts data */}
      {(production.dcAnnualKwh || production.solradAnnual) && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
          {production.dcAnnualKwh && (
            <span>DC output: {formatNumber(production.dcAnnualKwh)} kWh/yr</span>
          )}
          {production.solradAnnual && (
            <span>Solar radiation: {production.solradAnnual.toFixed(1)} kWh/m²/day annual avg</span>
          )}
        </div>
      )}

      {production.monthlyKwh && production.monthlyKwh.length === 12 && (
        <MonthlyProductionChart monthlyKwh={production.monthlyKwh} />
      )}

      {production.panelConfigs && production.panelConfigs.length > 0 && production.panelCapacityWatts && (
        <PanelSlider
          panelConfigs={production.panelConfigs}
          panelCapacityWatts={production.panelCapacityWatts}
          utilityRate={utilityRate}
          onActiveSegments={onActiveSegments}
        />
      )}

      <div className="pt-4 border-t border-slate-100 mt-4">
        {production.pvwattsAnnualKwh != null
          ? <SourceLink href="https://pvwatts.nrel.gov/" label="NREL PVWatts V8" />
          : <SourceLink href="https://developers.google.com/maps/documentation/solar" label="Google Solar API" />
        }
      </div>
    </Card>
  );
}

// ── Section 3: Savings ───────────────────────────────────────────────────────

function SavingsSection({ savings }: { savings: Assessment['savings'] }) {
  return (
    <Card>
      <SectionLabel>Estimated Savings</SectionLabel>
      <p className="text-4xl font-bold text-green-600 mb-1">
        {formatCurrency(savings.annualSavings)}
        <span className="text-xl font-medium text-green-400 ml-1">/ yr</span>
      </p>
      <p className="text-sm text-slate-700 mb-4">
        Estimated <span className="font-semibold">{savings.offsetPercent}%</span> of your electricity offset
      </p>
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">
            {savings.utilityName || savings.stateAbbr} rate
            {savings.isStreetLevelRate && (
              <span className="ml-1.5 text-green-600 font-medium">(street-level)</span>
            )}
          </span>
          <span className="font-medium text-slate-700">${savings.utilityRatePerKwh.toFixed(3)}/kWh</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Annual consumption used</span>
          <span className="font-medium text-slate-700">{formatNumber(savings.annualConsumptionKwh)} kWh</span>
        </div>
        {savings.isStateAverage && (
          <p className="text-xs text-amber-600 pt-1">
            Using {savings.stateAbbr} state average — enter your monthly bill above for a more accurate number.
          </p>
        )}
        <SourceLink href="https://developer.nrel.gov/docs/electricity/utility-rates-v3/" label="NREL Utility Rates V3" />
      </div>
    </Card>
  );
}

// ── Section 4: Cost Range ────────────────────────────────────────────────────

function CostSection({ cost }: { cost: Assessment['cost'] }) {
  return (
    <Card>
      <SectionLabel>Cost Range</SectionLabel>
      <p className="text-3xl font-bold text-slate-900 mb-1">
        {formatCurrency(cost.lowEstimate)}
        <span className="text-slate-400 font-medium mx-1">–</span>
        {formatCurrency(cost.highEstimate)}
      </p>
      <p className="text-xs text-slate-500 mb-4">
        ${cost.costPerWattLow.toFixed(2)}–${cost.costPerWattHigh.toFixed(2)} per watt · {cost.systemCapacityKw} kW system
      </p>
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <p className="text-xs text-slate-500 leading-relaxed">
          Based on LBNL 2024 national residential benchmark data. Before any incentives.
        </p>
        <SourceLink href="https://emp.lbl.gov/tracking-the-sun" label="LBNL Tracking the Sun 2024" />
      </div>
    </Card>
  );
}

// ── Section 5: Carbon Offset ─────────────────────────────────────────────────

function CarbonSection({
  annualKwh, carbonOffsetKgPerMwh, panelLifetimeYears,
}: {
  annualKwh: number;
  carbonOffsetKgPerMwh: number;
  panelLifetimeYears?: number;
}) {
  const annualCo2Kg    = Math.round((annualKwh / 1000) * carbonOffsetKgPerMwh);
  const lifetimeCo2Kg  = panelLifetimeYears ? annualCo2Kg * panelLifetimeYears : null;
  const treesEquivalent = Math.round(annualCo2Kg / 21.77);
  const carsOffRoad    = (annualCo2Kg / 4600).toFixed(1);

  return (
    <Card>
      <SectionLabel>Carbon Offset</SectionLabel>
      <p className="text-3xl font-bold text-emerald-600 mb-1">
        {formatNumber(annualCo2Kg)}
        <span className="text-lg font-medium text-emerald-400 ml-1">kg CO₂ / yr</span>
      </p>
      {lifetimeCo2Kg && (
        <p className="text-xs text-slate-400 mb-4">
          {formatNumber(Math.round(lifetimeCo2Kg / 1000))} metric tons over {panelLifetimeYears}-year panel life
        </p>
      )}
      <div className="space-y-2 mt-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-lg">🌳</span>
          <span>Equivalent to planting <strong>{formatNumber(treesEquivalent)}</strong> trees per year</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-lg">🚗</span>
          <span>Like taking <strong>{carsOffRoad}</strong> cars off the road</span>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <SourceLink href="https://developers.google.com/maps/documentation/solar" label="Google Solar API" />
      </div>
    </Card>
  );
}

// ── Section 6: Incentives ────────────────────────────────────────────────────

function IncentivesSection({ incentives, cost }: { incentives: Assessment['incentives']; cost: Assessment['cost'] }) {
  const nmColor = {
    full:    'bg-green-100 text-green-700',
    limited: 'bg-amber-100 text-amber-700',
    none:    'bg-red-100 text-red-700',
  }[incentives.netMeteringStatus];

  const nmLabel = {
    full:    'Full net metering',
    limited: 'Limited net metering',
    none:    'No net metering',
  }[incentives.netMeteringStatus];

  return (
    <Card>
      <SectionLabel>Incentives & Tax Credits</SectionLabel>

      {/* Homeowner: no solar ITC */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 mb-4">
        <p className="text-xs font-semibold text-slate-700">If you buy outright or take a solar loan</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          There is currently no federal tax credit for homeowners who purchase solar panels with cash or a loan. Check your state — some states offer rebates, tax credits, or property tax exemptions that do pass directly to you.
        </p>
        <p className="text-xs font-semibold text-slate-700 pt-1">Battery storage credit (Section 25D)</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          If you add battery storage, a federal residential energy storage credit may apply regardless of how you financed the solar. Verify current eligibility with a tax professional or the IRS directly.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <SourceLink href="https://www.irs.gov/credits-deductions/residential-clean-energy-credit" label="IRS — Residential Energy Credits" />
          <SourceLink href="https://www.dsireusa.org/" label="DSIRE — state & local incentives" />
        </div>
      </div>

      {/* TPO credits — what the installer gets */}
      <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 space-y-2 mb-4">
        <p className="text-xs font-semibold text-amber-800">If you lease or take a PPA — what the installer captures</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          The company that owns the panels claims these federal commercial tax incentives — not you. This is how they make the economics of a lease or PPA work:
        </p>
        <ul className="text-xs text-amber-700 space-y-1 pl-2">
          <li>· <strong>30% Investment Tax Credit (ITC, Section 48E)</strong> — base federal credit on the full system cost</li>
          <li>· <strong>+10% Domestic Content Bonus</strong> — if panels and structural components are US-manufactured</li>
          <li>· <strong>+10% Energy Community Bonus</strong> — if your address is in a qualifying brownfield or fossil fuel community</li>
        </ul>
        <p className="text-xs text-amber-700 leading-relaxed pt-1">
          These credits go to the installer, not you — but they're baked into the rates they offer you. Understanding this helps you negotiate.
        </p>
        <div className="pt-1">
          <SourceLink href="https://www.irs.gov/credits-deductions/businesses/energy-incentives-for-businesses" label="IRS — Commercial Energy Credits (Section 48E)" />
        </div>
      </div>

      {/* Net metering */}
      <div>
        <p className="text-xs text-slate-500 mb-2">Net Metering</p>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${nmColor}`}>{nmLabel}</span>
        <p className="text-xs text-slate-500 mt-3 leading-relaxed">{incentives.netMeteringDetail}</p>
      </div>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function IncentiveRow({ incentive }: { incentive: StateIncentive }) {
  const typeColor = {
    state:   'bg-purple-100 text-purple-700',
    utility: 'bg-teal-100 text-teal-700',
    local:   'bg-orange-100 text-orange-700',
  }[incentive.type];
  return (
    <div className="flex gap-3">
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full h-fit whitespace-nowrap mt-0.5 ${typeColor}`}>
        {incentive.type}
      </span>
      <div>
        <p className="text-sm font-medium text-slate-800">{incentive.name}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{incentive.description}</p>
        {incentive.url && (
          <a href={incentive.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline mt-1 inline-block">Verify →</a>
        )}
      </div>
    </div>
  );
}

// ── Section 7: Payback Range ─────────────────────────────────────────────────

function PaybackSection({
  payback, savings, googleFinancial,
}: {
  payback: Assessment['payback'];
  savings: Assessment['savings'];
  googleFinancial?: Assessment['googleFinancial'];
}) {
  return (
    <Card>
      <SectionLabel>Payback Range</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">LBNL benchmark estimate</p>
          <p className="text-4xl font-bold text-slate-900">
            {payback.lowYears}–{payback.highYears}
            <span className="text-xl font-medium text-slate-400 ml-1">years</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">System cost: {formatCurrency(payback.grossCost)} · No federal credit applied</p>
        </div>
        {googleFinancial && (googleFinancial.lifetimeSavingsDollars > 0 || googleFinancial.solarPercentage > 0) && (
          <div className="sm:border-l sm:border-slate-100 sm:pl-6 space-y-2">
            <p className="text-xs text-slate-400 mb-1">From Google Solar</p>
            {googleFinancial.lifetimeSavingsDollars > 0 && (
              <div>
                <p className="text-xs text-slate-500">Est. lifetime savings</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(googleFinancial.lifetimeSavingsDollars)}</p>
              </div>
            )}
            <div className="flex flex-col gap-1 text-xs text-slate-500 pt-1">
              {googleFinancial.solarPercentage > 0 && (
                <div className="flex justify-between">
                  <span>Solar % of usage</span>
                  <span className="font-medium text-slate-700">{Math.round(googleFinancial.solarPercentage)}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Net metering</span>
                <span className={`font-medium ${googleFinancial.netMeteringAllowed ? 'text-green-600' : 'text-red-600'}`}>
                  {googleFinancial.netMeteringAllowed ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
        <p>The lower end assumes modest utility rate increases and high self-consumption. The upper end uses today's rate with no escalation.</p>
        {savings.isStateAverage && (
          <p className="text-amber-600">Enter your monthly bill above to tighten this range considerably.</p>
        )}
      </div>
    </Card>
  );
}

// ── Section 8: NREL ReOpt Optimization ──────────────────────────────────────

function ReOptSection({
  reopt, loading, systemCapacityKw,
}: {
  reopt: ReOptData | null;
  loading: boolean;
  systemCapacityKw: number;
}) {
  if (!loading && !reopt) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">NREL ReOpt Optimization</p>
        {loading && (
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
            Optimizing…
          </span>
        )}
      </div>

      {loading && (
        <p className="text-sm text-slate-500">
          Running NREL&apos;s ReOpt optimizer to find the ideal system size and storage configuration for your location, utility rate, and consumption. This takes 30–90 seconds.
        </p>
      )}

      {reopt && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <Stat
              label="Optimal system size"
              value={`${reopt.optimalSystemKw} kW`}
              sub={reopt.optimalSystemKw !== systemCapacityKw
                ? `vs ${systemCapacityKw} kW estimated`
                : 'matches estimate'}
              accent={reopt.optimalSystemKw !== systemCapacityKw ? 'text-blue-700' : 'text-slate-900'}
            />
            {reopt.optimalBatteryKwh && (
              <Stat label="Optimal battery" value={`${reopt.optimalBatteryKwh} kWh`} sub="storage" />
            )}
            <Stat label="Net present value" value={formatCurrency(reopt.npvDollars)} accent={reopt.npvDollars > 0 ? 'text-green-700' : 'text-red-700'} />
            <Stat label="IRR" value={`${reopt.irrPercent}%`} sub="internal rate of return" />
            <Stat label="Simple payback" value={`${reopt.paybackYears} yrs`} />
            <Stat label="Levelized cost" value={`$${reopt.lcoePerKwh}/kWh`} sub="LCOE real" />
          </div>
          <div className="pt-4 border-t border-slate-100">
            <SourceLink href="https://reopt.nrel.gov/" label="NREL ReOpt v2" />
          </div>
        </>
      )}
    </Card>
  );
}

// ── Section 9: What to Watch For ────────────────────────────────────────────

function FlagsSection({ cost, incentives }: { cost: Assessment['cost']; incentives: Assessment['incentives'] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const flags = [
    {
      title: 'Fair price is $2.70–$3.50 per watt (LBNL 2024)',
      body: `A ${cost.systemCapacityKw} kW system should cost roughly ${formatCurrency(cost.lowEstimate)}–${formatCurrency(cost.highEstimate)} before incentives, based on Lawrence Berkeley National Laboratory's national residential benchmark. If a quote is more than 20% above that range, ask the installer to explain the markup line by line.`,
      source: { href: 'https://emp.lbl.gov/tracking-the-sun', label: 'LBNL Tracking the Sun 2024' },
    },
    {
      title: 'Battery storage will not eliminate your utility bill',
      body: 'Every utility charges a fixed monthly connection fee — typically $10–$30 — regardless of how much energy you produce or store. On top of that, any consumption that exceeds what your battery stored draws from the grid. Battery storage can meaningfully cut what you owe and provide backup power during outages, but "zero bill" is a sales claim. Ask to see your utility\'s interconnection agreement and rate tariff before believing it.',
      source: null,
    },
    {
      title: 'Lease and PPA: the company owns the panels — and the federal tax credits',
      body: 'With a lease or PPA, the installer — not you — claims the 30% federal Investment Tax Credit (Section 48E), plus any domestic content or energy community bonuses. Those credits are built into how they price the product. You get panels on your roof without upfront cost, but you give up ownership and long-term economics. In most 25-year models, cash purchase or a solar loan produces better outcomes. The real issue to watch: annual payment escalators, what happens when you sell the home, and what the company\'s bankruptcy clause says.',
      source: { href: 'https://www.irs.gov/credits-deductions/businesses/energy-incentives-for-businesses', label: 'IRS — Section 48E Commercial Energy Credit' },
    },
    {
      title: 'Get multiple quotes and read every word of the contract',
      body: 'Any installer who pressures you to sign before you have time to compare is not confident their quote can stand on its own. Three quotes is the standard minimum. Before signing anything, read the full contract — not just the price page. Understand the annual payment escalator, what happens if you sell the home, and who is responsible for maintenance and warranty claims. If a term is unclear, ask for a plain-language explanation in writing before you sign.',
      source: null,
    },
    {
      title: 'The real question: will I save money starting day one?',
      body: 'Aggregate payback math is abstract. What actually matters to most homeowners is whether the solar payment is less than the bill reduction from month one. With a PPA or lease you will likely see immediate savings compared to your current bill — but over 25 years you will almost certainly pay more than if you had purchased outright. With a solar loan, compare your monthly loan payment against your expected bill reduction — in many markets the savings exceed the payment from the first month. Cash purchase has the best long-term economics but requires capital upfront. Ask every installer to show you a year-one cash flow comparison across all three options, not just a payback year number.',
      source: null,
    },
    ...(incentives.netMeteringStatus !== 'full' ? [{
      title: 'Your state has limited net metering — self-consumption matters more',
      body: `${incentives.netMeteringDetail} This means the value of solar here is highest when you use power as it is generated, rather than exporting it to the grid.`,
      source: null,
    }] : []),
  ];

  return (
    <Card className="border-amber-200 bg-amber-50">
      <SectionLabel>What to Watch For</SectionLabel>
      <p className="text-xs text-slate-500 mb-4">
        These are the things that trip up homeowners. Knowing them makes you a better buyer.
      </p>
      <div className="space-y-1">
        {flags.map((flag, i) => (
          <div key={i} className="rounded-xl border border-amber-200 bg-white overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-amber-50 transition-colors"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
            >
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{i + 1}</span>
              </div>
              <span className="text-sm font-semibold text-slate-800 flex-1">{flag.title}</span>
              <svg
                className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
              </svg>
            </button>
            {openIndex === i && (
              <div className="px-4 pb-4 pt-1 border-t border-amber-100">
                <p className="text-sm text-slate-600 leading-relaxed">{flag.body}</p>
                {flag.source && (
                  <div className="mt-2">
                    <SourceLink href={flag.source.href} label={flag.source.label} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
