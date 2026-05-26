'use client';

import { useState } from 'react';
import type { Assessment, StateIncentive } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import SolarMap from './SolarMap';
import SolarSegmentOverlay from './SolarSegmentOverlay';
import MonthlyProductionChart from './MonthlyProductionChart';
import PanelSlider from './PanelSlider';
import RoofHistogram from './RoofHistogram';

interface Props {
  assessment: Assessment;
}

export default function AssessmentCard({ assessment }: Props) {
  const { roof, production, savings, cost, incentives, payback } = assessment;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 animate-fade-up">
      {/* Address banner */}
      <div className="flex items-start justify-between gap-4 px-1">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Assessment for</p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">{assessment.address}</p>
        </div>
        <DataQualityBadge quality={assessment.dataQuality} />
      </div>

      {/* Warnings */}
      {assessment.warnings?.map((w, i) => (
        <div key={i} className="flex gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <WarningIcon />
          {w}
        </div>
      ))}

      {/* Roof — full width with interactive map */}
      <RoofSection roof={roof} roofImageUrl={assessment.roofImageUrl} />

      {/* 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProductionSection production={production} utilityRate={savings.utilityRatePerKwh} />
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

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-slate-400 hover:text-blue-600 hover:underline transition-colors"
    >
      Source: {label} →
    </a>
  );
}

function DataQualityBadge({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  const map = {
    high:   { label: 'Satellite data', color: 'bg-green-100 text-green-700' },
    medium: { label: 'Estimated', color: 'bg-amber-100 text-amber-700' },
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

function RoofSection({ roof, roofImageUrl }: { roof: Assessment['roof']; roofImageUrl?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const shadingColor = {
    minimal:     'bg-green-100 text-green-700',
    moderate:    'bg-amber-100 text-amber-700',
    significant: 'bg-red-100 text-red-700',
  }[roof.shadingScore];

  const peakSunHoursPerDay = (roof.sunshineHoursPerYear / 365).toFixed(1);
  const hasSegments = !!(roof.roofSegments && roof.roofSegments.length > 0);
  const useInteractiveMap = hasSegments && !mapFailed;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Your Roof</p>
        {roof.imageryDate && (
          <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
            Imagery: {roof.imageryDate}
          </span>
        )}
      </div>

      {/* Interactive map (preferred) or static satellite fallback */}
      {useInteractiveMap ? (
        <div className="mb-5">
          <SolarMap
            centerLat={roof.lat}
            centerLng={roof.lng}
            segments={roof.roofSegments!}
            onError={() => setMapFailed(true)}
          />
        </div>
      ) : roofImageUrl && !imgFailed ? (
        <div className="mb-5 rounded-xl overflow-hidden border border-slate-100">
          <div className="relative w-full aspect-[2/1]">
            <img
              src={roofImageUrl}
              alt="Satellite view of property"
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImgFailed(true)}
            />
            {hasSegments && (
              <SolarSegmentOverlay
                centerLat={roof.lat}
                centerLng={roof.lng}
                segments={roof.roofSegments!}
              />
            )}
          </div>
          <p className="text-xs text-slate-400 text-center py-1.5 bg-slate-50 border-t border-slate-100">
            {hasSegments
              ? 'Hover roof segments to see solar potential · Google Solar API'
              : 'Satellite imagery — Google Maps'}
          </p>
        </div>
      ) : null}

      {/* Sunshine distribution across all roof areas */}
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

      {/* Panel specs from Solar API */}
      {(roof.panelHeightMeters || roof.panelWidthMeters || roof.panelLifetimeYears) && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
          {roof.panelHeightMeters && roof.panelWidthMeters && (
            <span>
              Panel size: {(roof.panelHeightMeters * 100).toFixed(0)} × {(roof.panelWidthMeters * 100).toFixed(0)} cm
            </span>
          )}
          {roof.panelLifetimeYears && (
            <span>Panel lifetime: {roof.panelLifetimeYears} yrs</span>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-100">
        <SourceLink href="https://developers.google.com/maps/documentation/solar" label="Google Solar API" />
      </div>
    </Card>
  );
}

// ── Section 2: Your Production ───────────────────────────────────────────────

function ProductionSection({
  production,
  utilityRate,
}: {
  production: Assessment['production'];
  utilityRate: number;
}) {
  const homes = production.equivalentHomes;
  const homesLabel =
    homes < 1
      ? `About ${Math.round(homes * 10) / 10} of an average US home per year`
      : homes === 1
      ? 'Enough to power 1 average US home per year'
      : `Enough to power ${homes} average US homes per year`;

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
        <Stat
          label="System size"
          value={`${production.systemCapacityKw} kW`}
          sub="DC nameplate capacity"
        />
        {production.panelCapacityWatts && (
          <Stat
            label="Panel capacity"
            value={`${production.panelCapacityWatts}W`}
            sub="per panel"
          />
        )}
      </div>

      {production.monthlyKwh && production.monthlyKwh.length === 12 && (
        <MonthlyProductionChart monthlyKwh={production.monthlyKwh} />
      )}

      {production.panelConfigs && production.panelConfigs.length > 0 && production.panelCapacityWatts && (
        <PanelSlider
          panelConfigs={production.panelConfigs}
          panelCapacityWatts={production.panelCapacityWatts}
          utilityRate={utilityRate}
        />
      )}

      <div className="pt-4 border-t border-slate-100 mt-4">
        <SourceLink href="https://pvwatts.nrel.gov/" label="NREL PVWatts V8" />
      </div>
    </Card>
  );
}

