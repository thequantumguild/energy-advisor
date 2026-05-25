export function azimuthToLabel(degrees: number): string {
  const d = ((degrees % 360) + 360) % 360;
  if (d >= 337.5 || d < 22.5) return 'North-facing';
  if (d < 67.5) return 'Northeast-facing';
  if (d < 112.5) return 'East-facing';
  if (d < 157.5) return 'Southeast-facing';
  if (d < 202.5) return 'South-facing';
  if (d < 247.5) return 'Southwest-facing';
  if (d < 292.5) return 'West-facing';
  return 'Northwest-facing';
}

export function shadingFromSunshineHours(sunshineHoursPerYear: number): {
  score: 'minimal' | 'moderate' | 'significant';
  label: string;
} {
  if (sunshineHoursPerYear >= 1500) {
    return { score: 'minimal', label: 'Minimal shading' };
  } else if (sunshineHoursPerYear >= 1100) {
    return { score: 'moderate', label: 'Some shading' };
  } else {
    return { score: 'significant', label: 'Significant shading' };
  }
}

export function metersSquaredToSqFt(m2: number): number {
  return Math.round(m2 * 10.7639);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function equivalentHomes(annualKwh: number): number {
  // US average home uses ~10,500 kWh/year (EIA 2023)
  return Math.round((annualKwh / 10500) * 10) / 10;
}
