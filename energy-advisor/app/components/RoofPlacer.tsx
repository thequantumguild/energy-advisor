'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RoofSegment, SolarPanelPlacement } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';

// Rotated rectangle corners — same math as PanelDesigner
function panelCorners(
  lat: number, lng: number,
  halfLong: number, halfShort: number,
  azimuthDeg: number,
): { lat: number; lng: number }[] {
  const latPerM = 1 / 111320;
  const lngPerM = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  const rad = azimuthDeg * Math.PI / 180;
  const ca = Math.cos(rad), sa = Math.sin(rad);
  return (
    [[+halfLong, -halfShort], [+halfLong, +halfShort], [-halfLong, +halfShort], [-halfLong, -halfShort]] as [number, number][]
  ).map(([al, sh]) => ({
    lat: lat + (al * ca - sh * sa) * latPerM,
    lng: lng + (al * sa + sh * ca) * lngPerM,
  }));
}

interface Bounds { north: number; south: number; east: number; west: number; }

interface PlacedPanel {
  id: number;
  lat: number;
  lng: number;
  azimuthDeg: number;
  yearlyEnergyDcKwh: number;
}

interface Props {
  centerLat: number;
  centerLng: number;
  roofSegments: RoofSegment[];
  suggestedPanels: SolarPanelPlacement[];
  panelCapacityWatts: number;
  panelHeightMeters: number;
  panelWidthMeters: number;
  utilityRatePerKwh: number;
}

let mapsLoadPromise: Promise<void> | null = null;
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.onload = () => resolve();
    script.onerror = () => { mapsLoadPromise = null; reject(new Error('Maps failed')); };
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

function latLngToPixel(lat: number, lng: number, bounds: Bounds, w: number, h: number) {
  const col = Math.round(((lng - bounds.west)  / (bounds.east  - bounds.west))  * w);
  const row = Math.round(((bounds.north - lat) / (bounds.north - bounds.south)) * h);
  return { col: Math.max(0, Math.min(w - 1, col)), row: Math.max(0, Math.min(h - 1, row)) };
}

function nearestSegment(lat: number, lng: number, segs: RoofSegment[]): RoofSegment | null {
  if (!segs.length) return null;
  return segs.reduce((best, seg) => {
    const d = (seg.centerLat - lat) ** 2 + (seg.centerLng - lng) ** 2;
    const db = (best.centerLat - lat) ** 2 + (best.centerLng - lng) ** 2;
    return d < db ? seg : best;
  });
}

function suggestedToPlaced(sp: SolarPanelPlacement[], segs: RoofSegment[]): PlacedPanel[] {
  return sp.map((p, i) => {
    const seg = segs[p.segmentIndex];
    return {
      id: -(i + 1),
      lat: p.center.latitude,
      lng: p.center.longitude,
      azimuthDeg: seg?.azimuthDegrees ?? 180,
      yearlyEnergyDcKwh: p.yearlyEnergyDcKwh,
    };
  });
}

