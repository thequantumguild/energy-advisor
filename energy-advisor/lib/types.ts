export interface AssessmentRequest {
  address: string;
  monthlyBill?: number;
  hasHighLoads?: 'yes' | 'no' | 'not_sure';
  shadingOverride?: 'yes' | 'partially' | 'lots';
  lat?: number;
  lng?: number;
  // Expanded sharpen fields
  electricLoads?: string[];          // 'ev' | 'pool' | 'heat_pump' | 'elec_water' | 'gas_mainly'
  stayYears?: '<5' | '5-10' | '10+';
  roofAge?: 'new' | 'good' | 'aging' | 'unknown';
  batteryInterest?: 'yes' | 'maybe' | 'no';
  paymentPreference?: 'cash' | 'loan' | 'lease_ppa' | 'unsure';
  panelTier?: 'premium' | 'standard' | 'budget';
  inverterType?: 'string' | 'micro' | 'optimizer';
}

export interface PanelSegmentSummary {
  segmentIndex: number;
  panelsCount: number;
  yearlyEnergyDcKwh: number;
}

export interface RoofSegment {
  centerLat: number;
  centerLng: number;
  pitchDegrees: number;
  azimuthDegrees: number;
  areaMeters2: number;
  sunshineHoursMedian: number;
}

export interface RoofData {
  usableAreaSqFt: number;
  azimuthDegrees: number;
  azimuthLabel: string;
  pitchDegrees: number;
  shadingScore: 'minimal' | 'moderate' | 'significant';
  shadingLabel: string;
  estimatedPanelCount: number;
  sunshineHoursPerYear: number;
  lat: number;
  lng: number;
  state: string;
  stateName: string;
  roofSegments?: RoofSegment[];
  imageryDate?: string;
  imageryQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
  carbonOffsetKgPerMwh?: number;
  panelLifetimeYears?: number;
  panelHeightMeters?: number;
  panelWidthMeters?: number;
  wholeRoofStats?: WholeRoofStats;
  maxPanelCount?: number;
  maxUsableAreaSqFt?: number;
}

export interface PanelConfig {
  panelsCount: number;
  yearlyEnergyDcKwh: number;
  segmentSummaries?: PanelSegmentSummary[];
}

export interface WholeRoofStats {
  areaMeters2: number;
  groundAreaMeters2: number;
  sunshineQuantiles: number[];
}

export interface GoogleFinancialSummary {
  monthlyBillDollars: number;
  lifetimeSavingsDollars: number;
  netMeteringAllowed: boolean;
  solarPercentage: number;
}

export interface ProductionData {
  annualKwh: number;
  systemCapacityKw: number;
  equivalentHomes: number;
  monthlyKwh?: number[];
  panelConfigs?: PanelConfig[];
  panelCapacityWatts?: number;
  // Dual-source estimates
  pvwattsAnnualKwh?: number;
  googleAnnualKwh?: number;
  productionConfidence?: 'high' | 'medium' | 'low';
  // P50/P90/P10 confidence range
  p90Kwh?: number;
  p10Kwh?: number;
  // PVWatts extended outputs
  capacityFactor?: number;
  dcAnnualKwh?: number;
  dcMonthlyKwh?: number[];
  poaMonthly?: number[];
  solradAnnual?: number;
  inverterType?: 'string' | 'micro' | 'optimizer';
  inverterEfficiencyPct?: number;
  systemLossPct?: number;
}

export interface SavingsData {
  offsetPercent: number;
  annualSavings: number;
  utilityRatePerKwh: number;
  utilityName?: string;
  stateAbbr: string;
  annualConsumptionKwh: number;
  isStateAverage: boolean;
  isStreetLevelRate?: boolean;
}

export interface CostData {
  lowEstimate: number;
  highEstimate: number;
  costPerWattLow: number;
  costPerWattHigh: number;
  systemCapacityKw: number;
}

export interface StateIncentive {
  name: string;
  description: string;
  estimatedValue?: number;
  type: 'state' | 'utility' | 'local';
  url?: string;
}

export interface IncentiveData {
  stateIncentives: StateIncentive[];
  netMeteringStatus: 'full' | 'limited' | 'none';
  netMeteringDetail: string;
  hasStorageIncentive: boolean;
  storageDetail?: string;
}

export interface PaybackData {
  lowYears: number;
  highYears: number;
  grossCost: number;
}

export interface FluxMapData {
  annualFluxUrl: string;
  monthlyFluxUrl?: string;
  maskUrl?: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface AdderEstimate {
  type: 'roof_replacement' | 'panel_upgrade' | 'ev_charger';
  label: string;
  lowEstimate: number;
  highEstimate: number;
  likelihood: 'likely' | 'possible';
  note: string;
}

export interface YearlyProjectionPoint {
  year: number;
  monthlyBillWithout: number;
  monthlyBillWith: number;
  annualSavings: number;
  cumulativeSavings: number;
}

export interface SavingsProjection {
  escalationRate: number;
  escalationSource: 'eia_historical' | 'national_average';
  totalSavings25yr: number;
  yearlyData: YearlyProjectionPoint[];
  degradationRate: number;
}

export interface ReOptData {
  optimalSystemKw: number;
  optimalBatteryKwh?: number;
  npvDollars: number;
  irrPercent: number;
  paybackYears: number;
  lcoePerKwh: number;
}

export interface Assessment {
  address: string;
  roof: RoofData;
  production: ProductionData;
  savings: SavingsData;
  cost: CostData;
  incentives: IncentiveData;
  payback: PaybackData;
  generatedAt: string;
  dataQuality: 'high' | 'medium' | 'low';
  warnings?: string[];
  roofImageUrl?: string;
  googleFinancial?: GoogleFinancialSummary;
  fluxMap?: FluxMapData;
  reopt?: ReOptData;
  projection?: SavingsProjection;
  adders?: AdderEstimate[];
}
