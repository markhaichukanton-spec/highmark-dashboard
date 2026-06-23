/* dash-data.jsx — mock data + formatters for the Aurora Scents dashboard.
   Exports to window: DATA, fmt, COLORS */

const COLORS = {
  bg: '#F4F0E6', paper: '#FFFFFF', cream: '#EDE6D2', ink: '#15131A',
  gold: '#C9A84C', goldDeep: '#8E6F3E', muted: '#6B6E7A',
  blue: '#5B8DEF', violet: '#7A6ECC',
  line: 'rgba(20,18,30,0.10)', line2: 'rgba(20,18,30,0.16)',
  goodBg: '#ECFDF0', goodInk: '#15803D', badBg: '#FEF2F2', badInk: '#B91C1C',
};

// ── formatters ──────────────────────────────────────────────
const dh2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dh0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-US');

const fmt = {
  currency: (v) => dh2.format(v) + ' dh',
  currency0: (v) => dh0.format(v) + ' dh',
  number: (v) => num.format(v),
  ratio: (v) => v.toFixed(2),
  percent: (v) => v.toFixed(1) + '%',
  compact: (v) => {
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
    return String(v);
  },
};

// ── KPI block (current + deltas) ────────────────────────────
const KPIS = [
  { label: 'ROAS',      seriesKey: 'roas',      value: '272.44%',   delta: '+28.1%', up: true,  sub: 'Return on ad spend' },
  { label: 'Purchases', seriesKey: 'purchases', value: '123',       delta: '+0.8%',  up: true,  sub: 'Total conversions' },
  { label: 'Revenue',   seriesKey: 'revenue',   value: '39.3K',     delta: '-1.2%',  up: false, sub: 'Meta attributed' },
  { label: 'Spend',     seriesKey: 'spend',     value: '14.4K',     delta: '-22.9%', up: false, sub: 'Total ad spend' },
  { label: 'CPM',       seriesKey: 'cpm',       value: '12.55 dh',  delta: '-20.6%', up: false, sub: 'Cost per mille' },
  { label: 'CTR',       seriesKey: 'ctr',       value: '1.05%',     delta: '-8.6%',  up: false, sub: 'Click-through rate' },
  { label: 'CR',        seriesKey: 'cr',        value: '1.02%',     delta: '+13.5%', up: true,  sub: 'Conversion rate' },
  { label: 'AOV',       seriesKey: 'aov',       value: '319.27',    delta: '-2.0%',  up: false, sub: 'Avg. order value' },
  { label: 'CPO',       seriesKey: 'cpo',       value: '117.19 dh', delta: '-23.5%', up: false, sub: 'Cost per order' },
  { label: 'CPC',       seriesKey: 'cpc',       value: '1.19 dh',   delta: '-13.1%', up: false, sub: 'Cost per click' },
];

// ── timeseries (last 7 days) ────────────────────────────────
const SERIES_RAW = [
  { period: '2026-05-26', label: 'May 26', spend: 2200, revenue: 5720, roas: 2.60, clicks: 1850, purchases: 18, impressions: 176000 },
  { period: '2026-05-27', label: 'May 27', spend: 2000, revenue: 5600, roas: 2.80, clicks: 1680, purchases: 17, impressions: 160000 },
  { period: '2026-05-28', label: 'May 28', spend: 1800, revenue: 4500, roas: 2.50, clicks: 1510, purchases: 14, impressions: 144000 },
  { period: '2026-05-29', label: 'May 29', spend: 2300, revenue: 6670, roas: 2.90, clicks: 1930, purchases: 21, impressions: 184000 },
  { period: '2026-05-30', label: 'May 30', spend: 2050, revenue: 5535, roas: 2.70, clicks: 1720, purchases: 18, impressions: 164000 },
  { period: '2026-05-31', label: 'May 31', spend: 2400, revenue: 7200, roas: 3.00, clicks: 2010, purchases: 22, impressions: 192000 },
  { period: '2026-06-01', label: 'Jun 01', spend: 1650, revenue: 4075, roas: 2.47, clicks: 1400, purchases: 13, impressions: 132000 },
];
// derive cr / ctr / cpc / cpm / cpo so every KPI is plottable
const SERIES = SERIES_RAW.map((d) => ({
  ...d,
  cr:  +((d.purchases / d.clicks) * 100).toFixed(2),
  ctr: +((d.clicks / d.impressions) * 100).toFixed(2),
  cpc: +(d.spend / d.clicks).toFixed(2),
  cpm: +((d.spend / d.impressions) * 1000).toFixed(2),
  cpo: d.purchases ? +(d.spend / d.purchases).toFixed(2) : 0,
  aov: d.purchases ? +(d.revenue / d.purchases).toFixed(2) : 0,
}));

