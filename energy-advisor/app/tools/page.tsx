'use client';

import { useState, useRef } from 'react';
import { formatCurrency } from '@/lib/utils';

type Tab = 'quote' | 'contract';

export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>('quote');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="font-bold text-slate-900 hover:text-blue-600 transition-colors">← Energy Advocate</a>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['quote', 'contract'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'quote' ? 'Quote Analyzer' : 'Contract Scanner'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {tab === 'quote' ? <QuoteAnalyzer /> : <ContractScanner />}
      </main>
    </div>
  );
}

// ── Quote Analyzer ───────────────────────────────────────────────────────────

interface QuoteFlag { severity: 'red' | 'yellow' | 'green'; message: string; }
interface QuoteResult {
  quote: Record<string, unknown>;
  flags: QuoteFlag[];
  lbnlRange: { low: number; high: number };
}

function QuoteAnalyzer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setResult(null); setError(null);
    const fd = new FormData(); fd.append('quote', file);
    try {
      const res = await fetch('/api/analyze-quote', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
    } catch { setError('Upload failed.'); }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  const q = result?.quote;
  const ppw = q?.pricePerWatt as number | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Quote Analyzer</h1>
        <p className="text-slate-500 text-sm">Upload a solar installer quote (PDF or photo). We'll extract every number and flag anything off-market.</p>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Analyzing quote with AI…</p>
          </div>
        ) : (
          <>
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm font-medium text-slate-600">Drop your quote PDF here or click to upload</p>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG, or PNG · max 20 MB</p>
          </>
        )}
        <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFile} />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {result && q && (
        <div className="space-y-5">
          {/* Flags */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Findings</h2>
            {result.flags.map((f, i) => (
              <div key={i} className={`flex gap-3 rounded-xl px-4 py-3 text-sm ${
                f.severity === 'red'    ? 'bg-red-50 border border-red-200 text-red-800' :
                f.severity === 'yellow' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
                                          'bg-green-50 border border-green-200 text-green-800'
              }`}>
                <span className="text-base leading-none mt-0.5">{f.severity === 'red' ? '🚩' : f.severity === 'yellow' ? '⚠️' : '✓'}</span>
                <span>{f.message}</span>
              </div>
            ))}
          </div>

          {/* Quote details */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Extracted Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'System size',   value: q.systemKw ? `${q.systemKw} kW` : null },
                { label: 'Total price',   value: q.totalPriceDollars ? formatCurrency(q.totalPriceDollars as number) : null },
                { label: 'Price / watt',  value: ppw ? `$${ppw.toFixed(2)}/W` : null },
                { label: 'LBNL range',    value: `$${result.lbnlRange.low}–$${result.lbnlRange.high}/W` },
                { label: 'Panels',        value: [q.panelBrand, q.panelModel].filter(Boolean).join(' ') || null },
                { label: 'Panel wattage', value: q.panelWatts ? `${q.panelWatts}W` : null },
                { label: 'Inverter',      value: [q.inverterBrand, q.inverterModel].filter(Boolean).join(' ') || null },
                { label: 'Panel warranty',value: q.panelWarrantyYears ? `${q.panelWarrantyYears} yr` : null },
                { label: 'Perf. warranty',value: q.performanceWarrantyYears ? `${q.performanceWarrantyYears} yr` : null },
                { label: 'Inverter warranty', value: q.inverterWarrantyYears ? `${q.inverterWarrantyYears} yr` : null },
                { label: 'Workmanship',   value: q.workmanshipWarrantyYears ? `${q.workmanshipWarrantyYears} yr` : null },
                { label: 'Contract type', value: q.contractType as string || null },
                { label: 'Escalator',     value: q.annualEscalatorPct != null ? `${q.annualEscalatorPct}%/yr` : null },
                { label: 'Monitoring',    value: q.monitoring as string || null },
              ].filter(row => row.value).map(row => (
                <div key={row.label} className="bg-white rounded-xl border border-slate-100 px-3 py-2.5">
                  <p className="text-xs text-slate-400">{row.label}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{String(row.value)}</p>
                </div>
              ))}
            </div>
            {typeof q.notes === 'string' && q.notes && (
              <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-slate-500 mb-1">Additional notes</p>
                <p className="text-xs text-slate-600 leading-relaxed">{q.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Contract Scanner ─────────────────────────────────────────────────────────

interface ContractFlag { severity: 'red' | 'yellow' | 'green'; category: string; issue: string; quote?: string | null; }
interface ContractResult {
  contractType: string;
  termYears: number | null;
  annualEscalatorPct: number | null;
  earlyTerminationFee: string | null;
  homeSaleClause: string | null;
  bankruptcyClause: string | null;
  performanceGuarantee: string | null;
  removalResponsibility: string | null;
  endOfTermOptions: string | null;
  flags: ContractFlag[];
}

function ContractScanner() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContractResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setResult(null); setError(null);
    const fd = new FormData(); fd.append('contract', file);
    try {
      const res = await fetch('/api/scan-contract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
    } catch { setError('Upload failed.'); }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  const reds    = result?.flags.filter(f => f.severity === 'red')    ?? [];
  const yellows = result?.flags.filter(f => f.severity === 'yellow') ?? [];
  const greens  = result?.flags.filter(f => f.severity === 'green')  ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Contract Scanner</h1>
        <p className="text-slate-500 text-sm">Upload your solar agreement. We'll surface every clause that could hurt you — escalators, termination fees, home-sale blocks, and more.</p>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Reading contract… this may take 15–30 seconds for long documents.</p>
          </div>
        ) : (
          <>
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            <p className="text-sm font-medium text-slate-600">Drop your contract PDF here or click to upload</p>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG, or PNG · max 20 MB · lease, PPA, loan, or cash agreement</p>
          </>
        )}
        <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFile} />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {result && (
        <div className="space-y-5">
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Contract type', value: result.contractType },
              { label: 'Term', value: result.termYears ? `${result.termYears} years` : null },
              { label: 'Annual escalator', value: result.annualEscalatorPct != null ? `${result.annualEscalatorPct}%/yr` : 'Not found' },
              { label: 'Red flags', value: `${reds.length}`, highlight: reds.length > 0 },
            ].map(row => (
              <div key={row.label} className={`rounded-xl border px-3 py-2.5 ${row.highlight ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                <p className="text-xs text-slate-400">{row.label}</p>
                <p className={`text-sm font-semibold mt-0.5 ${row.highlight ? 'text-red-700' : 'text-slate-800'}`}>{row.value ?? '—'}</p>
              </div>
            ))}
          </div>

          {/* Flags */}
          {[
            { items: reds,    label: 'Red flags — act on these before signing', icon: '🚩', bg: 'bg-red-50 border-red-200 text-red-800' },
            { items: yellows, label: 'Watch items — understand before signing', icon: '⚠️', bg: 'bg-amber-50 border-amber-200 text-amber-800' },
            { items: greens,  label: 'Positive terms',                          icon: '✓',  bg: 'bg-green-50 border-green-200 text-green-800' },
          ].filter(g => g.items.length > 0).map(group => (
            <div key={group.label} className="space-y-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{group.label}</h2>
              {group.items.map((f, i) => (
                <div key={i} className={`rounded-xl border px-4 py-3 space-y-1 ${group.bg}`}>
                  <div className="flex items-center gap-2">
                    <span>{group.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-wide">{f.category}</span>
                  </div>
                  <p className="text-sm">{f.issue}</p>
                  {f.quote && <p className="text-xs opacity-70 italic">"{f.quote}"</p>}
                </div>
              ))}
            </div>
          ))}

          {/* Key terms */}
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Key Terms Found</h2>
            <div className="space-y-2">
              {[
                { label: 'Early termination', value: result.earlyTerminationFee },
                { label: 'Home sale clause', value: result.homeSaleClause },
                { label: 'Company bankruptcy', value: result.bankruptcyClause },
                { label: 'Performance guarantee', value: result.performanceGuarantee },
                { label: 'Panel removal', value: result.removalResponsibility },
                { label: 'End of term', value: result.endOfTermOptions },
              ].filter(r => r.value).map(r => (
                <div key={r.label} className="bg-white border border-slate-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500">{r.label}</p>
                  <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
