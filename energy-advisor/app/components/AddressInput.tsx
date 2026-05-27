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
    <div className="min-h-[calc(100vh-3.5rem)] bg-white flex flex-col">

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl mx-auto">

          {/* Badge */}
          <div className="flex justify-center mb-7">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 px-4 py-1.5 rounded-full tracking-wide uppercase">
              <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z" />
              </svg>
              Independent · No installer affiliation
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 text-center tracking-tight leading-[1.08] mb-4">
            Know exactly what solar<br />
            <span className="text-amber-500">is worth for your home.</span>
          </h1>

          <p className="text-base text-slate-500 text-center mb-10 leading-relaxed max-w-md mx-auto">
            Real data from government sources about your specific roof.
            No account required. No sales calls. No commission.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Your home address"
                className="flex-1 px-4 py-3.5 text-base rounded-xl border border-slate-200 bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm"
                disabled={isLoading}
                autoComplete="street-address"
                autoFocus
              />
              <button
                type="submit"
                disabled={!address.trim() || isLoading}
                className="px-7 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap text-sm"
              >
                {isLoading ? 'Analyzing…' : 'Get My Assessment →'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-500 whitespace-nowrap">
                Avg monthly bill
                <span className="text-slate-400 ml-1 text-xs">(optional)</span>
              </label>
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  value={bill}
                  onChange={e => setBill(e.target.value)}
                  placeholder="150"
                  min="1" max="9999"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>
            </div>
          </form>

          {/* Trust row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              'Google Solar + NREL satellite data',
              'No account needed',
              'No sales calls, ever',
            ].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-slate-400">
                <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Data sources footer strip */}
      <div className="border-t border-slate-100 py-4 px-4">
        <p className="text-xs text-slate-400 text-center">
          Data from{' '}
          <a href="https://developers.google.com/maps/documentation/solar" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline underline-offset-2">Google Solar API</a>{' · '}
          <a href="https://pvwatts.nrel.gov/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline underline-offset-2">NREL PVWatts</a>{' · '}
          <a href="https://www.eia.gov/electricity/retail-sales/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline underline-offset-2">EIA utility rates</a>{' · '}
          <a href="https://www.dsireusa.org/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline underline-offset-2">DSIRE incentives</a>
        </p>
      </div>
    </div>
  );
}