// ── metric metadata: drives KPI↔chart selection, axis, color, format ──
// bars: Purchases, Revenue, Spend  ·  lines: ROAS, CPM, CTR, CR, AOV, CPO, CPC
const METRIC_META = {
  roas:      { key: 'roas',      label: 'ROAS',      axis: 'right', type: 'line', color: '#C9A84C', fmt: (v) => fmt.ratio(v),    short: (v) => v.toFixed(2) },
  revenue:   { key: 'revenue',   label: 'Revenue',   axis: 'left',  type: 'bar',  color: '#5B8DEF', fmt: (v) => fmt.currency0(v), short: (v) => fmt.compact(v) },
  spend:     { key: 'spend',     label: 'Spend',     axis: 'left',  type: 'bar',  color: '#7A6ECC', fmt: (v) => fmt.currency0(v), short: (v) => fmt.compact(v) },
  purchases: { key: 'purchases', label: 'Purchases', axis: 'left',  type: 'bar',  color: '#2F9E6A', fmt: (v) => fmt.number(v),    short: (v) => fmt.number(v) },
  cpo:       { key: 'cpo',       label: 'CPO',       axis: 'right', type: 'line', color: '#C2703D', fmt: (v) => fmt.currency(v),  short: (v) => v.toFixed(0) },
  cr:        { key: 'cr',        label: 'CR',        axis: 'right', type: 'line', color: '#4FA6C4', fmt: (v) => fmt.percent(v),   short: (v) => v.toFixed(2) + '%' },
  ctr:       { key: 'ctr',       label: 'CTR',       axis: 'right', type: 'line', color: '#8E6F3E', fmt: (v) => fmt.percent(v),   short: (v) => v.toFixed(2) + '%' },
  cpc:       { key: 'cpc',       label: 'CPC',       axis: 'right', type: 'line', color: '#B0589C', fmt: (v) => fmt.currency(v),  short: (v) => v.toFixed(2) },
  cpm:       { key: 'cpm',       label: 'CPM',       axis: 'right', type: 'line', color: '#6B7280', fmt: (v) => fmt.currency(v),  short: (v) => v.toFixed(1) },
  aov:       { key: 'aov',       label: 'AOV',       axis: 'right', type: 'line', color: '#B5832E', fmt: (v) => fmt.currency(v),  short: (v) => v.toFixed(0) },
};

// ── GEO breakdown (drives the donut) ────────────────────────
const GEO_RAW = [
  { geo: 'UAE',     spend: 1800, revenue: 6840, roas: 3.8, purchases: 52, clicks: 19800, impressions: 1085000 },
  { geo: 'Saudi',   spend: 620,  revenue: 1364, roas: 2.2, purchases: 14, clicks: 8900,  impressions: 612000 },
  { geo: 'Kuwait',  spend: 540,  revenue: 1782, roas: 3.3, purchases: 16, clicks: 5200,  impressions: 300000 },
  { geo: 'Qatar',   spend: 410,  revenue: 1230, roas: 3.0, purchases: 11, clicks: 3800,  impressions: 228000 },
  { geo: 'Nigeria', spend: 290,  revenue: 0,    roas: 0.0, purchases: 0,  clicks: 4100,  impressions: 388000 },
];
const GEO = GEO_RAW.map((d) => ({
  ...d,
  cr:  +((d.purchases / d.clicks) * 100).toFixed(2),
  ctr: +((d.clicks / d.impressions) * 100).toFixed(2),
  cpc: +(d.spend / d.clicks).toFixed(2),
  cpm: +((d.spend / d.impressions) * 1000).toFixed(2),
  cpo: d.purchases ? +(d.spend / d.purchases).toFixed(2) : 0,
  aov: d.purchases ? +(d.revenue / d.purchases).toFixed(2) : 0,
}));
const GEO_COLORS = ['#C9A84C', '#5B8DEF', '#7A6ECC', '#2F9E6A', '#8E6F3E'];

// ── per-GEO daily series (drives the GEO line chart) ────────
// Distribute each GEO's known metric total across the 7 days following the
// overall daily shape, with a small deterministic per-GEO wobble, then
// renormalise each GEO column so its 7-day sum equals the known total —
// keeps the line chart self-consistent with the GEO breakdown above.
const GEO_SERIES = (function () {
  const out = {};
  ['revenue', 'spend', 'purchases'].forEach((metric) => {
    const dayTotals = SERIES.map((d) => d[metric]);
    const daySum = dayTotals.reduce((a, b) => a + b, 0) || 1;
    const dayShare = dayTotals.map((v) => v / daySum);
    const active = GEO.filter((g) => g[metric] > 0);
    const rows = SERIES.map((d, di) => {
      const point = { label: d.label };
      active.forEach((g, gi) => {
        const wobble = 1 + 0.22 * Math.sin(di * 1.25 + gi * 1.7);
        point[g.geo] = g[metric] * dayShare[di] * wobble;
      });
      return point;
    });
    active.forEach((g) => {
      const colSum = rows.reduce((a, r) => a + r[g.geo], 0) || 1;
      const scale = g[metric] / colSum;
      rows.forEach((r) => { r[g.geo] = Math.round(r[g.geo] * scale); });
    });
    out[metric] = rows;
  });
  return out;
})();