// ── Section 3: Your Savings ──────────────────────────────────────────────────

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
          <span className="text-slate-500">{savings.stateAbbr} utility rate</span>
          <span className="font-medium text-slate-700">
            ${savings.utilityRatePerKwh.toFixed(3)}/kWh
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Annual consumption used</span>
          <span className="font-medium text-slate-700">
            {formatNumber(savings.annualConsumptionKwh)} kWh
          </span>
        </div>
        {savings.isStateAverage && (
          <p className="text-xs text-amber-600 pt-1">
            Using {savings.stateAbbr} state average — enter your monthly bill above for a more accurate number.
          </p>
        )}
        <SourceLink href="https://www.eia.gov/electricity/retail-sales/" label="EIA Retail Electricity Sales" />
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
  annualKwh,
  carbonOffsetKgPerMwh,
  panelLifetimeYears,
}: {
  annualKwh: number;
  carbonOffsetKgPerMwh: number;
  panelLifetimeYears?: number;
}) {
  const annualCo2Kg = Math.round((annualKwh / 1000) * carbonOffsetKgPerMwh);
  const lifetimeCo2Kg = panelLifetimeYears ? annualCo2Kg * panelLifetimeYears : null;
  const treesEquivalent = Math.round(annualCo2Kg / 21.77);
  const carsOffRoad = (annualCo2Kg / 4600).toFixed(1);

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

function IncentivesSection({
  incentives,
  cost,
}: {
  incentives: Assessment['incentives'];
  cost: Assessment['cost'];
}) {
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
      <SectionLabel>Federal & State Incentives</SectionLabel>

      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm font-semibold text-slate-700 mb-2">Verified incentive data coming soon</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          We are integrating DSIRE to show you verified federal, state, and local incentives specific to your address. Until that data is live, do not rely on any number a salesperson quotes you for tax credits or rebates — verify directly at the sources below.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <SourceLink href="https://www.dsireusa.org/" label="DSIRE — state & local incentives" />
          <SourceLink href="https://www.irs.gov/credits-deductions/residential-clean-energy-credit" label="IRS.gov — federal credits" />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs text-slate-500 mb-2">Net Metering</p>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${nmColor}`}>
          {nmLabel}
        </span>
        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          {incentives.netMeteringDetail}
        </p>
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
          <a
            href={incentive.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline mt-1 inline-block"
          >
            Verify →
          </a>
        )}
      </div>
    </div>
  );
}

// ── Section 7: Payback Range ─────────────────────────────────────────────────

