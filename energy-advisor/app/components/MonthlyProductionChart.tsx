'use client';

import { useState } from 'react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Chart dimensions (viewBox units)
const BAR_W = 28;
const GAP = 8;
const CHART_H = 88;
const LABEL_H = 14;
const SVG_W = 12 * (BAR_W + GAP) - GAP; // 432
const SVG_H = CHART_H + LABEL_H + 6;

interface Props {
  monthlyKwh: number[];
}

export default function MonthlyProductionChart({ monthlyKwh }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (monthlyKwh.length !== 12) return null;

  const max = Math.max(...monthlyKwh);

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
        Monthly production estimate
      </p>
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ overflow: 'visible', display: 'block' }}
      >
        {monthlyKwh.map((kwh, i) => {
          const barH = max > 0 ? (kwh / max) * CHART_H : 0;
          const x = i * (BAR_W + GAP);
          const y = CHART_H - barH;
          const isHov = hovered === i;

          // Tooltip: keep within SVG width
          const tipW = 72;
          const tipX = Math.min(Math.max(x + BAR_W / 2 - tipW / 2, 0), SVG_W - tipW);
          const tipY = Math.max(y - 30, 0);

          return (
            <g
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            >
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={BAR_W}
                height={barH}
                rx={4}
                fill={isHov ? '#f59e0b' : '#fbbf24'}
                opacity={isHov ? 1 : 0.8}
              />

              {/* Month label */}
              <text
                x={x + BAR_W / 2}
                y={CHART_H + LABEL_H + 2}
                textAnchor="middle"
                fontSize={9}
                fill={isHov ? '#475569' : '#94a3b8'}
                fontWeight={isHov ? '600' : '400'}
              >
                {MONTHS[i]}
              </text>

              {/* Hover tooltip */}
              {isHov && (
                <g>
                  <rect x={tipX} y={tipY} width={tipW} height={22} rx={4} fill="rgba(15,23,42,0.9)" />
                  <text
                    x={tipX + tipW / 2}
                    y={tipY + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill="white"
                    fontWeight="600"
                  >
                    {kwh.toLocaleString()} kWh
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Horizontal baseline */}
        <line x1={0} y1={CHART_H} x2={SVG_W} y2={CHART_H} stroke="#e2e8f0" strokeWidth={1} />
      </svg>
    </div>
  );
}
