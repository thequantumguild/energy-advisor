import type { Assessment, StateIncentive } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';

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

      {/* 2-column grid on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RoofSection roof={roof} />
        <ProductionSection production={production} />
        <SavingsSection savings={savings} />
        <CostSection cost={cost} />
      </div>

      {/* Full-width sections */}
      <IncentivesSection incentives={incentives} cost={cost} />
      <PaybackSection payback={payback} savings={savings} />
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

function RoofSection({ roof }: { roof: Assessment['roof'] }) {
  const shadingColor = {
    minimal:     'bg-green-100 text-green-700',
    moderate:    'bg-amber-100 text-amber-700',
    significant: 'bg-red-100 text-red-700',
  }[roof.shadingScore];

  return (
    <Card>
      <SectionLabel>Your Roof</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Usable solar area" value={`${formatNumber(roof.usableAreaSqFt)} sq ft`} />
        <Stat label="Orientation" value={roof.azimuthLabel} />
        <Stat label="Estimated panels" value={`${roof.estimatedPanelCount}`} sub={`~${Math.round(roof.estimatedPanelCount * 0.4 * 10) / 10} kW system`} />
        <div>
          <p className="text-xs text-slate-500 mb-1">Shading</p>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${shadingColor}`}>
            {roof.shadingLabel}
          </span>
          <p className="text-xs text-slate-400 mt-1.5">{roof.pitchDegrees}° roof pitch</p>
        </div>
      </div>
    </Card>
  );
}

// ── Section 2: Your Production ───────────────────────────────────────────────

function ProductionSection({ production }: { production: Assessment['production'] }) {
  const homes = production.equivalentHomes;
  const homesLabel =
    homes < 1
      ? `About ${Math.round(homes * 10) / 10} of an average US home per year`
      : homes === 1
      ? 'Enough to power 1 average US home per year'
      : `Enough to power ${homes} average US homes per year`;

  return (
    <Card>
      <SectionLabel>Your Production</SectionLabel>
      <p className="text-4xl font-bold text-slate-900 mb-1">
        {formatNumber(production.annualKwh)}
        <span className="text-xl font-medium text-slate-400 ml-1">kWh / yr</span>
      </p>
      <p className="text-sm text-slate-500 mb-4">{homesLabel}</p>
      <div className="pt-4 border-t border-slate-100">
        <Stat
          label="System size"
          value={`${production.systemCapacityKw} kW`}
          sub="DC nameplate capacity"
        />
      </div>
    </Card>
  );
}

// ── Section 3: Your Savings ──────────────────────────────────────────────────

function SavingsSection({ savings }: { savings: Assessment['savings'] }) {
  return (
    <Card>
      <SectionLabel>Your Savings</SectionLabel>
      <p className="text-4xl font-bold text-green-600 mb-1">
        {formatCurrency(savings.annualSavings)}
        <span className="text-xl font-medium text-green-400 ml-1">/ yr</span>
      </p>
      <p className="text-sm text-slate-700 mb-4">
        Estimated <span className="font-semibold">{savings.offsetPercent}%</span> of your electricity bill offset
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
            Using {savings.stateAbbr} state average consumption — add your bill below for a sharper number.
          </p>
        )}
      </div>
    </Card>
  );
}

// ── Section 4: Honest Cost Range ─────────────────────────────────────────────

function CostSection({ cost }: { cost: Assessment['cost'] }) {
  return (
    <Card>
      <SectionLabel>Honest Cost Range</SectionLabel>
      <p className="text-3xl font-bold text-slate-900 mb-1">
        {formatCurrency(cost.lowEstimate)}
        <span className="text-slate-400 font-medium mx-1">–</span>
        {formatCurrency(cost.highEstimate)}
      </p>
      <p className="text-xs text-slate-500 mb-4">
        ${cost.costPerWattLow.toFixed(2)}–${cost.costPerWattHigh.toFixed(2)} per watt · {cost.systemCapacityKw} kW system
      </p>
      <div className="pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 leading-relaxed">
          Benchmarked to LBNL 2024 national residential data. This is what honest installers are charging right now — before any incentives.
        </p>
      </div>
    </Card>
  );
}

// ── Section 5: Your Incentives ───────────────────────────────────────────────

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

  const costMid = (cost.lowEstimate + cost.highEstimate) / 2;

  return (
    <Card>
      <SectionLabel>Your Incentives</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Federal ITC */}
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
            Federal Investment Tax Credit
          </p>
          <p className="text-3xl font-bold text-blue-700 mb-1">
            {formatCurrency(incentives.federalITCDollars)}
          </p>
          <p className="text-xs text-blue-600">
            {incentives.federalITCPercent}% of your system cost ({formatCurrency(costMid)} midpoint),
            applied against federal income tax owed. Available through 2032.
          </p>
        </div>

        {/* Net metering */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Net Metering</p>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${nmColor}`}>
            {nmLabel}
          </span>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            {incentives.netMeteringDetail}
          </p>
        </div>
      </div>

      {/* State incentives */}
      {incentives.stateIncentives.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            State & Local Incentives
          </p>
          <div className="space-y-3">
            {incentives.stateIncentives.map((inc, i) => (
              <IncentiveRow key={i} incentive={inc} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

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
            Learn more →
          </a>
        )}
      </div>
    </div>
  );
}

// ── Section 6: Real Payback Range ────────────────────────────────────────────

function PaybackSection({
  payback,
  savings,
}: {
  payback: Assessment['payback'];
  savings: Assessment['savings'];
}) {
  return (
    <Card>
      <SectionLabel>Real Payback Range</SectionLabel>
      <div className="flex items-end gap-4 mb-4">
        <p className="text-4xl font-bold text-slate-900">
          {payback.lowYears}–{payback.highYears}
          <span className="text-xl font-medium text-slate-400 ml-1">years</span>
        </p>
        <p className="text-sm text-slate-500 mb-1">
          Net cost after ITC: {formatCurrency(payback.netCostAfterITC)}
        </p>
      </div>
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
        <p>
          The lower end of that range assumes your utility rates rise modestly (they typically do) and
          you self-consume a high share of what you produce.
        </p>
        <p>
          The upper end uses today's rate with no escalation. Where you land depends on your actual
          usage pattern, your utility's future rate decisions, and whether you have battery storage.
        </p>
        {savings.isStateAverage && (
          <p className="text-amber-600">
            Add your monthly bill below — it'll tighten this range considerably.
          </p>
        )}
      </div>
    </Card>
  );
}

// ── Section 7: What to Watch For ────────────────────────────────────────────

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
      body: `A ${cost.systemCapacityKw} kW system should cost roughly ${formatCurrency(cost.lowEstimate)}–${formatCurrency(cost.highEstimate)} before incentives. If a quote is more than 20% above that range, ask the rep to explain the markup in detail — premium equipment rarely justifies it alone.`,
    },
    {
      title: 'Battery storage doesn\'t "eliminate your bill"',
      body: "Some installers sell solar + battery as complete bill elimination. That only works if your battery is large enough to cover overnight usage and your utility has a time-of-use tariff that makes it worth it. Most homeowners see 20–40% of savings tied to storage — not 100%. Model the numbers yourself before signing.",
    },
    {
      title: 'A PPA means you don\'t own the panels',
      body: "A Power Purchase Agreement lets a company put panels on your roof — but they own them. You buy the electricity they produce at a set rate. You can't claim the federal tax credit (they do), and selling your home with a PPA in place can complicate things. Loans and cash purchases keep the ITC and equity in your hands.",
    },
    {
      title: 'One company, one quote is a pressure play',
      body: "Any installer who won't give you a week to get competing quotes isn't confident in their pricing. Three quotes is the standard — reputable contractors expect it and tell you to do it. A $25,000 purchase deserves at least a weekend of comparison shopping.",
    },
    {
      title: 'Payback under 5 years is almost always misleading',
      body: `After the 30% ITC, your net system cost is roughly ${formatCurrency(cost.lowEstimate * 0.7)}–${formatCurrency(cost.highEstimate * 0.7)}. Legitimate payback periods for residential solar run 7–12 years. A sub-5-year claim usually inflates future utility rates, overstates production, or omits financing costs. Ask to see the full assumption sheet.`,
    },
    ...(incentives.netMeteringStatus !== 'full'
      ? [
          {
            title: 'Your state has limited net metering — self-consumption matters more',
            body: `${incentives.netMeteringDetail} This means the value of solar here is highest when you use power as it's generated. If you're away all day, battery storage becomes a more important part of the economics.`,
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
