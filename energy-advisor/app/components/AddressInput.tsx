'use client';

import { useState, FormEvent } from 'react';

interface AddressInputProps {
  onSubmit: (address: string) => void;
  isLoading?: boolean;
}

export default function AddressInput({ onSubmit, isLoading }: AddressInputProps) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">
          Know your solar potential<br className="hidden sm:block" /> before you talk to anyone.
        </h1>
        <p className="text-lg text-slate-500 max-w-lg mx-auto">
          Real numbers from government APIs about your specific roof —
          no sign-up, no sales pitch, no fluff.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter your home address"
          className="flex-1 px-5 py-4 text-base rounded-xl border border-slate-300 bg-white shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
          autoComplete="street-address"
          autoFocus
        />
        <button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          Get My Assessment
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-400 text-center">
        Pulls from Google Solar, NREL PVWatts, EIA utility data, and DSIRE incentives.
      </p>
    </div>
  );
}