export default function RoofPlacer({
  centerLat, centerLng, roofSegments, suggestedPanels,
  panelCapacityWatts, panelHeightMeters, panelWidthMeters, utilityRatePerKwh,
}: Props) {
  const [open, setOpen]         = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [maskStatus, setMaskStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [panels, setPanels]     = useState<PlacedPanel[]>([]);

  const mapDivRef   = useRef<HTMLDivElement>(null);
  const mapRef      = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const polygonsRef = useRef<Map<number, any>>(new Map()); // eslint-disable-line @typescript-eslint/no-explicit-any
  const maskRef     = useRef<{ data: Uint8Array | Float32Array; w: number; h: number; bounds: Bounds } | null>(null);
  const clickRef    = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const idRef       = useRef(0);

  // Initialize map + mask when first opened
  useEffect(() => {
    if (!open || mapRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    loadGoogleMaps(apiKey).then(async () => {
      if (!mapDivRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G = (window as any).google.maps;

      const map = new G.Map(mapDivRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 20, mapTypeId: 'satellite', tilt: 0,
        zoomControl: true, mapTypeControl: false,
        streetViewControl: false, fullscreenControl: false, rotateControl: false,
      });
      mapRef.current = map;
      setMapReady(true);

      // Load mask GeoTIFF
      try {
        const res = await fetch(`/api/fluxmap?lat=${centerLat}&lng=${centerLng}&type=mask`);
        if (!res.ok) { setMaskStatus('unavailable'); return; }

        const buffer    = await res.arrayBuffer();
        const boundsHdr = res.headers.get('X-Flux-Bounds');
        const bounds: Bounds = boundsHdr ? JSON.parse(boundsHdr) : {
          north: centerLat + 0.001, south: centerLat - 0.001,
          east:  centerLng + 0.001, west:  centerLng - 0.001,
        };

        const { fromArrayBuffer } = await import('geotiff');
        const tiff  = await fromArrayBuffer(buffer);
        const image = await tiff.getImage();
        const w     = image.getWidth();
        const h     = image.getHeight();
        const rasters = await image.readRasters();
        const data  = rasters[0] as Uint8Array;

        maskRef.current = { data, w, h, bounds };

        // Render mask as amber GroundOverlay
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
          if (data[i] > 0) {
            imgData.data[i * 4 + 0] = 251;
            imgData.data[i * 4 + 1] = 191;
            imgData.data[i * 4 + 2] = 36;
            imgData.data[i * 4 + 3] = 55; // ~22% opacity
          }
        }
        ctx.putImageData(imgData, 0, 0);

        const overlayBounds = new G.LatLngBounds(
          new G.LatLng(bounds.south, bounds.west),
          new G.LatLng(bounds.north, bounds.east),
        );
        new G.GroundOverlay(canvas.toDataURL(), overlayBounds, { opacity: 1, clickable: false }).setMap(map);
        setMaskStatus('ready');
      } catch (err) {
        console.error('[RoofPlacer] mask:', err);
        setMaskStatus('unavailable');
      }

      // Load Google's suggested panels as the starting layout
      setPanels(suggestedToPlaced(suggestedPanels, roofSegments));
      idRef.current = 0;
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Map click → place panel
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google.maps;
    if (clickRef.current) G.event.removeListener(clickRef.current);

    clickRef.current = mapRef.current.addListener('click', (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const clickLat = e.latLng.lat();
      const clickLng = e.latLng.lng();

      // Validate against mask
      if (maskRef.current) {
        const { data, w, h, bounds } = maskRef.current;
        const { col, row } = latLngToPixel(clickLat, clickLng, bounds, w, h);
        if (data[row * w + col] === 0) return; // not on roof
      }

      const seg = nearestSegment(clickLat, clickLng, roofSegments);
      const azimuth = seg?.azimuthDegrees ?? 180;
      const sunHours = seg?.sunshineHoursMedian ?? 1600;
      const yearlyDcKwh = (panelCapacityWatts / 1000) * sunHours * 0.75;

      const newId = idRef.current++;
      setPanels(prev => [...prev, { id: newId, lat: clickLat, lng: clickLng, azimuthDeg: azimuth, yearlyEnergyDcKwh: yearlyDcKwh }]);
    });

    return () => {
      if (clickRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).google?.maps.event.removeListener(clickRef.current);
        clickRef.current = null;
      }
    };
  }, [mapReady, roofSegments, panelCapacityWatts]);

  // Sync panel polygons
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = (window as any).google.maps;

    // Remove stale
    const liveIds = new Set(panels.map(p => p.id));
    for (const [id, poly] of polygonsRef.current) {
      if (!liveIds.has(id)) { poly.setMap(null); polygonsRef.current.delete(id); }
    }

    // Add new
    for (const panel of panels) {
      if (polygonsRef.current.has(panel.id)) continue;
      const halfLong = panelHeightMeters / 2;
      const halfShort = panelWidthMeters / 2;
      const corners = panelCorners(panel.lat, panel.lng, halfLong, halfShort, panel.azimuthDeg);
      const poly = new G.Polygon({
        paths: corners,
        strokeColor: '#92400e', strokeOpacity: 1, strokeWeight: 2,
        fillColor: '#fbbf24', fillOpacity: 0.85,
        map: mapRef.current, clickable: true, zIndex: 2,
      });
      const pid = panel.id;
      poly.addListener('click', (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        e.stop();
        setPanels(prev => prev.filter(p => p.id !== pid));
      });
      polygonsRef.current.set(panel.id, poly);
    }
  }, [panels, mapReady, panelHeightMeters, panelWidthMeters]);

  const resetToGoogle = useCallback(() => {
    setPanels(suggestedToPlaced(suggestedPanels, roofSegments));
    idRef.current = 0;
  }, [suggestedPanels, roofSegments]);

  const clearAll = useCallback(() => setPanels([]), []);

  // Live stats
  const systemKw    = (panels.length * panelCapacityWatts) / 1000;
  const annualKwh   = Math.round(panels.reduce((s, p) => s + p.yearlyEnergyDcKwh, 0) * 0.8);
  const annualSavings = annualKwh * utilityRatePerKwh;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Custom Panel Placement</p>
          <p className="text-base font-bold text-slate-900">Design Your System</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {panels.length > 0
              ? `${panels.length} panels · ${systemKw.toFixed(1)} kW · click roof to add, click panel to remove`
              : 'Click your roof to place panels anywhere you want'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {!open && panels.length > 0 && (
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
          <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <>
          {/* Live stats bar */}
          <div className="bg-slate-900 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Panels"         value={panels.length > 0 ? String(panels.length)           : '—'} sub={`${panelCapacityWatts}W each`} />
            <Stat label="System size"    value={panels.length > 0 ? `${systemKw.toFixed(1)} kW`     : '—'} sub="DC nameplate" />
            <Stat label="Annual output"  value={annualKwh > 0      ? `${formatNumber(annualKwh)} kWh` : '—'} sub="estimated AC" />
            <Stat label="Annual savings" value={annualKwh > 0      ? formatCurrency(annualSavings)   : '—'} sub={`$${utilityRatePerKwh.toFixed(3)}/kWh`} accent />
          </div>

          {/* Map */}
          <div className="relative">
            <div ref={mapDivRef} style={{ width: '100%', height: 500 }} />

            {!mapReady && (
              <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center gap-3">
                <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading your roof…</p>
              </div>
            )}

            {mapReady && (
              <>
                <div className="absolute top-3 left-3 flex gap-2">
                  <button onClick={resetToGoogle}
                    className="bg-slate-900/85 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors">
                    Google&apos;s layout
                  </button>
                  <button onClick={clearAll}
                    className="bg-slate-900/85 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors">
                    Clear all
                  </button>
                </div>

                <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-sm rounded-lg px-3 py-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-2 rounded-sm bg-amber-400 border border-amber-600" />
                    <span className="text-xs text-slate-200">Panel (click to remove)</span>
                  </div>
                  {maskStatus === 'ready' && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-2 rounded-sm" style={{ background: 'rgba(251,191,36,0.22)', border: '1px solid rgba(251,191,36,0.5)' }} />
                      <span className="text-xs text-slate-200">Valid roof area</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 pt-0.5 border-t border-slate-700">
                    {maskStatus === 'ready' ? 'Click highlighted area to place' : 'Click anywhere on the roof'}
                  </p>
                </div>
              </>
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
