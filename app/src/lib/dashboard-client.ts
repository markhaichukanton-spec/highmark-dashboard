import { COLORS, METRIC_META, GEO_COLORS, fmt, type Colors, type MetricMeta } from './dashboard-config'

export interface RawPoint {
  spend: number
  revenue: number
  roas: number
  clicks: number
  purchases: number
  impressions: number
}

export interface DerivedPoint {
  spend: number
  revenue: number
  roas: number
  clicks: number
  purchases: number
  impressions: number
  cr: number
  ctr: number
  cpc: number
  cpm: number
  cpo: number
  aov: number
}

export interface SeriesPoint extends DerivedPoint {
  period: string
  label: string
}

export interface GeoPoint extends DerivedPoint {
  geo: string
}

export interface TreeNode extends DerivedPoint {
  campaign: string
  adset: string | null
  ad: string | null
  children?: TreeNode[]
}

export interface KPICardData {
  label: string
  seriesKey: string
  value: string
  delta: string
  up: boolean
  sub: string
}

export interface DashboardFilterOptions {
  Source: string[]
  GEO: string[]
  'Campaign Type': string[]
  Device: string[]
  Campaign: string[]
  Adset: string[]
  Ad: string[]
}

export interface DashboardData {
  KPIS: KPICardData[]
  SERIES: SeriesPoint[]
  GEO: GeoPoint[]
  TABLE: TreeNode[]
  FILTERS: DashboardFilterOptions
  COLORS: Colors
  METRIC_META: Record<string, MetricMeta>
  GEO_COLORS: string[]
}

export interface LoadParams {
  from: string
  to: string
  granularity?: string
  compare?: string
  filters?: Partial<DashboardFilterOptions>
}

export function withDerived(d: RawPoint): DerivedPoint {
  const clicks = d.clicks || 0
  const imp = d.impressions || 0
  const pur = d.purchases || 0
  return {
    ...d,
    cr:  clicks ? +((pur / clicks) * 100).toFixed(2)   : 0,
    ctr: imp    ? +((clicks / imp) * 100).toFixed(2)   : 0,
    cpc: clicks ? +(d.spend / clicks).toFixed(2)       : 0,
    cpm: imp    ? +((d.spend / imp) * 1000).toFixed(2) : 0,
    cpo: pur    ? +(d.spend / pur).toFixed(2)          : 0,
    aov: pur    ? +(d.revenue / pur).toFixed(2)        : 0,
  }
}

export function deriveTree(nodes: TreeNode[]): TreeNode[] {
  return (nodes || []).map((n) => ({
    ...withDerived(n as RawPoint),
    campaign: n.campaign,
    adset: n.adset,
    ad: n.ad,
    children: n.children ? deriveTree(n.children) : undefined,
  })) as TreeNode[]
}

function formatKpiValue(value: number, unit: string): string {
  switch (unit) {
    case 'ratio':     return fmt.ratio(value)
    case 'percent':   return fmt.percent(value)
    case 'currency':  return fmt.currency(value)
    case 'currency0': return fmt.currency0(value)
    case 'number':    return fmt.number(value)
    default:          return String(value)
  }
}

function adaptKpis(kpis: Array<{ label: string; seriesKey: string; value: number; unit: string; deltaPct: number; sub: string }>): KPICardData[] {
  return kpis.map((k) => ({
    label:     k.label,
    seriesKey: k.seriesKey,
    value:     formatKpiValue(k.value, k.unit),
    delta:     (k.deltaPct >= 0 ? '+' : '') + k.deltaPct.toFixed(1) + '%',
    up:        k.deltaPct >= 0,
    sub:       k.sub,
  }))
}

export function buildQuery({ from, to, granularity = 'day', compare = 'previous_period', filters = {} }: LoadParams): string {
  const q = new URLSearchParams({ from, to, granularity, compare })
  const keyMap: Record<string, string> = {
    Source: 'source', GEO: 'geo', 'Campaign Type': 'campaign_type',
    Device: 'device', Campaign: 'campaign', Adset: 'adset', Ad: 'ad',
  }
  for (const [key, values] of Object.entries(filters)) {
    const param = keyMap[key] ?? key.toLowerCase().replace(/\s+/g, '_')
    ;(values as string[] || []).forEach((v) => q.append(param, v))
  }
  return q.toString()
}

export function exportUrl(params: LoadParams): string {
  return '/api/export?' + buildQuery(params)
}

export async function loadDashboard(params: LoadParams): Promise<DashboardData> {
  const res = await fetch('/api/dashboard?' + buildQuery(params), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('dashboard fetch failed: ' + res.status)
  const api = await res.json()

  return {
    COLORS,
    METRIC_META,
    GEO_COLORS,
    KPIS:    adaptKpis(api.kpis),
    SERIES:  (api.series as SeriesPoint[]).map((p) => ({ ...withDerived(p as RawPoint), period: p.period, label: p.label })),
    GEO:     (api.geo as GeoPoint[]).map((g) => ({ ...withDerived(g as RawPoint), geo: g.geo })),
    TABLE:   deriveTree(api.table as TreeNode[]),
    FILTERS: api.filters,
  }
}
