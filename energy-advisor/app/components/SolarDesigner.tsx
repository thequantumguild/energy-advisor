'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { SolarPanelPlacement, RoofSegment } from '@/lib/types';
import { formatCurrency, formatNumber, azimuthToLabel, metersSquaredToSqFt } from '@/lib/utils';

function panelCorners(
  lat: number, lng: number, halfLong: number, halfShort: number, azimuthDeg: number,
): { lat: number; lng: number }[] {
  const latPerM = 1 / 111320;
  const lngPerM = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  const rad = azimuthDeg * Math.PI / 180;
  const ca = Math.cos(rad), sa = Math.sin(rad);
  return ([[+halfLong,-halfShort],[+halfLong,+halfShort],[-halfLong,+halfShort],[-halfLong,-halfShort]] as [number,number][])
    .map(([al,sh]) => ({ lat: lat+(al*ca-sh*sa)*latPerM, lng: lng+(al*sa+sh*ca)*lngPerM }));
}

function sunQuality(hrs: number) {
  if (hrs >= 1700) return { label:'Excellent', text:'text-green-700', bg:'bg-green-50',   border:'border-green-200',  dot:'bg-green-500'  };
  if (hrs >= 1400) return { label:'Good',      text:'text-amber-700', bg:'bg-amber-50',   border:'border-amber-200',  dot:'bg-amber-400'  };
  if (hrs >= 1100) return { label:'Moderate',  text:'text-orange-700',bg:'bg-orange-50',  border:'border-orange-200', dot:'bg-orange-400' };
  return               { label:'Limited',   text:'text-red-700',   bg:'bg-red-50',     border:'border-red-200',   dot:'bg-red-400'    };
}

let mapsLoadPromise: Promise<void> | null = null;
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    s.onload = () => resolve();
    s.onerror = () => { mapsLoadPromise = null; reject(); };
    document.head.appendChild(s);
  });
  return mapsLoadPromise;
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

