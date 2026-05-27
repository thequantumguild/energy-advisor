'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  lat: number;
  lng: number;
  compact?: boolean;
}

// Viridis-inspired solar heat map: purple → blue → teal → green → yellow
const HEAT_STOPS: [number, number, number][] = [
  [68,   1,  84],
  [59,  82, 139],
  [33, 145, 140],
  [94, 201,  98],
  [253, 231,  37],
];

function interpolateColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled  = clamped * (HEAT_STOPS.length - 1);
  const lo      = Math.floor(scaled);
  const hi      = Math.min(lo + 1, HEAT_STOPS.length - 1);
  const frac    = scaled - lo;
  return [
    Math.round(HEAT_STOPS[lo][0] + (HEAT_STOPS[hi][0] - HEAT_STOPS[lo][0]) * frac),
    Math.round(HEAT_STOPS[lo][1] + (HEAT_STOPS[hi][1] - HEAT_STOPS[lo][1]) * frac),
    Math.round(HEAT_STOPS[lo][2] + (HEAT_STOPS[hi][2] - HEAT_STOPS[lo][2]) * frac),
  ];
}

type Status = 'idle' | 'loading' | 'done' | 'error';

function InfoPopover({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute top-8 left-0 z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-2"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">Solar Flux Map</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm leading-none">✕</button>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">
        Shows solar energy per m² across your roof in <strong>kWh/kWp/yr</strong>. Yellow = most sun; purple = shaded or north-facing. Google models shadows hourly using satellite imagery + a 3D roof mesh.
      </p>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400 whitespace-nowrap">Low</span>
        <div className="flex-1 h-1.5 rounded-full" style={{
          background: 'linear-gradient(to right, rgb(68,1,84), rgb(59,82,139), rgb(33,145,140), rgb(94,201,98), rgb(253,231,37))'
        }} />
        <span className="text-xs text-slate-400 whitespace-nowrap">High</span>
      </div>
    </div>
  );
}

export default function FluxMap({ lat, lng, compact }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus]   = useState<Status>('idle');
  const [minVal, setMinVal]   = useState<number | null>(null);
  const [maxVal, setMaxVal]   = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    async function load() {
      try {
        const res = await fetch(`/api/fluxmap?lat=${lat}&lng=${lng}&type=annual`);
        if (!res.ok) { if (!cancelled) setStatus('error'); return; }

        const buffer   = await res.arrayBuffer();
        const boundsHdr = res.headers.get('X-Flux-Bounds');

        // Dynamically import geotiff to keep initial bundle small
        const { fromArrayBuffer } = await import('geotiff');
        const tiff  = await fromArrayBuffer(buffer);
        const image = await tiff.getImage();
        const data  = await image.readRasters({ interleave: true }) as unknown as Float32Array;

        if (cancelled) return;

        // Find min/max ignoring sentinel values (< 0 or NaN)
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < data.length; i++) {
          const v = data[i];
          if (v > 0 && isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
        }
        if (lo === Infinity) { setStatus('error'); return; }

        const range = hi - lo || 1;
        setMinVal(Math.round(lo));
        setMaxVal(Math.round(hi));

        // Render to canvas
        const w = image.getWidth();
        const h = image.getHeight();
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        const img = ctx.createImageData(w, h);

        for (let i = 0; i < w * h; i++) {
          const v = data[i];
          const base = i * 4;
          if (v <= 0 || !isFinite(v)) {
            img.data[base]     = 0;
            img.data[base + 1] = 0;
            img.data[base + 2] = 0;
            img.data[base + 3] = 0; // transparent
          } else {
            const t = (v - lo) / range;
            const [r, g, b] = interpolateColor(t);
            img.data[base]     = r;
            img.data[base + 1] = g;
            img.data[base + 2] = b;
            img.data[base + 3] = 200; // slight transparency for overlay use
          }
        }

        ctx.putImageData(img, 0, 0);
        void boundsHdr; // bounds available if we need to geo-register later
        setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (status === 'error') return null;

  return (
    <div className={`rounded-xl border border-slate-100 overflow-hidden ${compact ? '' : 'mt-3'}`}>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="relative flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Solar flux map
          </span>
          <button
            onClick={() => setShowModal(v => !v)}
            className="w-4 h-4 rounded-full bg-slate-200 hover:bg-blue-100 text-slate-500 hover:text-blue-600 text-xs font-bold flex items-center justify-center transition-colors"
            title="What is this?"
          >
            ?
          </button>
          {showModal && <InfoPopover onClose={() => setShowModal(false)} />}
        </div>
        {status === 'loading' && (
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
            Loading flux data…
          </span>
        )}
        {status === 'done' && minVal != null && maxVal != null && (
          <span className="text-xs text-slate-400">
            {minVal.toLocaleString()}–{maxVal.toLocaleString()} kWh/kWp/yr
          </span>
        )}
      </div>

      <div className="relative bg-slate-100 mx-4 mb-3 rounded-lg overflow-hidden" style={{ height: compact ? 128 : 140 }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated', objectFit: 'cover', display: status === 'done' ? 'block' : 'none' }}
        />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Color scale legend */}
      {status === 'done' && minVal != null && maxVal != null && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">{minVal.toLocaleString()}</span>
          <div
            className="flex-1 h-2 rounded-full"
            style={{
              background: `linear-gradient(to right, rgb(68,1,84), rgb(59,82,139), rgb(33,145,140), rgb(94,201,98), rgb(253,231,37))`,
            }}
          />
          <span className="text-xs text-slate-400 whitespace-nowrap">{maxVal.toLocaleString()} kWh/kWp</span>
        </div>
      )}
    </div>
  );
}
