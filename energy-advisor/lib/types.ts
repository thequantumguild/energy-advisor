export interface AssessmentRequest {
  address: string;
  monthlyBill?: number;
  hasHighLoads?: 'yes' | 'no' | 'not_sure';
  shadingOverride?: 'yes' | 'partially' | 'lots';
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
  carbonOffsetKgPerMwh?: number;
  panelLifetimeYears?: number;
  panelHeightMeters?: number;
  panelWidthMeters?: number;
  wholeRoofStats?: WholeRoofStats;
}

export interface PanelConfig {
  panelsCount: number;
  yearlyEnergyDcKwh: number;
}

export interface WholeRoofStats {
  areaMeters2: number;
  groundAreaMeters2: number;
  sunshineQuantiles: number[];
}

export interface GoogleFinancialSummary {
  monthlyBillDollars: number;
  paybackYears: number;
  lifetimeSavingsDollars: number;
  federalIncentiveDollars: number;
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
}

export interface SavingsData {
  offsetPercent: number;
  annualSavings: number;
  utilityRatePerKwh: number;
  stateAbbr: string;
  annualConsumptionKwh: number;
  isStateAverage: boolean;
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
  federalITCPercent: number;
  federalITCDollars: number;
  stateIncentives: StateIncentive[];
  netMeteringStatus: 'full' | 'limited' | 'none';
  netMeteringDetail: string;
  hasStorageIncentive: boolean;
  storageDetail?: string;
}

export interface PaybackData {
  lowYears: number;
  highYears: number;
  netCostAfterITC: number;
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
}
