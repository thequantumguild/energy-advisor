'use client';

import { useState, FormEvent } from 'react';

interface AddressInputProps {
  onSubmit: (address: string, monthlyBill?: number) => void;
  isLoading?: boolean;
}

export default function AddressInput({ onSubmit, isLoading }: AddressInputProps) {
  const [address, setAddress] = useState('');
  const [bill, setBill] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    const monthlyBill = bill ? parseFloat(bill) : undefined;
    onSubmit(trimmed, monthlyBill);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">
          Know your solar potential<br className="hidden sm:block" /> before you talk to anyone.
        </h1>
        <p className="text-lg text-slate-500 max-w-lg mx-auto">
          Real data from government sources about your specific roof —
          no sign-up, no account required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter your home address"
            className="flex-1 px-5 py-4 text-base rounded-xl border border-slate-300 bg-white shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
            autoComplete="street-address"
            autoFocus
          />
          <button
            type="submit"
            disabled={!address.trim() || isLoading}
            className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            Get My Assessment
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-500 whitespace-nowrap">
            Avg monthly electric bill
            <span className="text-slate-400 ml-1">(optional — improves accuracy)</span>
          </label>
          <div className="relative max-w-[120px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">$</span>
            <input
              type="number"
              value={bill}
              onChange={(e) => setBill(e.target.value)}
              placeholder="150"
              min="1"
              max="9999"
              className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>
        </div>
      </form>

      <p className="mt-5 text-xs text-slate-400 text-center">
        Pulls from{' '}
        <a href="https://developers.google.com/maps/documentation/solar" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline">Google Solar API</a>,{' '}
        <a href="https://pvwatts.nrel.gov/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline">NREL PVWatts</a>,{' '}
        <a href="https://www.eia.gov/electricity/retail-sales/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline">EIA utility data</a>, and{' '}
        <a href="https://www.dsireusa.org/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 underline">DSIRE incentives</a>.
      </p>
    </div>
  );
}
