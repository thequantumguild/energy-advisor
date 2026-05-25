import type { StateIncentive } from './types';

// EIA 2022 residential electricity consumption by state (kWh/year)
export const STATE_AVG_CONSUMPTION_KWH: Record<string, number> = {
  AL: 14700, AK: 6900,  AZ: 12200, AR: 12900, CA: 6600,
  CO: 8500,  CT: 7100,  DE: 9200,  FL: 14200, GA: 12600,
  HI: 6200,  ID: 12000, IL: 8600,  IN: 11100, IA: 8900,
  KS: 10000, KY: 13000, LA: 14400, ME: 6400,  MD: 9900,
  MA: 6600,  MI: 8200,  MN: 8400,  MS: 14500, MO: 11000,
  MT: 9000,  NE: 10500, NV: 10300, NH: 7400,  NJ: 7900,
  NM: 8300,  NY: 6600,  NC: 12600, ND: 11200, OH: 10200,
  OK: 13000, OR: 10100, PA: 9200,  RI: 6700,  SC: 13500,
  SD: 11300, TN: 14400, TX: 14900, UT: 9300,  VT: 5900,
  VA: 12300, WA: 12300, WV: 14000, WI: 8600,  WY: 9100,
};

export const DEFAULT_ANNUAL_CONSUMPTION_KWH = 10500;
export const DEFAULT_UTILITY_RATE_PER_KWH = 0.137; // US average 2024

// LBNL 2024 national residential solar benchmark
export const COST_PER_WATT_LOW = 2.70;
export const COST_PER_WATT_HIGH = 3.50;

export const FEDERAL_ITC_PERCENT = 0.30; // 30% through 2032

export type NetMeteringStatus = 'full' | 'limited' | 'none';

export const NET_METERING: Record<string, { status: NetMeteringStatus; detail: string }> = {
  AZ: { status: 'limited', detail: 'Arizona has net metering but export rates are set below retail. Varies by utility — confirm with yours before signing.' },
  CA: { status: 'limited', detail: 'California NEM 3.0 gives export credits well below retail rate. The value of solar here is mostly self-consumption — battery storage helps a lot.' },
  CO: { status: 'full',    detail: 'Colorado requires full retail net metering for systems sized up to 120% of annual load.' },
  CT: { status: 'full',    detail: 'Connecticut offers full retail net metering with annual true-up billing.' },
  FL: { status: 'limited', detail: 'Florida has net metering but the export rate and rules vary significantly by utility.' },
  GA: { status: 'limited', detail: 'Georgia has limited net metering. Rules vary considerably by utility.' },
  HI: { status: 'limited', detail: "Hawaii moved to a Smart Export tariff — exported power earns less than the retail rate. Self-consumption and storage are key here." },
  IL: { status: 'full',    detail: 'Illinois offers full retail net metering with annual true-up.' },
  MA: { status: 'full',    detail: 'Massachusetts has net metering with monthly credits that carry forward indefinitely.' },
  MD: { status: 'full',    detail: 'Maryland offers full retail net metering with annual true-up.' },
  ME: { status: 'full',    detail: 'Maine has net energy billing — excess credits carry forward month to month.' },
  MN: { status: 'full',    detail: 'Minnesota has retail-rate net metering for systems up to 40 kW.' },
  MT: { status: 'full',    detail: 'Montana has retail-rate net metering for residential systems.' },
  NC: { status: 'limited', detail: 'North Carolina has net metering but utilities differ meaningfully in how they credit exports.' },
  NJ: { status: 'full',    detail: 'New Jersey has full net metering with annual true-up billing.' },
  NM: { status: 'full',    detail: 'New Mexico has full retail net metering.' },
  NV: { status: 'limited', detail: "Nevada's revised net metering offers below-retail credits, though not dramatically so." },
  NH: { status: 'full',    detail: 'New Hampshire has net metering at retail rate.' },
  NY: { status: 'full',    detail: 'New York uses a Value of Distributed Energy Resources (VDER) tariff — credit rates vary by utility and time of export.' },
  OH: { status: 'limited', detail: 'Ohio has net metering but utilities have sought policy changes. Confirm current rules with your utility.' },
  OR: { status: 'full',    detail: 'Oregon has full retail net metering.' },
  PA: { status: 'full',    detail: 'Pennsylvania has net metering — rules vary slightly by utility.' },
  RI: { status: 'full',    detail: 'Rhode Island has full retail net metering.' },
  SC: { status: 'limited', detail: 'South Carolina has net metering but utilities have fought the policy repeatedly. Check current status.' },
  TX: { status: 'limited', detail: 'Texas has no statewide net metering law. Most ERCOT utilities offer avoided-cost credits only — well below retail.' },
  UT: { status: 'limited', detail: 'Utah has scaled back net metering. Export credits are below retail rate.' },
  VA: { status: 'full',    detail: 'Virginia has retail-rate net metering for systems up to 20 kW.' },
  VT: { status: 'full',    detail: 'Vermont has net metering through Green Mountain Power and other utilities.' },
  WA: { status: 'full',    detail: 'Washington has full retail net metering.' },
  WI: { status: 'limited', detail: 'Wisconsin has net metering but at below-retail rates in many utility territories.' },
};

