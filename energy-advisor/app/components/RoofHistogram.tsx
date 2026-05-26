'use client';

interface Props {
  sunshineQuantiles: number[];
}

export default function RoofHistogram({ sunshineQuantiles }: Props) {
  if (!sunshineQuantiles || sunshineQuantiles.length < 2) return null;

  const min = Math.min(...sunshineQuantiles);
  const max = Math.max(...sunshineQuantiles);
  const range = max - min || 1;

  const bars = sunshineQuantiles.map((v, i) => ({
    value: v,
    height: Math.max(8, ((v - min) / range) * 80 + 8),
    pct: Math.round((i / (sunshineQuantiles.length - 1)) * 100),
  }));

  function barColor(v: number) {
    if (v >= 1700) return '#22c55e';
    if (v >= 1400) return '#f59e0b';
    if (v >= 1100) return '#f97316';
    return '#ef4444';
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Roof sunshine distribution
      </div>

      <div className="flex items-end gap-px h-20">
        {bars.map(({ value, height, pct }) => (
          <div
            key={pct}
            title={`${pct}th pct: ${Math.round(value).toLocaleString()} hrs/yr`}
            className="flex-1 rounded-sm cursor-default"
            style={{ height: `${height}%`, background: barColor(value) }}
          />
        ))}
      </div>

      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>{Math.round(min).toLocaleString()} hrs</span>
        <span className="text-slate-400">worst → best roof areas</span>
        <span>{Math.round(max).toLocaleString()} hrs</span>
      </div>
    </div>
  );
}