export default function SolarDesigner({
  panels, roofSegments, panelCapacityWatts,
  panelHeightMeters, panelWidthMeters, utilityRatePerKwh,
  centerLat, centerLng,
}: Props) {
  const [open, setOpen]         = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [activeSegs, setActiveSegs]       = useState<Set<number>>(() => new Set(roofSegments.map((_, i) => i)));
  const [segOrientations, setSegOrientations] = useState<Record<number, 'PORTRAIT' | 'LANDSCAPE'>>({});

  const mapDivRef  = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<any>(null);     // eslint-disable-line @typescript-eslint/no-explicit-any
  const polysRef   = useRef<any[]>([]);     // eslint-disable-line @typescript-eslint/no-explicit-any

  // Group panels by segment, best energy first
  const panelsBySegment = useMemo(() => {
    const m = new Map<number, SolarPanelPlacement[]>();
    for (const p of panels) {
      if (!m.has(p.segmentIndex)) m.set(p.segmentIndex, []);
      m.get(p.segmentIndex)!.push(p);
    }
    for (const [k, arr] of m) m.set(k, arr.sort((a, b) => b.yearlyEnergyDcKwh - a.yearlyEnergyDcKwh));
    return m;
  }, [panels]);

  // Segments sorted by sun hours (best first)
  const segOrder = useMemo(
    () => roofSegments.map((_, i) => i).sort((a, b) => roofSegments[b].sunshineHoursMedian - roofSegments[a].sunshineHoursMedian),
    [roofSegments],
  );

  // Panels to render = active segments only
  const activePanels = useMemo(
    () => [...activeSegs].flatMap(i => panelsBySegment.get(i) ?? []),
    [activeSegs, panelsBySegment],
  );

  // Live stats
  const totalPanels   = activePanels.length;
  const systemKw      = (totalPanels * panelCapacityWatts) / 1000;
  const annualKwh     = Math.round(activePanels.reduce((s, p) => s + p.yearlyEnergyDcKwh, 0) * 0.8);
  const annualSavings = annualKwh * utilityRatePerKwh;

  // Init map on first open
  useEffect(() => {
    if (!open || mapRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    loadGoogleMaps(apiKey).then(() => {
      if (!mapDivRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G = (window as any).google.maps;
      const map = new G.Map(mapDivRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 21, mapTypeId: 'satellite', tilt: 0,
        zoomControl: true, mapTypeControl: false,
        streetViewControl: false, fullscreenControl: true, rotateControl: false, scaleControl: true,
      });
      mapRef.current = map;

      // Fit map to the full panel extent
      if (panels.length) {
        const bounds = new G.LatLngBounds();
        for (const p of panels) bounds.extend({ lat: p.center.latitude, lng: p.center.longitude });
        map.fitBounds(bounds, 60);
        G.event.addListenerOnce(map, 'bounds_changed', () => {
          if ((map.getZoom() ?? 0) > 21) map.setZoom(21);
        });
      }
      setMapReady(true);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Full re-render of polygons whenever active panels or orientations change
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google.maps;

    for (const p of polysRef.current) p.setMap(null);
    polysRef.current = [];

    for (const panel of activePanels) {
      const orientation = segOrientations[panel.segmentIndex] ?? panel.orientation;
      const seg         = roofSegments[panel.segmentIndex];
      const azimuth     = seg?.azimuthDegrees ?? 180;
      const halfLong    = orientation === 'PORTRAIT' ? panelHeightMeters / 2 : panelWidthMeters / 2;
      const halfShort   = orientation === 'PORTRAIT' ? panelWidthMeters / 2  : panelHeightMeters / 2;
      const corners     = panelCorners(panel.center.latitude, panel.center.longitude, halfLong, halfShort, azimuth);

      polysRef.current.push(new G.Polygon({
        paths: corners,
        strokeColor: '#92400e', strokeOpacity: 1, strokeWeight: 1.5,
        fillColor: '#fbbf24', fillOpacity: 0.85,
        map: mapRef.current, clickable: false, zIndex: 2,
      }));
    }
  }, [activePanels, segOrientations, mapReady, panelHeightMeters, panelWidthMeters, roofSegments]);

  function toggleSeg(i: number) {
    setActiveSegs(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  function setOrientation(i: number, o: 'PORTRAIT' | 'LANDSCAPE') {
    setSegOrientations(prev => ({ ...prev, [i]: o }));
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* Collapsible header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">System Designer</p>
          <p className="text-base font-bold text-slate-900">Design Your Roof</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeSegs.size} of {roofSegments.length} sections active · {totalPanels} panels · toggle sections, set orientation
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {!open && totalPanels > 0 && (
            <div className="hidden sm:flex items-center gap-4 text-right">
              <div><p className="text-xs text-slate-400">System</p><p className="text-sm font-bold text-slate-700">{systemKw.toFixed(1)} kW</p></div>
              <div><p className="text-xs text-slate-400">Annual savings</p><p className="text-sm font-bold text-amber-600">{formatCurrency(annualSavings)}</p></div>
            </div>
          )}
          <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <>
          {/* Stats bar */}
          <div className="bg-slate-900 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Panels"         value={totalPanels > 0 ? String(totalPanels)              : '—'} sub={`${panelCapacityWatts}W each`} />
            <Stat label="System size"    value={totalPanels > 0 ? `${systemKw.toFixed(1)} kW`      : '—'} sub="DC nameplate" />
            <Stat label="Annual output"  value={annualKwh > 0   ? `${formatNumber(annualKwh)} kWh` : '—'} sub="estimated AC" />
            <Stat label="Annual savings" value={annualKwh > 0   ? formatCurrency(annualSavings)    : '—'} sub={`$${utilityRatePerKwh.toFixed(3)}/kWh`} accent />
          </div>

          {/* Segment cards */}
          <div className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Roof sections — toggle to include, set orientation per face</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {segOrder.map(i => {
                const seg    = roofSegments[i];
                const on     = activeSegs.has(i);
                const q      = sunQuality(seg.sunshineHoursMedian);
                const count  = (panelsBySegment.get(i) ?? []).length;
                const sqFt   = Math.round(metersSquaredToSqFt(seg.areaMeters2));
                const orient = segOrientations[i] ?? 'PORTRAIT';

                return (
                  <div key={i} className={`rounded-xl border-2 p-4 transition-all ${on ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
                    {/* Face header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${on ? 'text-slate-400' : 'text-slate-300'}`}>Section {i + 1}</p>
                        <p className={`text-sm font-bold ${on ? 'text-slate-900' : 'text-slate-400'}`}>{azimuthToLabel(seg.azimuthDegrees)}</p>
                        <p className={`text-xs mt-0.5 ${on ? 'text-slate-500' : 'text-slate-400'}`}>{Math.round(seg.pitchDegrees)}° pitch · {formatNumber(sqFt)} sq ft</p>
                      </div>
                      {/* On/off toggle */}
                      <button
                        onClick={() => toggleSeg(i)}
                        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 ${
                          on ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-300'
                        }`}
                      >
                        {on && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Sun quality */}
                    <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 border mb-3 ${on ? `${q.bg} ${q.border}` : 'bg-slate-100 border-slate-200'}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${on ? q.dot : 'bg-slate-300'}`} />
                      <span className={`text-xs font-semibold ${on ? q.text : 'text-slate-400'}`}>{q.label}</span>
                      <span className={`text-xs ml-auto ${on ? `${q.text} opacity-70` : 'text-slate-400'}`}>{Math.round(seg.sunshineHoursMedian).toLocaleString()} hrs/yr</span>
                    </div>

                    {/* Panel count + orientation */}
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs ${on ? 'text-slate-500' : 'text-slate-300'}`}>
                        <span className={`font-semibold ${on ? 'text-slate-800' : 'text-slate-400'}`}>{count}</span> panels
                      </p>
                      {/* Portrait / Landscape pill */}
                      <div className={`flex rounded-lg border overflow-hidden text-xs font-semibold transition-opacity ${on ? 'border-slate-200 opacity-100' : 'border-slate-200 opacity-40 pointer-events-none'}`}>
                        <button
                          onClick={() => setOrientation(i, 'PORTRAIT')}
                          className={`px-2.5 py-1 transition-colors ${orient === 'PORTRAIT' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                        >
                          Portrait
                        </button>
                        <button
                          onClick={() => setOrientation(i, 'LANDSCAPE')}
                          className={`px-2.5 py-1 border-l border-slate-200 transition-colors ${orient === 'LANDSCAPE' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                        >
                          Landscape
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Map */}
          <div className="relative border-t border-slate-100">
            <div ref={mapDivRef} style={{ width: '100%', height: 500 }} />
            {!mapReady && (
              <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center gap-3">
                <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading panel positions…</p>
              </div>
            )}
            {mapReady && (
              <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-sm rounded-lg px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-2 rounded-sm bg-amber-400 border border-amber-600" />
                  <span className="text-xs text-slate-200">Active panel</span>
                </div>
                <p className="text-xs text-slate-400 pt-0.5 border-t border-slate-700">Toggle sections above to change layout</p>
              </div>
            )}
          </div>
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
