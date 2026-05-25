'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  { label: 'Locating your property', detail: 'Google Maps Geocoding' },
  { label: 'Analyzing your roof geometry', detail: 'Google Solar API' },
  { label: 'Calculating solar production', detail: 'NREL PVWatts V8' },
  { label: 'Pulling your utility rate', detail: 'EIA electricity data' },
  { label: 'Checking local incentives', detail: 'DSIRE + federal ITC' },
];

// Each step appears after a staggered delay to communicate real work happening
const STEP_DELAYS_MS = [300, 900, 1600, 2300, 2900];

interface LoadingStateProps {
  address: string;
}

export default function LoadingState({ address }: LoadingStateProps) {
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);

  useEffect(() => {
    const timers = STEP_DELAYS_MS.map((delay, i) =>
      setTimeout(() => setVisibleSteps((prev) => [...prev, i]), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium text-blue-600 uppercase tracking-wide mb-2">
          Pulling real data
        </p>
        <p className="text-slate-600 text-sm truncate">{address}</p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const isVisible = visibleSteps.includes(i);
          const isDone = visibleSteps.includes(i + 1);

          return (
            <div
              key={i}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
                isVisible
                  ? isDone
                    ? 'border-green-200 bg-green-50 animate-step-in'
                    : 'border-blue-200 bg-blue-50 animate-step-in'
                  : 'border-slate-200 bg-white opacity-30'
              }`}
            >
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {isDone ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : isVisible ? (
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse-dot"
                        style={{ animationDelay: `${d * 0.2}s` }}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 border-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? 'text-green-700' : isVisible ? 'text-blue-800' : 'text-slate-400'}`}>
                  {step.label}
                </p>
                <p className={`text-xs mt-0.5 ${isDone ? 'text-green-600' : isVisible ? 'text-blue-600' : 'text-slate-400'}`}>
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-slate-400 text-center">
        Usually completes in 3–5 seconds
      </p>
    </div>
  );
}
