import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/bigquery'
import {
  dashKpiQuery,
  dashSeriesQuery,
  dashGeoQuery,
  dashTableQuery,
  filtersQuery,
  buildTableTree,
  formatPeriodLabel,
  parseDashboardFilters,
  prevPeriodFilters,
  prevYearFilters,
  type DashboardFilters,
  type KPIRow,
  type Granularity,
} from '@/lib/queries'
import { format } from 'date-fns'

function toNum(v: unknown): number {
  if (v == null) return 0
  const n =
    typeof v === 'object' && v !== null && 'value' in v
      ? parseFloat((v as { value: string }).value)
      : Number(v)
  return isNaN(n) ? 0 : n
}

function toPeriod(v: unknown): string {
  if (v instanceof Date) return format(v, 'yyyy-MM-dd')
  if (typeof v === 'object' && v !== null && 'value' in v) return String((v as { value: string }).value)
  return String(v)
}

function normalizeKpi(raw: Record<string, unknown>): KPIRow {
  return {
    spend:       toNum(raw.spend),
    impressions: toNum(raw.impressions),
    clicks:      toNum(raw.clicks),
    purchases:   toNum(raw.purchases),
    revenue:     toNum(raw.revenue),
    roas:        toNum(raw.roas),
    cpo:         toNum(raw.cpo),
    cr:          toNum(raw.cr),
    ctr:         toNum(raw.ctr),
    cpc:         toNum(raw.cpc),
    cpm:         toNum(raw.cpm),
  }
}

function deltaPct(curr: number, prev: number): number {
  if (prev === 0) return 0
  return ((curr - prev) / Math.abs(prev)) * 100
}

const KPI_DEFS = [
  { seriesKey: 'roas',      label: 'ROAS',      unit: 'ratio',     sub: 'Return on ad spend',    get: (r: KPIRow) => r.roas ?? 0 },
  { seriesKey: 'purchases', label: 'Purchases', unit: 'number',    sub: 'Total conversions',      get: (r: KPIRow) => r.purchases },
  { seriesKey: 'revenue',   label: 'Revenue',   unit: 'currency0', sub: 'Meta attributed',        get: (r: KPIRow) => r.revenue },
  { seriesKey: 'spend',     label: 'Spend',     unit: 'currency0', sub: 'Total ad spend',         get: (r: KPIRow) => r.spend },
  { seriesKey: 'cpm',       label: 'CPM',       unit: 'currency',  sub: 'Cost per mille',         get: (r: KPIRow) => r.cpm ?? 0 },
  { seriesKey: 'ctr',       label: 'CTR',       unit: 'percent',   sub: 'Click-through rate',     get: (r: KPIRow) => r.ctr ?? 0 },
  { seriesKey: 'cr',        label: 'CR',        unit: 'percent',   sub: 'Conversion rate',        get: (r: KPIRow) => r.cr ?? 0 },
  { seriesKey: 'aov',       label: 'AOV',       unit: 'currency',  sub: 'Avg. order value',       get: (r: KPIRow) => r.purchases > 0 ? r.revenue / r.purchases : 0 },
  { seriesKey: 'cpo',       label: 'CPO',       unit: 'currency',  sub: 'Cost per order',         get: (r: KPIRow) => r.cpo ?? 0 },
  { seriesKey: 'cpc',       label: 'CPC',       unit: 'currency',  sub: 'Cost per click',         get: (r: KPIRow) => r.cpc ?? 0 },
] as const

export async function GET(req: NextRequest) {
  try {
    const filters: DashboardFilters = parseDashboardFilters(req.nextUrl.searchParams)
    const rawGran = (req.nextUrl.searchParams.get('granularity') ?? 'day').toUpperCase()
    const granularity = (['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'].includes(rawGran)
      ? rawGran : 'DAY') as Granularity
    const compare = req.nextUrl.searchParams.get('compare') ?? 'previous_period'

    const bq = getClient()

    const compareFilters =
      compare === 'previous_year' ? prevYearFilters(filters) :
      compare === 'none'          ? null :
      prevPeriodFilters(filters)

    const [
      [kpiRows],
      [kpiPrevRows],
      [seriesRows],
      [geoRows],
      [tableRows],
      [filterRows],
    ] = await Promise.all([
      bq.query({ query: dashKpiQuery(filters) }),
      compareFilters
        ? bq.query({ query: dashKpiQuery(compareFilters) })
        : Promise.resolve([[{}]]),
      bq.query({ query: dashSeriesQuery(filters, granularity) }),
      bq.query({ query: dashGeoQuery(filters) }),
      bq.query({ query: dashTableQuery(filters) }),
      bq.query({ query: filtersQuery() }),
    ])

    const curr = normalizeKpi((kpiRows[0] ?? {}) as Record<string, unknown>)
    const prev = normalizeKpi((kpiPrevRows[0] ?? {}) as Record<string, unknown>)

    const kpis = KPI_DEFS.map((def) => {
      const currVal = def.get(curr)
      const prevVal = def.get(prev)
      return {
        label:     def.label,
        seriesKey: def.seriesKey,
        value:     currVal,
        unit:      def.unit,
        deltaPct:  compareFilters ? deltaPct(currVal, prevVal) : 0,
        sub:       def.sub,
      }
    })

    const series = (seriesRows as Record<string, unknown>[]).map((r) => {
      const period = toPeriod(r.period)
      return {
        period,
        label:       formatPeriodLabel(period, granularity),
        spend:       toNum(r.spend),
        revenue:     toNum(r.revenue),
        roas:        toNum(r.roas),
        clicks:      toNum(r.clicks),
        purchases:   toNum(r.purchases),
        impressions: toNum(r.impressions),
      }
    })

    const geo = (geoRows as Record<string, unknown>[]).map((r) => ({
      geo:         String(r.geo ?? ''),
      spend:       toNum(r.spend),
      revenue:     toNum(r.revenue),
      roas:        toNum(r.roas),
      purchases:   toNum(r.purchases),
      clicks:      toNum(r.clicks),
      impressions: toNum(r.impressions),
    }))

    const flatTable = (tableRows as Record<string, unknown>[]).map((r) => ({
      campaign_name: String(r.campaign_name ?? ''),
      adset_name:    r.adset_name ? String(r.adset_name) : null,
      ad_name:       r.ad_name ? String(r.ad_name) : null,
      spend:         toNum(r.spend),
      impressions:   toNum(r.impressions),
      clicks:        toNum(r.clicks),
      purchases:     toNum(r.purchases),
      revenue:       toNum(r.revenue),
    }))

    const table = buildTableTree(flatTable)

    const fr = (filterRows[0] ?? {}) as Record<string, string[]>
    const filtersResp = {
      Source:          ['All sources',   ...(fr.sources    ?? [])],
      GEO:             ['All GEOs',      ...(fr.countries  ?? [])],
      'Campaign Type': ['All types',     ...(fr.objectives ?? [])],
      Device:          ['All devices'],
      Campaign:        ['All campaigns', ...(fr.campaigns  ?? [])],
      Adset:           ['All adsets',    ...(fr.adsets     ?? [])],
      Ad:              ['All ads',       ...(fr.ads        ?? [])],
    }

    return NextResponse.json({ kpis, series, geo, table, filters: filtersResp })
  } catch (err) {
    console.error('[/api/dashboard]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
