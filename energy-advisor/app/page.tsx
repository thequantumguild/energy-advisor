'use client';

import { useState } from 'react';
import type { Assessment, AssessmentRequest } from '@/lib/types';
import AddressInput from './components/AddressInput';
import LoadingState from './components/LoadingState';
import AssessmentCard from './components/AssessmentCard';
import SharpenForm from './components/SharpenForm';

type Phase = 'input' | 'loading' | 'result';

export default function Home() {
  const [phase, setPhase] = useState<Phase>('input');
  const [address, setAddress] = useState('');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  async function runAssessment(req: AssessmentRequest): Promise<Assessment> {
    const res = await fetch('/api/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? 'Assessment failed. Please try again.');
    }
    return data as Assessment;
  }

  async function handleAddressSubmit(addr: string, monthlyBill?: number) {
    setAddress(addr);
    setPhase('loading');
    setAssessment(null);
    setError(null);
    try {
      const result = await runAssessment({ address: addr, monthlyBill });
      setAssessment(result);
      setPhase('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPhase('input');
    }
  }

  async function handleLocationRefine(lat: number, lng: number) {
    setIsRefining(true);
    setError(null);
    try {
      const result = await runAssessment({ address, lat, lng });
      setAssessment(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsRefining(false);
    }
  }

  async function handleSharpen(values: {
    monthlyBill?: number;
    hasHighLoads?: 'yes' | 'no' | 'not_sure';
    shadingOverride?: 'yes' | 'partially' | 'lots';
  }) {
    setIsRefining(true);
    setError(null);
    try {
      const result = await runAssessment({ address, ...values });
      setAssessment(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsRefining(false);
    }
  }

  function handleReset() {
    setPhase('input');
    setAssessment(null);
    setAddress('');
    setError(null);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-slate-900 hover:text-blue-600 transition-colors"
          >
            <SunIcon className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-base tracking-tight">Energy Advisor</span>
          </button>
          {phase === 'result' && (
            <button
              onClick={handleReset}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              New assessment
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16">
        {phase === 'input' && (
          <>
            <AddressInput onSubmit={handleAddressSubmit} />
            {error && (
              <div className="mt-6 max-w-2xl mx-auto p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
          </>
        )}

        {phase === 'loading' && <LoadingState address={address} />}

        {phase === 'result' && assessment && (
          <div className="space-y-6">
            {error && (
              <div className="max-w-4xl mx-auto p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
            <AssessmentCard assessment={assessment} onLocationRefine={handleLocationRefine} />

            <div className="max-w-4xl mx-auto pt-6 border-t border-slate-200">
              <SharpenForm onSubmit={handleSharpen} isLoading={isRefining} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>
            Data from Google Solar, NREL PVWatts, EIA, and DSIRE. For informational purposes only.
          </p>
          <p>No data stored. No accounts. No sales calls.</p>
        </div>
      </footer>
    </div>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0z"
      />
    </svg>
  );
}
