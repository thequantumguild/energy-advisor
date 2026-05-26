@AGENTS.md

# Energy Advisor

A residential solar assessment web app. Homeowner enters an address and immediately gets a real, data-backed solar assessment — no sign-up, no sales pitch.

## Tech Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Deployment target: Vercel

## What's Been Built

### API Keys needed (in `.env.local`)
- `GOOGLE_MAPS_API_KEY` — Google Maps Geocoding + Google Solar API
- `NREL_API_KEY` — NREL PVWatts V8 (free at developer.nrel.gov)
- `EIA_API_KEY` — EIA electricity retail rates (free at eia.gov/opendata)
- `DSIRE_API_KEY` — optional, falls back to hardcoded state data

### File Structure
```
lib/
  types.ts       — all TypeScript interfaces (Assessment, RoofData, CostData, etc.)
  utils.ts       — azimuthToLabel, shadingFromSunshineHours, formatCurrency, etc.
  fallbacks.ts   — state avg consumption, net metering status per state, STATE_INCENTIVES map, LBNL cost benchmarks

app/
  layout.tsx     — metadata, Geist font, slate-50 background
  globals.css    — Tailwind + custom animations (fadeUp, stepIn, pulseDot)
  page.tsx       — client component, state machine: input → loading → result
  api/
    assess/
      route.ts   — POST endpoint: geocode → Google Solar + EIA in parallel → PVWatts → unified Assessment JSON
  components/
    AddressInput.tsx    — single address form
    LoadingState.tsx    — animated 5-step progress indicator
    AssessmentCard.tsx  — all 7 assessment sections (roof, production, savings, cost, incentives, payback, flags)
    SharpenForm.tsx     — 3-question refinement form (bill, high loads, shading), updates card in place
```

### Assessment Card — 7 Sections
1. **Your Roof** — usable area (sq ft), orientation label, shading badge, panel count, pitch
2. **Your Production** — annual kWh from PVWatts, equivalent homes
3. **Your Savings** — % offset, annual $ savings, utility rate (from EIA), state avg note
4. **Honest Cost Range** — low/high $ range (LBNL benchmark $2.70–$3.50/W)
5. **Your Incentives** — federal ITC $ amount, state incentives list, net metering status
6. **Real Payback Range** — low–high years, net cost after ITC
7. **What to Watch For** — 5–6 red flags written in plain language for homeowners

### API Fallback Chain
- Google Solar unavailable → regional estimate, `dataQuality: 'low'`
- PVWatts unavailable → Google Solar DC × 0.80
- EIA unavailable → US national average $0.137/kWh
- DSIRE → always uses hardcoded `STATE_INCENTIVES` map (20 states covered)

### Planned Next Features (not yet built)
- PDF report download
- Shareable assessment URL (short unique ID)
- Utility bill PDF upload/parsing
- Side-by-side installer quote comparison
- Crowdsourced regional pricing database

## Running Locally
```bash
npm run dev
# open http://localhost:3000
```

## Deploy
Push to GitHub → import to Vercel → add env vars in Vercel project settings.
