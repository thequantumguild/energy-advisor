'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SolarPanelPlacement, RoofSegment } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';

let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.onload = () => resolve();
    script.onerror = () => { mapsLoadPromise = null; reject(new Error('Maps failed')); };
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

// Compute 4 rotated corners for a panel rectangle on the map
// azimuthDeg = direction the roof faces (0=N, 90=E, 180=S, 270=W)
// halfLong = half-length along the slope, halfShort = half-length across the slope (meters)
function panelCorners(
  lat: number, lng: number,
  halfLong: number, halfShort: number,
  azimuthDeg: number
): { lat: number; lng: number }[] {
  const latPerM = 1 / 111320;
  const lngPerM = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  const rad = azimuthDeg * Math.PI / 180;
  const ca = Math.cos(rad), sa = Math.sin(rad);
  return (
    [
      [+halfLong, -halfShort],
      [+halfLong, +halfShort],
      [-halfLong, +halfShort],
      [-halfLong, -halfShort],
    ] as [number, number][]
  ).map(([al, sh]) => ({
    lat: lat + (al * ca - sh * sa) * latPerM,
    lng: lng + (al * sa + sh * ca) * lngPerM,
  }));
}

interface Props {
  panels: SolarPanelPlacement[];
  roofSegments: RoofSegment[];
  panelCapacityWatts: number;
  panelHeightMeters: number;
  panelWidthMeters: number;
  utilityRatePerKwh: number;
  centerLat: number;
  centerLng: number;
}