// ── drill-down table: Campaign → Adset → Ad ─────────────────
// helper to derive cr/ctr/cpc/cpm/impressions consistently
function row(campaign, adset, ad, { spend, revenue, roas, purchases, clicks, impressions }) {
  const cr = clicks ? (purchases / clicks) * 100 : 0;
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const cpc = clicks ? spend / clicks : 0;
  const cpm = impressions ? (spend / impressions) * 1000 : 0;
  const cpo = purchases ? spend / purchases : 0;
  return { campaign, adset, ad, spend, revenue, roas, purchases, cr, ctr, cpc, cpm, cpo, clicks, impressions };
}

const TABLE = [
  {
    ...row('UAE | ROAS | Sales', null, null, { spend: 1800, revenue: 6840, roas: 3.8, purchases: 52, clicks: 19800, impressions: 1085000 }),
    children: [
      {
        ...row('UAE | ROAS | Sales', 'AS — Women 25–44 · Dubai', null, { spend: 1120, revenue: 4480, roas: 4.0, purchases: 33, clicks: 12400, impressions: 642000 }),
        children: [
          row('UAE | ROAS | Sales', 'AS — Women 25–44 · Dubai', 'Oud Royale — Carousel', { spend: 640, revenue: 2688, roas: 4.2, purchases: 20, clicks: 7300, impressions: 358000 }),
          row('UAE | ROAS | Sales', 'AS — Women 25–44 · Dubai', 'Rose Absolu — Reel 15s', { spend: 480, revenue: 1792, roas: 3.73, purchases: 13, clicks: 5100, impressions: 284000 }),
        ],
      },
      {
        ...row('UAE | ROAS | Sales', 'AS — Lookalike 2% · Purchasers', null, { spend: 680, revenue: 2360, roas: 3.47, purchases: 19, clicks: 7400, impressions: 443000 }),
        children: [
          row('UAE | ROAS | Sales', 'AS — Lookalike 2% · Purchasers', 'Signature Set — Static', { spend: 680, revenue: 2360, roas: 3.47, purchases: 19, clicks: 7400, impressions: 443000 }),
        ],
      },
    ],
  },
  {
    ...row('KSA | Prospecting', null, null, { spend: 620, revenue: 1364, roas: 2.2, purchases: 14, clicks: 8900, impressions: 612000 }),
    children: [
      {
        ...row('KSA | Prospecting', 'AS — Broad · 18–34', null, { spend: 620, revenue: 1364, roas: 2.2, purchases: 14, clicks: 8900, impressions: 612000 }),
        children: [
          row('KSA | Prospecting', 'AS — Broad · 18–34', 'Discovery Bundle — Reel', { spend: 360, revenue: 792, roas: 2.2, purchases: 8, clicks: 5200, impressions: 358000 }),
          row('KSA | Prospecting', 'AS — Broad · 18–34', 'Best Sellers — Carousel', { spend: 260, revenue: 572, roas: 2.2, purchases: 6, clicks: 3700, impressions: 254000 }),
        ],
      },
    ],
  },
  {
    ...row('Nigeria | Top Funnel', null, null, { spend: 290, revenue: 0, roas: 0.0, purchases: 0, clicks: 4100, impressions: 388000 }),
    children: [
      {
        ...row('Nigeria | Top Funnel', 'AS — Awareness · Lagos', null, { spend: 290, revenue: 0, roas: 0.0, purchases: 0, clicks: 4100, impressions: 388000 }),
        children: [
          row('Nigeria | Top Funnel', 'AS — Awareness · Lagos', 'Brand Film 30s — Reel', { spend: 290, revenue: 0, roas: 0.0, purchases: 0, clicks: 4100, impressions: 388000 }),
        ],
      },
    ],
  },
];

// ── filter options ──────────────────────────────────────────
const FILTERS = {
  Source: ['All sources', 'Meta', 'Instagram', 'Facebook', 'Audience Network'],
  GEO: ['All GEOs', 'United Arab Emirates', 'Saudi Arabia', 'Nigeria', 'Kuwait', 'Qatar'],
  'Campaign Type': ['All types', 'Sales', 'Prospecting', 'Top Funnel', 'Retargeting'],
  Device: ['All devices', 'Mobile', 'Desktop', 'Tablet'],
  Campaign: ['All campaigns', 'UAE | ROAS | Sales', 'KSA | Prospecting', 'Nigeria | Top Funnel'],
  Adset: ['All adsets', 'Women 25–44 · Dubai', 'Lookalike 2% · Purchasers', 'Broad · 18–34', 'Awareness · Lagos'],
  Ad: ['All ads', 'Oud Royale — Carousel', 'Rose Absolu — Reel 15s', 'Signature Set — Static', 'Brand Film 30s — Reel'],
};

const DATA = { COLORS, KPIS, SERIES, TABLE, FILTERS, METRIC_META, GEO, GEO_COLORS, GEO_SERIES };
Object.assign(window, { DATA, fmt, COLORS });
