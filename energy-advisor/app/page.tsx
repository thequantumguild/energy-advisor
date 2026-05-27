'use client';

import { useState, useEffect } from 'react';
import type { Assessment, AssessmentRequest } from '@/lib/types';
import AddressInput from './components/AddressInput';
import LoadingState from './components/LoadingState';
import AssessmentCard from './components/AssessmentCard';

type Phase = 'input' | 'loading' | 'result';

const SESSION_KEY = 'ea_session';

export default function Home() {
  const [phase, setPhase] = useState<Phase>('input');
  const [address, setAddress] = useState('');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  // Restore session when navigating back from /tools
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const { address: a, assessment: r } = JSON.parse(raw);
        if (a && r) { setAddress(a); setAssessment(r); setPhase('result'); }
      }
    } catch { /* ignore parse errors */ }
  }, []);

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

  function saveSession(addr: string, result: Assessment) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ address: addr, assessment: result })); } catch { /* ignore */ }
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
      saveSession(addr, result);
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
      saveSession(address, result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsRefining(false);
    }
  }

  async function handleSharpen(values: {
    monthlyBill?: number;
    shadingOverride?: 'yes' | 'partially' | 'lots';
    electricLoads?: string[];
    stayYears?: '<5' | '5-10' | '10+';
    roofAge?: 'new' | 'good' | 'aging' | 'unknown';
    batteryInterest?: 'yes' | 'maybe' | 'no';
    paymentPreference?: 'cash' | 'loan' | 'lease_ppa' | 'unsure';
  }) {
    setIsRefining(true);
    setError(null);
    try {
      const result = await runAssessment({ address, ...values });
      setAssessment(result);
      saveSession(address, result);
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
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-white hover:text-amber-400 transition-colors"
          >
            <SunIcon className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-base tracking-tight">Energy Advocate</span>
          </button>
          <div className="flex items-center gap-4">
            <a href="/tools" className="text-sm text-slate-400 hover:text-amber-400 transition-colors font-medium">
              Quote & Contract Tools
            </a>
            {phase === 'result' && (
              <button onClick={handleReset} className="text-sm text-slate-400 hover:text-white transition-colors">
                New assessment
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={`flex-1 w-full ${phase !== 'input' ? 'max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16' : ''}`}>
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
            <AssessmentCard
              assessment={assessment}
              onLocationRefine={handleLocationRefine}
              onSharpen={handleSharpen}
              isRefining={isRefining}
            />
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
