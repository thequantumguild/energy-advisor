'use client';

import { useState, FormEvent, useRef } from 'react';

interface SharpenValues {
  monthlyBill?: number;
  shadingOverride?: 'yes' | 'partially' | 'lots';
  electricLoads?: string[];
  stayYears?: '<5' | '5-10' | '10+';
  roofAge?: 'new' | 'good' | 'aging' | 'unknown';
  batteryInterest?: 'yes' | 'maybe' | 'no';
  paymentPreference?: 'cash' | 'loan' | 'lease_ppa' | 'unsure';
  panelTier?: 'premium' | 'standard' | 'budget';
  inverterType?: 'string' | 'micro' | 'optimizer';
}

interface ParsedBill {
  totalBillDollars?: number | null;
  monthlyKwh?: number | null;
  ratePerKwh?: number | null;
  utilityName?: string | null;
}

interface Props {
  onSubmit: (values: SharpenValues) => void;
  isLoading: boolean;
}

function Question({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800 mb-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mb-2">{sub}</p>}
      {!sub && <div className="mb-2" />}
      {children}
    </div>
  );
}

function Chip<T extends string>({
  value, selected, onClick, children,
}: {
  value: T; selected: boolean; onClick: (v: T) => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`px-3.5 py-2 text-sm rounded-xl border transition-all ${
        selected
          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  );
}

function MultiChip({
  value, selected, onClick, children,
}: {
  value: string; selected: boolean; onClick: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`px-3.5 py-2 text-sm rounded-xl border transition-all flex items-center gap-1.5 ${
        selected
          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
      }`}
    >
      {selected && (
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      )}
      {children}
    </button>
  );
}

export default function SharpenForm({ onSubmit, isLoading }: Props) {
  const [bill, setBill] = useState('');
  const [shading, setShading] = useState<SharpenValues['shadingOverride']>();
  const [loads, setLoads] = useState<string[]>([]);
  const [stayYears, setStayYears] = useState<SharpenValues['stayYears']>();
  const [roofAge, setRoofAge] = useState<SharpenValues['roofAge']>();
  const [batteryInterest, setBatteryInterest] = useState<SharpenValues['batteryInterest']>();
  const [paymentPref, setPaymentPref] = useState<SharpenValues['paymentPreference']>();

  const [panelTier, setPanelTier] = useState<SharpenValues['panelTier']>();
  const [inverterType, setInverterType] = useState<SharpenValues['inverterType']>();

  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState<ParsedBill | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleLoad(v: string) {
    setLoads(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setParsed(null);
    const fd = new FormData();
    fd.append('bill', file);
    try {
      const res = await fetch('/api/parse-bill', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? 'Could not read bill.'); return; }
      setParsed(data);
      if (data.totalBillDollars) setBill(String(Math.round(data.totalBillDollars)));
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      monthlyBill:        bill ? parseFloat(bill) : undefined,
      shadingOverride:    shading,
      electricLoads:      loads.length ? loads : undefined,
      stayYears,
      roofAge,
      batteryInterest,
      paymentPreference:  paymentPref,
      panelTier,
      inverterType,
    });
  }

  const hasAnyAnswer = bill || shading || loads.length || stayYears || roofAge || batteryInterest || paymentPref || panelTier || inverterType;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Bill */}
      <Question label="What's your average monthly electric bill?" sub="The single biggest factor in your savings estimate">
        <div className="flex items-center gap-2">
          <div className="relative w-36">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">$</span>
            <input
              type="number"
              value={bill}
              onChange={e => setBill(e.target.value)}
              placeholder="150"
              min="1" max="9999"
              className="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
            />
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            {uploading
              ? <span className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
            }
            {uploading ? 'Reading…' : 'Upload bill PDF'}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChange} />
        </div>
        {parsed && !uploadError && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {parsed.utilityName  && <span className="font-medium text-slate-700">{parsed.utilityName}</span>}
            {parsed.monthlyKwh   && <span>{parsed.monthlyKwh.toLocaleString()} kWh/mo</span>}
            {parsed.ratePerKwh   && <span>${parsed.ratePerKwh.toFixed(3)}/kWh</span>}
            {parsed.totalBillDollars && <span className="text-green-700 font-medium">✓ Amount pre-filled</span>}
          </div>
        )}
        {uploadError && <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>}
      </Question>

      {/* What runs on electricity */}
      <Question
        label="What are the big electricity users in your home?"
        sub="Select all that apply — these adjust your consumption estimate"
      >
        <div className="flex flex-wrap gap-2">
          {[
            { v: 'ev',          label: '⚡ Electric vehicle' },
            { v: 'pool',        label: '🏊 Pool or spa' },
            { v: 'heat_pump',   label: '🌡️ Heat pump / AC' },
            { v: 'elec_water',  label: '🚿 Electric water heater' },
            { v: 'gas_mainly',  label: '🔥 Mostly gas appliances' },
          ].map(({ v, label }) => (
            <MultiChip key={v} value={v} selected={loads.includes(v)} onClick={toggleLoad}>
              {label}
            </MultiChip>
          ))}
        </div>
      </Question>

      {/* Roof shading */}
      <Question
        label="How would you describe your roof's sun exposure?"
        sub="This directly affects how much power your system can produce"
      >
        <div className="flex flex-wrap gap-2">
          {([
            { v: 'yes',       label: '☀️ Open sky — full sun all day' },
            { v: 'partially', label: '🌤 Some shade from trees or buildings' },
            { v: 'lots',      label: '🌳 Pretty shaded — tall trees nearby' },
          ] as const).map(({ v, label }) => (
            <Chip key={v} value={v} selected={shading === v} onClick={setShading}>{label}</Chip>
          ))}
        </div>
      </Question>

      {/* How long staying */}
      <Question
        label="How long do you plan to stay in this home?"
        sub="Solar pays off best over 8–12+ years"
      >
        <div className="flex flex-wrap gap-2">
          {([
            { v: '<5',  label: 'Less than 5 years' },
            { v: '5-10', label: '5–10 years' },
            { v: '10+', label: '10+ years — this is home' },
          ] as const).map(({ v, label }) => (
            <Chip key={v} value={v} selected={stayYears === v} onClick={setStayYears}>{label}</Chip>
          ))}
        </div>
      </Question>

      {/* Roof age */}
      <Question
        label="How old is your roof?"
        sub="An aging roof may need replacement before or during solar installation — adds cost"
      >
        <div className="flex flex-wrap gap-2">
          {([
            { v: 'new',     label: 'Under 5 years' },
            { v: 'good',    label: '5–15 years — decent shape' },
            { v: 'aging',   label: 'Over 15 years' },
            { v: 'unknown', label: "Not sure" },
          ] as const).map(({ v, label }) => (
            <Chip key={v} value={v} selected={roofAge === v} onClick={setRoofAge}>{label}</Chip>
          ))}
        </div>
      </Question>

      {/* Battery backup */}
      <Question
        label="Interested in battery backup storage?"
        sub="Batteries add upfront cost but can eliminate blackouts and maximize self-consumption"
      >
        <div className="flex flex-wrap gap-2">
          {([
            { v: 'yes',   label: 'Yes — I want to go off-grid capable' },
            { v: 'maybe', label: 'Maybe — show me the numbers' },
            { v: 'no',    label: 'No — just solar for now' },
          ] as const).map(({ v, label }) => (
            <Chip key={v} value={v} selected={batteryInterest === v} onClick={setBatteryInterest}>{label}</Chip>
          ))}
        </div>
      </Question>

      {/* Payment preference */}
      <Question
        label="How are you thinking about paying?"
        sub="This determines which parts of the assessment matter most to you"
      >
        <div className="flex flex-wrap gap-2">
          {([
            { v: 'cash',      label: '💵 Cash purchase' },
            { v: 'loan',      label: '🏦 Solar loan — I keep ownership' },
            { v: 'lease_ppa', label: '📄 Open to lease or PPA (no money down)' },
            { v: 'unsure',    label: "Haven't decided yet" },
          ] as const).map(({ v, label }) => (
            <Chip key={v} value={v} selected={paymentPref === v} onClick={setPaymentPref}>{label}</Chip>
          ))}
        </div>
      </Question>

      {/* Panel tier */}
      <Question
        label="What panel quality are you considering?"
        sub="Affects the 25-year degradation rate used in your projection (0.3–0.7%/yr)"
      >
        <div className="flex flex-wrap gap-2">
          {([
            { v: 'premium', label: '⭐ Premium — LG, Panasonic, REC (0.3%/yr)' },
            { v: 'standard', label: '✓ Standard — most major brands (0.5%/yr)' },
            { v: 'budget', label: '↓ Budget / entry-level (0.7%/yr)' },
          ] as const).map(({ v, label }) => (
            <Chip key={v} value={v} selected={panelTier === v} onClick={setPanelTier}>{label}</Chip>
          ))}
        </div>
      </Question>

      {/* Inverter type */}
      <Question
        label="What type of inverter are you considering?"
        sub="Microinverters and power optimizers work better on shaded or complex roofs"
      >
        <div className="flex flex-wrap gap-2">
          {([
            { v: 'string',    label: '⚡ String inverter — standard, lowest cost (96.5% eff.)' },
            { v: 'optimizer', label: '🔧 Power optimizer — SolarEdge (97.5% eff.)' },
            { v: 'micro',     label: '🔬 Microinverter — Enphase, per-panel (98% eff.)' },
          ] as const).map(({ v, label }) => (
            <Chip key={v} value={v} selected={inverterType === v} onClick={setInverterType}>{label}</Chip>
          ))}
        </div>
      </Question>

      <div className="pt-2">
        <button
          type="submit"
          disabled={!hasAnyAnswer || isLoading}
          className="px-7 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Recalculating…' : 'Update my assessment →'}
        </button>
      </div>
    </form>
  );
}