export const DEFAULT_NET_METERING = {
  status: 'limited' as NetMeteringStatus,
  detail: 'Net metering rules vary by utility in your state. Ask any installer to confirm what your specific utility offers before assuming you\'ll receive full retail credit for exported power.',
};

export const STATE_INCENTIVES: Record<string, StateIncentive[]> = {
  AZ: [
    { name: 'Residential Solar Tax Credit', description: '25% of system cost, capped at $1,000, applied against AZ state income tax.', estimatedValue: 1000, type: 'state' },
    { name: 'Sales Tax Exemption', description: 'Solar equipment is exempt from state and local sales tax in Arizona.', type: 'state' },
  ],
  CA: [
    { name: 'SGIP Battery Rebate', description: 'Self-Generation Incentive Program offers rebates for battery storage paired with solar — up to $1,000/kWh for qualifying residential systems.', type: 'state', url: 'https://www.selfgenca.com/' },
    { name: 'Property Tax Exclusion', description: 'Active solar systems are excluded from property tax reassessment in California.', type: 'state' },
  ],
  CO: [
    { name: 'Residential Energy Storage Tax Credit', description: 'Colorado tax credit for battery storage systems paired with solar. Check current rates with the CO Energy Office.', type: 'state' },
    { name: 'Sales Tax Exemption', description: 'Solar equipment is exempt from Colorado sales and use tax.', type: 'state' },
  ],
  CT: [
    { name: 'Residential Solar Investment Program', description: 'Incentive based on system output — check PURA for current block rates.', type: 'state', url: 'https://www.energizect.com/solar' },
    { name: 'Sales Tax Exemption', description: 'Solar installations are exempt from Connecticut sales tax.', type: 'state' },
  ],
  FL: [
    { name: 'Sales Tax Exemption', description: 'Solar equipment is fully exempt from Florida state sales tax.', type: 'state' },
    { name: 'Property Tax Exemption', description: "Florida law prohibits reassessing property value due to solar installation — your property tax won't increase.", type: 'state' },
  ],
  MA: [
    { name: 'SMART Program', description: 'Production-based incentive — a fixed $/kWh payment for power generated, paid monthly for 10 years. Rates vary by utility territory and available capacity block.', type: 'state', url: 'https://www.masssolar.com/' },
    { name: 'State Income Tax Credit', description: '15% of net installed cost, capped at $1,000, applied against MA state income tax.', estimatedValue: 1000, type: 'state' },
    { name: 'Sales Tax Exemption', description: 'Solar equipment is fully exempt from Massachusetts sales tax.', type: 'state' },
  ],
  MD: [
    { name: 'Residential Clean Energy Grant', description: 'Maryland Energy Administration offers grants periodically — check MEA for current program availability.', type: 'state', url: 'https://energy.maryland.gov/' },
    { name: 'Property Tax Exemption', description: 'Solar installations are excluded from Maryland property tax assessment.', type: 'state' },
  ],
  MN: [
    { name: 'Made in Minnesota Solar Incentive', description: 'Production incentive for systems using MN-manufactured panels — check current availability with your utility.', type: 'state' },
    { name: 'Sales Tax Exemption', description: 'Solar systems are exempt from Minnesota sales tax.', type: 'state' },
  ],
  NJ: [
    { name: 'Successor Solar Incentive (SuSI)', description: 'Fixed SREC payments for solar certificates generated over 15 years. Check NJ Clean Energy for current rates.', type: 'state', url: 'https://www.njcleanenergy.com/' },
    { name: 'Sales Tax Exemption', description: 'Solar equipment is exempt from New Jersey sales tax.', type: 'state' },
    { name: 'Property Tax Exemption', description: 'Solar installations are excluded from NJ property tax assessment.', type: 'state' },
  ],
  NY: [
    { name: 'NY-Sun Megawatt Block Incentive', description: 'Upfront rebate per watt installed — amount varies by utility territory and available capacity. Check NYSERDA for current rates.', type: 'state', url: 'https://www.nyserda.ny.gov/ny-sun' },
    { name: 'State Income Tax Credit', description: '25% of installed cost, capped at $5,000, applied against NY state income tax.', estimatedValue: 5000, type: 'state' },
    { name: 'Sales Tax Exemption', description: 'Solar equipment is exempt from NY state and local sales tax.', type: 'state' },
    { name: 'Property Tax Exemption', description: '15-year exemption from property tax increases due to solar installation.', type: 'state' },
  ],
  OR: [
    { name: 'Residential Energy Tax Credit', description: 'Oregon has phased out its major RETC, but check ODOE for any current credits or programs.', type: 'state', url: 'https://www.oregon.gov/energy/' },
    { name: 'Property Tax Exemption', description: 'Solar installations are exempt from Oregon property tax assessment.', type: 'state' },
  ],
  PA: [
    { name: 'SREC Market', description: "Pennsylvania has an active SREC market — you earn certificates for power generated that utilities must buy. Check SREC Trade for current prices.", type: 'state' },
    { name: 'Sales Tax Exemption', description: 'Solar equipment is exempt from Pennsylvania sales tax.', type: 'state' },
  ],
  TX: [
    { name: 'Property Tax Exemption', description: "Texas law exempts the added value of solar installation from property tax — your assessed value won't increase.", type: 'state' },
    { name: 'Local Utility Rebates', description: 'Austin Energy, CPS Energy, and other municipal utilities offer solar rebates. Check with your specific utility for current amounts.', type: 'utility' },
  ],
  VA: [
    { name: 'Sales Tax Exemption', description: 'Solar equipment is exempt from Virginia sales and use tax.', type: 'state' },
    { name: 'Property Tax Exemption', description: 'Local governments may exempt solar from property tax assessment — check with your county.', type: 'local' },
  ],
  WA: [
    { name: 'Sales Tax Exemption', description: 'Washington exempts solar equipment from sales and use tax.', type: 'state' },
    { name: 'Property Tax Exemption', description: 'Solar installations are exempt from Washington property tax.', type: 'state' },
  ],
};

export const DEFAULT_STATE_INCENTIVES: StateIncentive[] = [
  {
    name: 'Check DSIRE for Your State',
    description: 'DSIRE (Database of State Incentives for Renewables & Efficiency) lists all current state, local, and utility incentives for your area.',
    type: 'state',
    url: 'https://www.dsireusa.org/',
  },
];
