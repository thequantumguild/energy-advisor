'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  lat: number;
  lng: number;
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

function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-bold text-slate-900">What is the Solar Flux Map?</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none ml-4">✕</button>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          The solar flux map shows how much solar energy reaches each square meter of your roof over the course of a year, measured in <strong>kWh per kWp</strong> (kilowatt-hours per kilowatt-peak of installed capacity).
        </p>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2 text-sm text-slate-600">
          <p><strong>How it's made:</strong> Google's Solar API uses high-resolution satellite imagery combined with a 3D model of your roof and surrounding structures. It simulates the sun's path across the sky every hour of the year and calculates exactly how much light hits each point — accounting for pitch, orientation, and shadows cast by trees, chimneys, and neighboring buildings.</p>
          <p><strong>What the colors mean:</strong> Yellow areas get the most sun. Purple/blue areas are shaded or north-facing. The scale shown below the map gives you the actual kWh/kWp range for your specific roof.</p>
          <p><strong>Why it matters:</strong> Panels placed on the yellow areas will produce significantly more energy than panels on blue areas. A good installer will use this data to prioritize high-flux zones when laying out your system.</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
          <div className="flex-1 h-2 rounded-full" style={{
            background: 'linear-gradient(to right, rgb(68,1,84), rgb(59,82,139), rgb(33,145,140), rgb(94,201,98), rgb(253,231,37))'
          }} />
        </div>
        <div className="flex justify-between text-xs text-slate-400 -mt-2">
          <span>Low solar flux</span>
          <span>High solar flux</span>
        </div>

        <a
          href="https://developers.google.com/maps/documentation/solar/data-layers"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline block"
        >
          Source: Google Solar API — Data Layers →
        </a>
      </div>
    </div>
  );
}

export default function FluxMap({ lat, lng }: Props) {
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
    <>
      {showModal && <InfoModal onClose={() => setShowModal(false)} />}
    <div className="mt-3 rounded-xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Solar flux map
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="w-4 h-4 rounded-full bg-slate-200 hover:bg-blue-100 text-slate-500 hover:text-blue-600 text-xs font-bold flex items-center justify-center transition-colors"
            title="What is this?"
          >
            ?
          </button>
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

      <div className="relative bg-slate-100 mx-4 mb-3 rounded-lg overflow-hidden" style={{ minHeight: 120 }}>
        <canvas
          ref={canvasRef}
          className="w-full h-auto block"
          style={{ imageRendering: 'pixelated', display: status === 'done' ? 'block' : 'none' }}
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
    </>
  );
}
