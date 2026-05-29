'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Assessment, PanelConfig } from '@/lib/types';
import { azimuthToLabel, metersSquaredToSqFt, formatCurrency, formatNumber } from '@/lib/utils';

interface Props {
  roof: Assessment['roof'];
  production: Assessment['production'];
  savings: Assessment['savings'];
  onActiveSegments?: (indices: number[]) => void;
}

function quality(hrs: number) {
  if (hrs >= 1700) return { label: 'Excellent', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500' };
  if (hrs >= 1400) return { label: 'Good',      text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' };
  if (hrs >= 1100) return { label: 'Moderate',  text: 'text-orange-700',bg: 'bg-orange-50',border: 'border-orange-200',dot: 'bg-orange-400' };
  return              { label: 'Limited',    text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200',   dot: 'bg-red-400' };
}

function bestConfigForSegments(configs: PanelConfig[], selected: Set<number>): PanelConfig | null {
  if (!configs.length) return null;
  const matching = configs.filter(cfg => {
    if (!cfg.segmentSummaries?.length) return true;
    return cfg.segmentSummaries.filter(s => s.panelsCount > 0).every(s => selected.has(s.segmentIndex));
  });
  if (!matching.length) return null;
  return matching.reduce((best, c) => c.panelsCount > best.panelsCount ? c : best);
}

export default function DesignStudio({ roof, production, savings, onActiveSegments }: Props) {
  const segments   = roof.roofSegments ?? [];
  const configs    = production.panelConfigs ?? [];
  const panelWatts = production.panelCapacityWatts ?? 400;

  // Sort segment indices by sunshine hours descending so the best faces show first
  const segOrder = useMemo(
    () => segments.map((_, i) => i).sort((a, b) => segments[b].sunshineHoursMedian - segments[a].sunshineHoursMedian),
    [segments]
  );

  const [selected, setSelected] = useState<Set<number>>(() => new Set(segments.map((_, i) => i)));

  // Max panels per segment (from largest config)
  const maxPerSeg = useMemo(() => {
    const largest = [...configs].sort((a, b) => b.panelsCount - a.panelsCount)[0];
    const m = new Map<number, number>();
    for (const s of largest?.segmentSummaries ?? []) m.set(s.segmentIndex, s.panelsCount);
    return m;
  }, [configs]);

  const bestCfg = useMemo(() => bestConfigForSegments(configs, selected), [configs, selected]);

  const panelCount    = bestCfg?.panelsCount ?? 0;
  const systemKw      = (panelCount * panelWatts) / 1000;
  const annualKwh     = bestCfg ? Math.round(bestCfg.yearlyEnergyDcKwh * 0.8) : 0;
  const annualSavings = annualKwh * savings.utilityRatePerKwh;
  const costLow       = systemKw * 2700;
  const costHigh      = systemKw * 3500;

  // Keep map highlighting in sync with active design
  useEffect(() => {
    if (!onActiveSegments) return;
    const active = bestCfg?.segmentSummaries
      ? bestCfg.segmentSummaries.filter(s => s.panelsCount > 0).map(s => s.segmentIndex)
      : [...selected];
    onActiveSegments(active);
  }, [bestCfg, onActiveSegments, selected]);

  if (!segments.length || !configs.length) return null;

  function toggle(i: number) {
    setSelected(prev => {
      if (prev.has(i) && prev.size === 1) return prev; // keep at least one
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const allOn = selected.size === segments.length;
  const bestSeg = segOrder[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Design Your System</p>
          <p className="text-sm text-slate-500">Toggle roof sections — stats update live</p>
        </div>
        <button
          onClick={() => setSelected(allOn ? new Set([bestSeg]) : new Set(segments.map((_, i) => i)))}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap flex-shrink-0"
        >
          {allOn ? 'Best section only' : 'Select all'}
        </button>
      </div>

      {/* Live stats bar */}
      <div className="bg-slate-900 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <LiveStat label="Panels"        value={panelCount > 0 ? String(panelCount)            : '—'} sub={`${panelWatts}W each`} />
        <LiveStat label="System size"   value={panelCount > 0 ? `${systemKw.toFixed(1)} kW`  : '—'} sub="DC nameplate" />
        <LiveStat label="Annual output" value={annualKwh > 0  ? `${formatNumber(annualKwh)} kWh` : '—'} sub="estimated AC" />
        <LiveStat label="Annual savings" value={annualKwh > 0 ? formatCurrency(annualSavings) : '—'} sub={`$${savings.utilityRatePerKwh.toFixed(3)}/kWh`} accent />
      </div>

      {/* Segment cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
          {segOrder.map(i => {
            const seg  = segments[i];
            const on   = selected.has(i);
            const q    = quality(seg.sunshineHoursMedian);
            const max  = maxPerSeg.get(i) ?? 0;
            const sqFt = metersSquaredToSqFt(seg.areaMeters2);

            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                className={`relative text-left rounded-xl border-2 p-4 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  on ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'
                }`}
              >
                {/* Check circle */}
                <div className={`absolute top-3.5 right-3.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  on ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-300'
                }`}>
                  {on && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </div>

                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${on ? 'text-slate-400' : 'text-slate-300'}`}>
                  Section {i + 1}
                </p>
                <p className={`text-sm font-bold mb-0.5 transition-colors ${on ? 'text-slate-900' : 'text-slate-400'}`}>
                  {azimuthToLabel(seg.azimuthDegrees)}
                </p>
                <p className={`text-xs mb-3 ${on ? 'text-slate-500' : 'text-slate-400'}`}>
                  {Math.round(seg.pitchDegrees)}° pitch · {formatNumber(sqFt)} sq ft
                </p>

                {/* Sun quality pill */}
                <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 border mb-3 transition-colors ${
                  on ? `${q.bg} ${q.border}` : 'bg-slate-100 border-slate-200'
                }`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${on ? q.dot : 'bg-slate-300'}`} />
                  <span className={`text-xs font-semibold ${on ? q.text : 'text-slate-400'}`}>{q.label}</span>
                  <span className={`text-xs ml-auto ${on ? `${q.text} opacity-70` : 'text-slate-400'}`}>
                    {Math.round(seg.sunshineHoursMedian).toLocaleString()} hrs/yr
                  </span>
                </div>

                <p className={`text-xs ${on ? 'text-slate-400' : 'text-slate-300'}`}>
                  Up to{' '}
                  <span className={`font-semibold ${on ? 'text-slate-700' : 'text-slate-400'}`}>
                    {max} panel{max !== 1 ? 's' : ''}
                  </span>
                </p>
              </button>
            );
          })}
        </div>

        {/* Cost + section count footer */}
        {panelCount > 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Estimated install cost for this design</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(costLow)}
                <span className="text-slate-400 font-normal mx-1.5">–</span>
                {formatCurrency(costHigh)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">$2.70–$3.50/W · LBNL 2024 benchmark</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 mb-0.5">Active sections</p>
              <p className="text-2xl font-bold text-slate-900">
                {selected.size}
                <span className="text-sm font-normal text-slate-400 ml-1">of {segments.length}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            No panel configurations match the selected sections. Enable at least one additional section to see a design.
          </div>
        )}
      </div>
    </div>
  );
}

function LiveStat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold transition-all ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}