function PaybackSection({
  payback,
  savings,
  googleFinancial,
}: {
  payback: Assessment['payback'];
  savings: Assessment['savings'];
  googleFinancial?: Assessment['googleFinancial'];
}) {
  return (
    <Card>
      <SectionLabel>Payback Range</SectionLabel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
        {/* LBNL benchmark estimate */}
        <div>
          <p className="text-xs text-slate-400 mb-1">LBNL benchmark estimate</p>
          <p className="text-4xl font-bold text-slate-900">
            {payback.lowYears}–{payback.highYears}
            <span className="text-xl font-medium text-slate-400 ml-1">years</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Net cost after 30% ITC: {formatCurrency(payback.netCostAfterITC)}
          </p>
        </div>

        {/* Google Solar API estimate */}
        {googleFinancial && (
          <div className="sm:border-l sm:border-slate-100 sm:pl-6">
            <p className="text-xs text-slate-400 mb-1">Google Solar API estimate</p>
            <p className="text-4xl font-bold text-blue-700">
              {googleFinancial.paybackYears.toFixed(1)}
              <span className="text-xl font-medium text-blue-400 ml-1">years</span>
            </p>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              {googleFinancial.lifetimeSavingsDollars > 0 && (
                <div className="flex justify-between">
                  <span>Lifetime savings</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(googleFinancial.lifetimeSavingsDollars)}
                  </span>
                </div>
              )}
              {googleFinancial.federalIncentiveDollars > 0 && (
                <div className="flex justify-between">
                  <span>Federal incentive</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(googleFinancial.federalIncentiveDollars)}
                  </span>
                </div>
              )}
              {googleFinancial.solarPercentage > 0 && (
                <div className="flex justify-between">
                  <span>Solar % of usage</span>
                  <span className="font-medium text-slate-700">
                    {Math.round(googleFinancial.solarPercentage)}%
                  </span>
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
        <p>
          The lower end assumes modest utility rate increases over time and high self-consumption of what you produce.
          The upper end uses today's rate with no escalation.
        </p>
        {savings.isStateAverage && (
          <p className="text-amber-600">
            Enter your monthly bill above to tighten this range considerably.
          </p>
        )}
      </div>
    </Card>
  );
}

// ── Section 8: What to Watch For ────────────────────────────────────────────

function FlagsSection({
  cost,
  incentives,
}: {
  cost: Assessment['cost'];
  incentives: Assessment['incentives'];
}) {
  const flags = [
    {
      title: 'Fair price is $2.70–$3.50 per watt',
      body: `A ${cost.systemCapacityKw} kW system should cost roughly ${formatCurrency(cost.lowEstimate)}–${formatCurrency(cost.highEstimate)} before incentives. If a quote is more than 20% above that range, ask the rep to explain the markup in detail.`,
    },
    {
      title: 'Battery storage doesn\'t eliminate your bill',
      body: 'Some installers sell solar + battery as complete bill elimination. That only works if your battery is large enough to cover overnight usage and your utility has a time-of-use tariff that makes it worth it. Model the numbers before signing.',
    },
    {
      title: 'A PPA means you don\'t own the panels',
      body: 'A Power Purchase Agreement lets a company put panels on your roof — but they own them. You buy the electricity they produce at a set rate. You can\'t claim the federal tax credit (they do), and selling your home with a PPA in place can complicate things.',
    },
    {
      title: 'One company, one quote is a pressure play',
      body: 'Any installer who won\'t give you a week to get competing quotes isn\'t confident in their pricing. Three quotes is the standard. A $25,000 purchase deserves at least a weekend of comparison shopping.',
    },
    {
      title: 'Payback under 5 years is almost always misleading',
      body: `Legitimate payback periods for residential solar run 7–12 years. A sub-5-year claim usually inflates future utility rates, overstates production, omits financing costs, or assumes tax credits that may not apply to you. Ask to see the full assumption sheet.`,
    },
    ...(incentives.netMeteringStatus !== 'full'
      ? [
          {
            title: 'Your state has limited net metering — self-consumption matters more',
            body: `${incentives.netMeteringDetail} This means the value of solar here is highest when you use power as it's generated.`,
          },
        ]
      : []),
  ];

  return (
    <Card className="border-amber-200 bg-amber-50">
      <SectionLabel>What to Watch For</SectionLabel>
      <p className="text-xs text-slate-500 mb-5">
        These are the things that trip up homeowners. Knowing them makes you a better buyer.
      </p>
      <div className="space-y-5">
        {flags.map((flag, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center mt-0.5">
              <span className="text-white text-xs font-bold">{i + 1}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-1">{flag.title}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{flag.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
