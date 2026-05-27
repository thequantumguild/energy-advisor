'use client';

import { useState, FormEvent } from 'react';

interface Props {
  onSubmit: (address: string, monthlyBill?: number) => void;
  isLoading?: boolean;
}

export default function AddressInput({ onSubmit, isLoading }: Props) {
  const [address, setAddress] = useState('');
  const [bill, setBill] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    onSubmit(trimmed, bill ? parseFloat(bill) : undefined);
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-16 overflow-hidden -mt-0">

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      {/* Sun glow effects */}
      <div className="absolute top-1/3 right-1/3 w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-sky-500/6 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl mx-auto text-center">

        {/* Independence badge */}
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-amber-400 text-xs font-semibold px-4 py-1.5 rounded-full tracking-wider uppercase mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
          Independent · Not affiliated with any installer
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-[1.05] mb-5">
          Don&apos;t sign anything
          <br />
          <span className="text-amber-400">until you see this.</span>
        </h1>

        <p className="text-lg text-slate-400 mb-10 max-w-lg mx-auto leading-relaxed">
          Your roof&apos;s real solar numbers — straight from{' '}
          <span className="text-slate-300">NASA satellites</span> and{' '}
          <span className="text-slate-300">government data</span>.
          No account. No sales pitch. No commission.
        </p>

        {/* Form card */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl shadow-black/50 text-left">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Your home address
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="123 Main St, City, State"
                  className="flex-1 px-4 py-3.5 text-base rounded-xl border border-slate-200 bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-shadow"
                  disabled={isLoading}
                  autoComplete="street-address"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!address.trim() || isLoading}
                  className="px-7 py-3.5 bg-slate-950 text-white font-bold rounded-xl shadow hover:bg-slate-800 active:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-sm tracking-wide"
                >
                  {isLoading ? 'Analyzing…' : 'Get My Numbers →'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-xs text-slate-400">optional — improves accuracy</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600 whitespace-nowrap">
                Avg monthly electric bill
              </label>
              <div className="relative max-w-[120px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">$</span>
                <input
                  type="number"
                  value={bill}
                  onChange={e => setBill(e.target.value)}
                  placeholder="150"
                  min="1" max="9999"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-slate-50"
                  disabled={isLoading}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Trust row */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {[
            'Google Solar + NREL government data',
            'No account needed',
            'No sales calls, ever',
          ].map(t => (
            <span key={t} className="flex items-center gap-1.5 text-xs text-slate-500">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {t}
            </span>
          ))}
        </div>

        {/* Data sources */}
        <p className="mt-8 text-xs text-slate-600">
          Pulls from{' '}
          <a href="https://developers.google.com/maps/documentation/solar" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-amber-400 underline transition-colors">Google Solar API</a>,{' '}
          <a href="https://pvwatts.nrel.gov/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-amber-400 underline transition-colors">NREL PVWatts</a>,{' '}
          <a href="https://www.eia.gov/electricity/retail-sales/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-amber-400 underline transition-colors">EIA utility rates</a>, and{' '}
          <a href="https://www.dsireusa.org/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-amber-400 underline transition-colors">DSIRE incentives</a>.
        </p>
      </div>
    </div>
  );
}
