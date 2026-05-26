'use client';

import { useEffect, useRef, useState } from 'react';
import type { RoofSegment } from '@/lib/types';
import { azimuthToLabel, metersSquaredToSqFt } from '@/lib/utils';

let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) { resolve(); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.onload = () => resolve();
    script.onerror = () => { mapsLoadPromise = null; reject(new Error('Maps failed')); };
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

function segmentFill(h: number) {
  if (h >= 1700) return '#22c55e';
  if (h >= 1400) return '#f59e0b';
  if (h >= 1100) return '#f97316';
  return '#ef4444';
}

function segmentLabel(h: number) {
  if (h >= 1700) return 'Excellent';
  if (h >= 1400) return 'Good';
  if (h >= 1100) return 'Moderate';
  return 'Limited';
}

interface Props {
  centerLat: number;
  centerLng: number;
  segments: RoofSegment[];
  onError?: () => void;
}

export default function SolarMap({ centerLat, centerLng, segments, onError }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { onError?.(); return; }

    loadGoogleMaps(apiKey)
      .then(() => {
        if (!mapRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const G = (window as any).google.maps;

        const map = new G.Map(mapRef.current, {
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

        const openWindows: { close: () => void }[] = [];

        segments.forEach(seg => {
          const fill = segmentFill(seg.sunshineHoursMedian);
          const label = segmentLabel(seg.sunshineHoursMedian);

          const circle = new G.Circle({
            strokeColor: '#ffffff',
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: fill,
            fillOpacity: 0.82,
            map,
            center: { lat: seg.centerLat, lng: seg.centerLng },
            radius: 4,
            clickable: true,
          });

          const info = new G.InfoWindow({
            content: `
              <div style="font-family:system-ui,sans-serif;min-width:148px;padding:2px 0 4px">
                <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:5px">
                  ${Math.round(seg.sunshineHoursMedian).toLocaleString()} hrs sun / yr
                </div>
                <div style="display:inline-block;background:${fill}22;color:${fill};border:1px solid ${fill}55;
                  border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;margin-bottom:6px">
                  ${label} solar
                </div>
                <div style="font-size:12px;color:#475569;line-height:1.7">
                  <div>${azimuthToLabel(seg.azimuthDegrees)}</div>
                  <div>${Math.round(seg.pitchDegrees)}° pitch</div>
                  <div>${metersSquaredToSqFt(seg.areaMeters2).toLocaleString()} sq ft</div>
                </div>
              </div>`,
          });

          circle.addListener('click', () => {
            openWindows.forEach(w => w.close());
            openWindows.length = 0;
            info.setPosition({ lat: seg.centerLat, lng: seg.centerLng });
            info.open({ map });
            openWindows.push(info);
          });
        });

        map.addListener('click', () => {
          openWindows.forEach(w => w.close());
          openWindows.length = 0;
        });

        setReady(true);
      })
      .catch(() => onError?.());
  }, [centerLat, centerLng, segments, onError]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-100">
      <div ref={mapRef} style={{ width: '100%', height: 288 }} />

      {!ready && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-sm rounded-lg px-3 py-2 space-y-1">
        {[
          { color: '#22c55e', label: 'Excellent 1700+' },
          { color: '#f59e0b', label: 'Good 1400–1700' },
          { color: '#f97316', label: 'Moderate 1100–1400' },
          { color: '#ef4444', label: 'Limited < 1100' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-slate-200 text-xs">{label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center py-1.5 bg-slate-50 border-t border-slate-100">
        Click roof segments to see solar potential · Google Solar API
      </p>
    </div>
  );
}