export default function PanelDesigner({
  panels,
  roofSegments,
  panelCapacityWatts,
  panelHeightMeters,
  panelWidthMeters,
  utilityRatePerKwh,
  centerLat,
  centerLng,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeSet, setActiveSet] = useState<Set<number>>(() => new Set(panels.map((_, i) => i)));
  const [mapReady, setMapReady] = useState(false);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const polygonsRef = useRef<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const activeSetRef = useRef(activeSet);
  activeSetRef.current = activeSet;

  // Lazy-init the map the first time the section is opened
  useEffect(() => {
    if (!open || mapInstanceRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    loadGoogleMaps(apiKey).then(() => {
      if (!mapDivRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G = (window as any).google.maps;

      const map = new G.Map(mapDivRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 20,
        mapTypeId: 'satellite',
        tilt: 0,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        rotateControl: false,
        scaleControl: true,
      });
      mapInstanceRef.current = map;

      // Draw all panel polygons
      const newPolygons: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
      panels.forEach((panel, i) => {
        const seg = roofSegments[panel.segmentIndex];
        const azimuth = seg?.azimuthDegrees ?? 180;

        // Portrait: long axis up the slope; Landscape: short axis up the slope
        const halfLong = panel.orientation === 'LANDSCAPE' ? panelWidthMeters / 2 : panelHeightMeters / 2;
        const halfShort = panel.orientation === 'LANDSCAPE' ? panelHeightMeters / 2 : panelWidthMeters / 2;

        const corners = panelCorners(
          panel.center.latitude,
          panel.center.longitude,
          halfLong, halfShort, azimuth
        );

        const active = activeSetRef.current.has(i);
        const poly = new G.Polygon({
          paths: corners,
          strokeColor:   active ? '#92400e' : '#334155',
          strokeOpacity: active ? 1.0 : 0.6,
          strokeWeight: 2,
          fillColor:   active ? '#fbbf24' : '#94a3b8',
          fillOpacity: active ? 0.85 : 0.2,
          map,
          clickable: true,
          zIndex: active ? 2 : 1,
        });

        poly.addListener('click', () => {
          setActiveSet(prev => {
            const next = new Set(prev);
            next.has(i) ? next.delete(i) : next.add(i);
            return next;
          });
        });

        newPolygons.push(poly);
      });

      polygonsRef.current = newPolygons;
      setMapReady(true);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Update polygon styles when activeSet changes (without recreating polygons)
  useEffect(() => {
    if (!mapReady) return;
    polygonsRef.current.forEach((poly, i) => {
      if (!poly) return;
      const active = activeSet.has(i);
      poly.setOptions({
        fillColor:   active ? '#fbbf24' : '#94a3b8',
        fillOpacity: active ? 0.85 : 0.2,
        strokeColor:   active ? '#92400e' : '#334155',
        strokeOpacity: active ? 1.0 : 0.6,
        strokeWeight: 2,
        zIndex: active ? 2 : 1,
      });
    });
  }, [activeSet, mapReady]);

  const selectAll   = useCallback(() => setActiveSet(new Set(panels.map((_, i) => i))), [panels]);
  const clearAll    = useCallback(() => setActiveSet(new Set()), []);

  // Live stats from active panels
  const selectedCount = activeSet.size;
  const systemKw      = (selectedCount * panelCapacityWatts) / 1000;
  const annualKwhDC   = [...activeSet].reduce((sum, i) => sum + panels[i].yearlyEnergyDcKwh, 0);
  const annualKwh     = Math.round(annualKwhDC * 0.8); // AC derate
  const annualSavings = annualKwh * utilityRatePerKwh;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* Header — always visible, click to open/close */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">System Designer</p>
          <p className="text-base font-bold text-slate-900">Design Your Roof</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {selectedCount} of {panels.length} panels selected · click any panel to toggle
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Teaser stats when collapsed */}
          {!open && selectedCount > 0 && (
            <div className="hidden sm:flex items-center gap-4 text-right">
              <div>
                <p className="text-xs text-slate-400">System</p>
                <p className="text-sm font-bold text-slate-700">{systemKw.toFixed(1)} kW</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Annual savings</p>
                <p className="text-sm font-bold text-amber-600">{formatCurrency(annualSavings)}</p>
              </div>
            </div>
          )}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <>
          {/* Live stats bar */}
          <div className="bg-slate-900 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Panels"         value={selectedCount > 0 ? String(selectedCount)                : '—'} sub={`${panelCapacityWatts}W each`} />
            <Stat label="System size"    value={selectedCount > 0 ? `${systemKw.toFixed(1)} kW`         : '—'} sub="DC nameplate" />
            <Stat label="Annual output"  value={annualKwh > 0      ? `${formatNumber(annualKwh)} kWh`   : '—'} sub="estimated AC" />
            <Stat label="Annual savings" value={annualKwh > 0      ? formatCurrency(annualSavings)       : '—'} sub={`$${utilityRatePerKwh.toFixed(3)}/kWh`} accent />
          </div>

          {/* Map */}
          <div className="relative">
            <div ref={mapDivRef} style={{ width: '100%', height: 460 }} />

            {!mapReady && (
              <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center gap-3">
                <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading panel positions…</p>
              </div>
            )}

            {/* Map controls overlay */}
            {mapReady && (
              <div className="absolute top-3 left-3 flex gap-2">
                <button
                  onClick={selectAll}
                  className="bg-slate-900/85 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={clearAll}
                  className="bg-slate-900/85 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Legend */}
            {mapReady && (
              <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-sm rounded-lg px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-2 rounded-sm bg-amber-400 border border-amber-600" />
                  <span className="text-xs text-slate-200">Active panel</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-2 rounded-sm bg-slate-400/50 border border-slate-500" />
                  <span className="text-xs text-slate-200">Excluded</span>
                </div>
                <p className="text-xs text-slate-400 pt-0.5 border-t border-slate-700">Click panel to toggle</p>
              </div>
            )}
          </div>

          {/* Segment summary footer */}
          {mapReady && roofSegments.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Panels per roof section</p>
              <div className="flex flex-wrap gap-2">
                {roofSegments.map((seg, si) => {
                  const total  = panels.filter(p => p.segmentIndex === si).length;
                  const active = panels.filter((p, pi) => p.segmentIndex === si && activeSet.has(pi)).length;
                  if (total === 0) return null;
                  return (
                    <div key={si} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-semibold text-slate-600">Section {si + 1}</span>
                      <span className="text-xs text-slate-400">{active}/{total} active</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}
