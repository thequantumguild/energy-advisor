'use client';

import { useState, FormEvent } from 'react';

interface SharpenValues {
  monthlyBill?: number;
  hasHighLoads?: 'yes' | 'no' | 'not_sure';
  shadingOverride?: 'yes' | 'partially' | 'lots';
}

interface SharpenFormProps {
  onSubmit: (values: SharpenValues) => void;
  isLoading: boolean;
}

export default function SharpenForm({ onSubmit, isLoading }: SharpenFormProps) {
  const [bill, setBill] = useState('');
  const [loads, setLoads] = useState<SharpenValues['hasHighLoads']>();
  const [shading, setShading] = useState<SharpenValues['shadingOverride']>();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      monthlyBill: bill ? parseFloat(bill) : undefined,
      hasHighLoads: loads,
      shadingOverride: shading,
    });
  }

  const canSubmit = bill || loads || shading;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="mb-6">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">
            Want a sharper estimate?
          </p>
          <p className="text-slate-700">
            Answer 3 quick questions to tighten the numbers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Q1: Monthly bill */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              1. What&apos;s your average monthly electric bill?
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
              <input
                type="number"
                value={bill}
                onChange={(e) => setBill(e.target.value)}
                placeholder="150"
                min="1"
                max="9999"
                className="w-full pl-7 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Q2: High loads */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              2. Do you have or plan to add an EV, pool, or heat pump?
            </label>
            <div className="flex flex-wrap gap-2">
              {(['yes', 'no', 'not_sure'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLoads(opt)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    loads === opt
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-blue-300'
                  }`}
                >
                  {opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : 'Not sure'}
                </button>
              ))}
            </div>
          </div>

          {/* Q3: Shading */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              3. Does your roof get direct sun most of the day?
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: 'yes', label: 'Yes, most of the day' },
                  { value: 'partially', label: 'Partially' },
                  { value: 'lots', label: 'Lots of shade' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setShading(opt.value)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    shading === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-blue-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Recalculating...' : 'Update My Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
