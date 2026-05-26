'use client';

import { useState } from 'react';
import type { RoofSegment } from '@/lib/types';
import { azimuthToLabel, metersSquaredToSqFt } from '@/lib/utils';

// Satellite image params must match /api/satellite route
const ZOOM = 20;
const IMG_W = 640;
const IMG_H = 320;

function latLngToWorldPixel(lat: number, lng: number, zoom: number) {
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function segmentFill(sunshineHours: number): string {
  if (sunshineHours >= 1700) return '#22c55e';  // green — excellent
  if (sunshineHours >= 1400) return '#f59e0b';  // amber — good
  if (sunshineHours >= 1100) return '#f97316';  // orange — moderate
  return '#ef4444';                              // red — poor
}

interface Props {
  centerLat: number;
  centerLng: number;
  segments: RoofSegment[];
}

export default function SolarSegmentOverlay({ centerLat, centerLng, segments }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const centerPx = latLngToWorldPixel(centerLat, centerLng, ZOOM);

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox={`0 0 ${IMG_W} ${IMG_H}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {segments.map((seg, i) => {
        const segPx = latLngToWorldPixel(seg.centerLat, seg.centerLng, ZOOM);
        const cx = IMG_W / 2 + (segPx.x - centerPx.x);
        const cy = IMG_H / 2 + (segPx.y - centerPx.y);

        // Skip segments outside the visible image bounds
        if (cx < -20 || cx > IMG_W + 20 || cy < -20 || cy > IMG_H + 20) return null;

        const fill = segmentFill(seg.sunshineHoursMedian);
        const isHov = hovered === i;
        const r = isHov ? 14 : 10;

        // Position tooltip so it stays within the image
        const tipX = Math.min(Math.max(cx - 65, 4), IMG_W - 144);
        const tipY = cy - 8 > 80 ? cy - 84 : cy + 18;

        return (
          <g
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Glow ring */}
            <circle cx={cx} cy={cy} r={r + 4} fill={fill} fillOpacity={0.25} />
            {/* Main dot */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={fill}
              fillOpacity={0.85}
              stroke="white"
              strokeWidth={2}
            />

            {isHov && (
              <g>
                <rect x={tipX} y={tipY} width={140} height={72} rx={6} fill="rgba(15,23,42,0.92)" />
                <text x={tipX + 10} y={tipY + 18} fontSize={11} fontWeight="700" fill="white">
                  {Math.round(seg.sunshineHoursMedian).toLocaleString()} hrs sun / yr
                </text>
                <text x={tipX + 10} y={tipY + 34} fontSize={10} fill="#94a3b8">
                  {azimuthToLabel(seg.azimuthDegrees)}
                </text>
                <text x={tipX + 10} y={tipY + 48} fontSize={10} fill="#94a3b8">
                  {Math.round(seg.pitchDegrees)}° pitch · {metersSquaredToSqFt(seg.areaMeters2).toLocaleString()} sq ft
                </text>
                {/* Color swatch */}
                <rect x={tipX + 10} y={tipY + 57} width={8} height={8} rx={2} fill={fill} />
                <text x={tipX + 22} y={tipY + 65} fontSize={9} fill={fill}>
                  {seg.sunshineHoursMedian >= 1700 ? 'Excellent' : seg.sunshineHoursMedian >= 1400 ? 'Good' : seg.sunshineHoursMedian >= 1100 ? 'Moderate' : 'Limited'} solar
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${IMG_W - 110}, ${IMG_H - 72})`}>
        <rect x={0} y={0} width={106} height={68} rx={6} fill="rgba(15,23,42,0.75)" />
        {[
          { color: '#22c55e', label: 'Excellent  1700+' },
          { color: '#f59e0b', label: 'Good  1400–1700' },
          { color: '#f97316', label: 'Moderate  1100–1400' },
          { color: '#ef4444', label: 'Limited  < 1100' },
        ].map(({ color, label }, li) => (
          <g key={li} transform={`translate(8, ${10 + li * 14})`}>
            <circle cx={5} cy={5} r={4} fill={color} />
            <text x={14} y={9} fontSize={8.5} fill="#e2e8f0">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
