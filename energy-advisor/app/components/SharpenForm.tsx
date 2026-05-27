'use client';

import { useState, FormEvent, useRef } from 'react';

interface SharpenValues {
  monthlyBill?: number;
  hasHighLoads?: 'yes' | 'no' | 'not_sure';
  shadingOverride?: 'yes' | 'partially' | 'lots';
}

interface SharpenFormProps {
  onSubmit: (values: SharpenValues) => void;
  isLoading: boolean;
}

interface ParsedBill {
  totalBillDollars?: number | null;
  monthlyKwh?: number | null;
  ratePerKwh?: number | null;
  utilityName?: string | null;
}

export default function SharpenForm({ onSubmit, isLoading }: SharpenFormProps) {
  const [bill, setBill] = useState('');
  const [loads, setLoads] = useState<SharpenValues['hasHighLoads']>();
  const [shading, setShading] = useState<SharpenValues['shadingOverride']>();
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState<ParsedBill | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setParsed(null);

    const formData = new FormData();
    formData.append('bill', file);

    try {
      const res = await fetch('/api/parse-bill', { method: 'POST', body: formData });
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
      monthlyBill:    bill ? parseFloat(bill) : undefined,
      hasHighLoads:   loads,
      shadingOverride: shading,
    });
  }

  const canSubmit = bill || loads || shading;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Monthly bill + upload */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Average monthly electric bill
        </label>
        <div className="flex items-center gap-2">
          <div className="relative w-36">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
            <input
              type="number"
              value={bill}
              onChange={e => setBill(e.target.value)}
              placeholder="150"
              min="1" max="9999"
              className="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <span className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
            {uploading ? 'Reading…' : 'Upload bill'}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Parsed bill summary */}
        {parsed && !uploadError && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {parsed.utilityName && <span className="font-medium text-slate-700">{parsed.utilityName}</span>}
            {parsed.monthlyKwh  && <span>{parsed.monthlyKwh.toLocaleString()} kWh/mo</span>}
            {parsed.ratePerKwh  && <span>${parsed.ratePerKwh.toFixed(3)}/kWh</span>}
            {parsed.totalBillDollars && <span className="text-green-700 font-medium">✓ Bill amount pre-filled</span>}
          </div>
        )}
        {uploadError && <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>}
      </div>

      {/* High loads */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Do you have or plan to add an EV, pool, or heat pump?
        </label>
        <div className="flex flex-wrap gap-2">
          {(['yes', 'no', 'not_sure'] as const).map(opt => (
            <button key={opt} type="button" onClick={() => setLoads(opt)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                loads === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:border-blue-300'
              }`}
            >
              {opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : 'Not sure'}
            </button>
          ))}
        </div>
      </div>

      {/* Shading */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          How much shade does your roof get?
        </label>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'yes',       label: 'Full sun most of the day' },
            { value: 'partially', label: 'Partial shade' },
            { value: 'lots',      label: 'Heavy shade' },
          ] as const).map(opt => (
            <button key={opt.value} type="button" onClick={() => setShading(opt.value)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                shading === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:border-blue-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isLoading}
        className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Recalculating…' : 'Update Assessment'}
      </button>
    </form>
  );
}
