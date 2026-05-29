'use client';

import { useState, useMemo, useEffect } from 'react';
import type { PanelConfig } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface Props {
  panelConfigs: PanelConfig[];
  panelCapacityWatts: number;
  utilityRate: number;
  onActiveSegments?: (indices: number[]) => void;
}

export default function PanelSlider({ panelConfigs, panelCapacityWatts, utilityRate, onActiveSegments }: Props) {
  const sorted = useMemo(
    () => [...panelConfigs].sort((a, b) => a.panelsCount - b.panelsCount),
    [panelConfigs]
  );

  const midIdx = Math.floor(sorted.length / 2);
  const [idx, setIdx] = useState(midIdx);

  const cfg = sorted[idx] ?? sorted[0];
  const systemKw = cfg ? (cfg.panelsCount * panelCapacityWatts) / 1000 : 0;
  const annualAcKwh = cfg ? Math.round(cfg.yearlyEnergyDcKwh * 0.8) : 0;
  const annualSavings = annualAcKwh * utilityRate;
  const costLow = systemKw * 2700;
  const costHigh = systemKw * 3500;

  useEffect(() => {
    if (!onActiveSegments || !cfg?.segmentSummaries) return;
    const indices = cfg.segmentSummaries
      .filter(s => s.panelsCount > 0)
      .map(s => s.segmentIndex);
    onActiveSegments(indices);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  if (sorted.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Panel Count</span>
        <span className="text-sm font-bold text-amber-700">{cfg.panelsCount} panels</span>
      </div>

      <input
        type="range"
        min={0}
        max={sorted.length - 1}
        value={idx}
        onChange={e => setIdx(Number(e.target.value))}
        className="w-full accent-amber-500"
      />

      <div className="flex justify-between text-xs text-slate-400">
        <span>{sorted[0].panelsCount} min</span>
        <span>{sorted[sorted.length - 1].panelsCount} max</span>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Stat label="System size" value={`${systemKw.toFixed(1)} kW`} />
        <Stat label="Est. annual output" value={`${annualAcKwh.toLocaleString()} kWh`} />
        <Stat label="Est. annual savings" value={formatCurrency(annualSavings)} />
        <Stat label="Install cost range" value={`${formatCurrency(costLow)}–${formatCurrency(costHigh)}`} />
      </div>

      {cfg.segmentSummaries && cfg.segmentSummaries.length > 0 && (
        <div className="pt-1 text-xs text-slate-400">
          Active roof segments: {cfg.segmentSummaries.filter(s => s.panelsCount > 0).map(s => s.segmentIndex + 1).join(', ')}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/70 rounded-lg px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
