'use client';

import { Document, Page, Text, View, StyleSheet, usePDF } from '@react-pdf/renderer';
import type { Assessment } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

const S = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b', padding: '36pt 40pt', backgroundColor: '#fff' },
  header:      { marginBottom: 18, borderBottom: '1.5pt solid #0ea5e9', paddingBottom: 10 },
  title:       { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  subtitle:    { fontSize: 9, color: '#64748b' },
  badge:       { fontSize: 7, backgroundColor: '#f0f9ff', color: '#0369a1', borderRadius: 4, padding: '2pt 6pt', alignSelf: 'flex-start', marginTop: 4 },
  section:     { marginBottom: 14 },
  sectionLabel:{ fontSize: 7, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  row:         { flexDirection: 'row', gap: 10, marginBottom: 8 },
  card:        { flex: 1, backgroundColor: '#f8fafc', borderRadius: 6, padding: '8pt 10pt', border: '0.5pt solid #e2e8f0' },
  cardLabel:   { fontSize: 7, color: '#94a3b8', marginBottom: 3 },
  cardValue:   { fontSize: 15, fontWeight: 700, color: '#0f172a' },
  cardSub:     { fontSize: 7, color: '#94a3b8', marginTop: 2 },
  body:        { fontSize: 8.5, color: '#475569', lineHeight: 1.6 },
  highlight:   { backgroundColor: '#eff6ff', borderRadius: 6, padding: '7pt 10pt', border: '0.5pt solid #bfdbfe' },
  highlightTxt:{ fontSize: 8, color: '#1d4ed8', lineHeight: 1.55 },
  amber:       { backgroundColor: '#fffbeb', borderRadius: 6, padding: '7pt 10pt', border: '0.5pt solid #fde68a' },
  amberTxt:    { fontSize: 8, color: '#92400e', lineHeight: 1.55 },
  divider:     { borderBottom: '0.5pt solid #e2e8f0', marginBottom: 12, marginTop: 4 },
  footer:      { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerTxt:   { fontSize: 7, color: '#94a3b8' },
  twoCol:      { flexDirection: 'row', gap: 14 },
  col:         { flex: 1 },
  flagTitle:   { fontSize: 8, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  flagBody:    { fontSize: 7.5, color: '#475569', lineHeight: 1.55 },
  bullet:      { width: 4, height: 4, borderRadius: 2, backgroundColor: '#0ea5e9', marginTop: 3, marginRight: 6, flexShrink: 0 },
  flagRow:     { flexDirection: 'row', marginBottom: 8 },
});

function fmt(n: number) { return n.toLocaleString(); }

export function AssessmentPDFDoc({ a }: { a: Assessment }) {
  const { roof, production, savings, cost, payback } = a;
  const hasDual = production.pvwattsAnnualKwh != null && production.googleAnnualKwh != null;
  const lo = hasDual ? Math.min(production.pvwattsAnnualKwh!, production.googleAnnualKwh!) : null;
  const hi = hasDual ? Math.max(production.pvwattsAnnualKwh!, production.googleAnnualKwh!) : null;

  return (
    <Document title={`Solar Assessment — ${a.address}`} author="Energy Advocate">
      <Page size="LETTER" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <Text style={S.title}>Solar Assessment</Text>
          <Text style={S.subtitle}>{a.address}</Text>
          <Text style={S.badge}>Generated {new Date(a.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
        </View>

        {/* System snapshot */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>System Overview</Text>
          <View style={S.row}>
            <View style={S.card}>
              <Text style={S.cardLabel}>Annual Output</Text>
              <Text style={S.cardValue}>{fmt(production.annualKwh)} kWh</Text>
              <Text style={S.cardSub}>estimated per year</Text>
            </View>
            <View style={S.card}>
              <Text style={S.cardLabel}>System Size</Text>
              <Text style={S.cardValue}>{production.systemCapacityKw} kW</Text>
              <Text style={S.cardSub}>DC nameplate</Text>
            </View>
            <View style={S.card}>
              <Text style={S.cardLabel}>Usable Roof</Text>
              <Text style={S.cardValue}>{fmt(roof.usableAreaSqFt)} sq ft</Text>
              <Text style={S.cardSub}>{roof.azimuthLabel} · {roof.pitchDegrees}° pitch</Text>
            </View>
            <View style={S.card}>
              <Text style={S.cardLabel}>Panels</Text>
              <Text style={S.cardValue}>{roof.estimatedPanelCount}</Text>
              <Text style={S.cardSub}>{production.panelCapacityWatts}W each</Text>
            </View>
          </View>
        </View>

        <View style={S.divider} />

        <View style={S.twoCol}>
          {/* Left column */}
          <View style={S.col}>
            {/* Production */}
            <View style={S.section}>
              <Text style={S.sectionLabel}>Production Estimate</Text>
              {hasDual ? (
                <>
                  <View style={S.row}>
                    <View style={[S.card, { borderColor: '#bfdbfe' }]}>
                      <Text style={S.cardLabel}>NREL PVWatts V8</Text>
                      <Text style={[S.cardValue, { color: '#1d4ed8', fontSize: 12 }]}>{fmt(production.pvwattsAnnualKwh!)} kWh/yr</Text>
                      <Text style={S.cardSub}>30-yr weather simulation</Text>
                    </View>
                    <View style={[S.card, { borderColor: '#a7f3d0' }]}>
                      <Text style={S.cardLabel}>Google Solar API</Text>
                      <Text style={[S.cardValue, { color: '#047857', fontSize: 12 }]}>{fmt(production.googleAnnualKwh!)} kWh/yr</Text>
                      <Text style={S.cardSub}>Satellite shadow model</Text>
                    </View>
                  </View>
                  {lo && hi && (
                    <Text style={S.body}>Planning range: {fmt(lo)}–{fmt(hi)} kWh/yr</Text>
                  )}
                </>
              ) : (
                <Text style={S.body}>{fmt(production.annualKwh)} kWh/yr estimated annual output.</Text>
              )}
            </View>

            {/* Savings */}
            <View style={S.section}>
              <Text style={S.sectionLabel}>Estimated Savings</Text>
              <View style={S.row}>
                <View style={S.card}>
                  <Text style={S.cardLabel}>Annual Savings</Text>
                  <Text style={[S.cardValue, { fontSize: 13 }]}>{formatCurrency(savings.annualSavings)}</Text>
                  <Text style={S.cardSub}>at {savings.utilityRatePerKwh.toFixed(3)}/kWh</Text>
                </View>
                <View style={S.card}>
                  <Text style={S.cardLabel}>Offset</Text>
                  <Text style={[S.cardValue, { fontSize: 13 }]}>{savings.offsetPercent}%</Text>
                  <Text style={S.cardSub}>of home usage</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right column */}
          <View style={S.col}>
            {/* Cost */}
            <View style={S.section}>
              <Text style={S.sectionLabel}>Install Cost Estimate</Text>
              <View style={S.card}>
                <Text style={S.cardLabel}>Cost Range (LBNL 2024 benchmark)</Text>
                <Text style={[S.cardValue, { fontSize: 13 }]}>{formatCurrency(cost.lowEstimate)}–{formatCurrency(cost.highEstimate)}</Text>
                <Text style={S.cardSub}>${cost.costPerWattLow}–${cost.costPerWattHigh}/W · {cost.systemCapacityKw} kW system</Text>
              </View>
            </View>

            {/* Payback */}
            <View style={S.section}>
              <Text style={S.sectionLabel}>Payback Range</Text>
              <View style={S.card}>
                <Text style={S.cardLabel}>No tax credit assumed</Text>
                <Text style={[S.cardValue, { fontSize: 13 }]}>{payback.lowYears}–{payback.highYears} years</Text>
                <Text style={S.cardSub}>System cost: {formatCurrency(payback.grossCost)}</Text>
              </View>
              <View style={[S.amber, { marginTop: 6 }]}>
                <Text style={S.amberTxt}>
                  No federal tax credit applies to homeowners purchasing solar panels under current law. For battery storage credits, verify current eligibility with a tax professional.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={S.divider} />

        {/* Key flags */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>What to Watch For</Text>
          <View style={S.twoCol}>
            {[
              { t: 'Get 3+ quotes', b: 'Installer pricing varies significantly. Always get at least three written quotes before signing.' },
              { t: 'Lease/PPA: the installer keeps the tax credits', b: 'The company claims the 30% federal ITC (Section 48E) plus any domestic content or energy community bonuses — not you. Read every escalator, termination fee, and home-sale clause before signing.' },
              { t: 'Verify net metering terms', b: 'Net metering policies change. Confirm your utility\'s current export rate before sizing the system.' },
              { t: 'Ask for a shade report', b: 'If trees or structures shade your roof, request a Solmetric SunEye analysis. 20 minutes of measurement can save years of underperformance.' },
            ].map(f => (
              <View key={f.t} style={[S.flagRow, { flex: 0.5, marginRight: 10 }]}>
                <View style={S.bullet} />
                <View>
                  <Text style={S.flagTitle}>{f.t}</Text>
                  <Text style={S.flagBody}>{f.b}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerTxt}>Energy Advocate · energyadvisor.app</Text>
          <Text style={S.footerTxt}>Data: NREL PVWatts V8 · Google Solar API · LBNL Tracking the Sun 2024</Text>
        </View>

      </Page>
    </Document>
  );
}

export default function DownloadPDFButton({ assessment }: { assessment: Assessment }) {
  const filename = `solar-assessment-${assessment.address.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)}.pdf`;
  const [instance] = usePDF({ document: <AssessmentPDFDoc a={assessment} /> });

  if (instance.loading) {
    return (
      <span className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-500 text-sm font-semibold rounded-lg cursor-wait">
        <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        Building…
      </span>
    );
  }

  if (instance.error || !instance.url) {
    return (
      <span className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 text-sm font-semibold rounded-lg" title={String(instance.error ?? 'PDF generation failed')}>
        PDF unavailable
      </span>
    );
  }

  return (
    <a
      href={instance.url}
      download={filename}
      className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Download Report
    </a>
  );
}
