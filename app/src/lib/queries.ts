import { TABLE } from './bigquery'
import { format, parseISO, subDays, subYears, differenceInDays } from 'date-fns'

export interface Filters {
  since: string
  until: string
  source?: string
  country?: string
  campaign_objective?: string
  campaign_name?: string
  adset_name?: string
  ad_name?: string
}

export interface DashboardFilters {
  since: string
  until: string
  source?: string[]
  geo?: string[]
  campaign_type?: string[]
  campaign?: string[]
  adset?: string[]
  ad?: string[]
}

export type Granularity = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'

export interface KPIRow {
  spend: number
  impressions: number
  clicks: number
  purchases: number
  revenue: number
  roas: number | null
  cpo: number | null
  cr: number | null
  ctr: number | null
  cpc: number | null
  cpm: number | null
}

export interface TimeseriesRow {
  period: string
  spend: number
  revenue: number
  roas: number | null
  clicks: number
  purchases: number
  impressions: number
}

export interface FlatTableRow {
  campaign_name: string
  adset_name: string | null
  ad_name: string | null
  spend: number
  impressions: number
  clicks: number
  purchases: number
  revenue: number
}

export interface TreeNode {
  campaign: string
  adset: string | null
  ad: string | null
  spend: number
  impressions: number
  clicks: number
  purchases: number
  revenue: number
  roas: number
  children?: TreeNode[]
}

export interface FilterOptions {
  sources: string[]
  countries: string[]
  objectives: string[]
  campaigns: string[]
  adsets: string[]
  ads: string[]
}

function sanitize(v: string): string {
  return v.replace(/'/g, "''")
}

function buildWhere(f: Filters): string {
  const clauses: string[] = [`date BETWEEN '${f.since}' AND '${f.until}'`]
  if (f.source) clauses.push(`source = '${sanitize(f.source)}'`)
  if (f.country) clauses.push(`country = '${sanitize(f.country)}'`)
  if (f.campaign_objective) clauses.push(`campaign_objective = '${sanitize(f.campaign_objective)}'`)
  if (f.campaign_name) clauses.push(`campaign_name = '${sanitize(f.campaign_name)}'`)
  if (f.adset_name) clauses.push(`adset_name = '${sanitize(f.adset_name)}'`)
  if (f.ad_name) clauses.push(`ad_name = '${sanitize(f.ad_name)}'`)
  return clauses.join(' AND ')
}

function buildDashWhere(f: DashboardFilters): string {
  const clauses: string[] = [`date BETWEEN '${sanitize(f.since)}' AND '${sanitize(f.until)}'`]
  const addIn = (field: string, values?: string[]) => {
    if (!values || values.length === 0) return
    const escaped = values.map((v) => `'${sanitize(v)}'`).join(', ')
    clauses.push(`${field} IN (${escaped})`)
  }
  addIn('source', f.source)
  addIn('country', f.geo)
  addIn('campaign_objective', f.campaign_type)
  addIn('campaign_name', f.campaign)
  addIn('adset_name', f.adset)
  addIn('ad_name', f.ad)
  return clauses.join(' AND ')
}

const FULL_METRICS = `
  CAST(SUM(spend) AS FLOAT64)                              AS spend,
  SUM(impressions)                                          AS impressions,
  SUM(clicks)                                              AS clicks,
  SUM(purchases)                                           AS purchases,
  CAST(SUM(revenue) AS FLOAT64)                           AS revenue,
  SAFE_DIVIDE(SUM(revenue), SUM(spend))                   AS roas,
  SAFE_DIVIDE(SUM(spend), SUM(purchases))                 AS cpo,
  SAFE_DIVIDE(SUM(purchases), SUM(clicks)) * 100          AS cr,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100        AS ctr,
  SAFE_DIVIDE(SUM(spend), SUM(clicks))                    AS cpc,
  SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000        AS cpm`

const RAW_METRICS = `
  CAST(SUM(spend) AS FLOAT64)    AS spend,
  SUM(impressions)                AS impressions,
  SUM(clicks)                    AS clicks,
  SUM(purchases)                 AS purchases,
  CAST(SUM(revenue) AS FLOAT64)  AS revenue,
  SAFE_DIVIDE(SUM(revenue), SUM(spend)) AS roas`

// ── existing API routes ──────────────────────────────────────

export function kpiQuery(f: Filters): string {
  return `SELECT ${FULL_METRICS} FROM ${TABLE} WHERE ${buildWhere(f)}`
}

export function timeseriesQuery(f: Filters, granularity: Granularity): string {
  return `
    SELECT
      DATE_TRUNC(date, ${granularity}) AS period,
      ${FULL_METRICS}
    FROM ${TABLE}
    WHERE ${buildWhere(f)}
    GROUP BY period
    ORDER BY period`
}

export function tableQuery(f: Filters): string {
  return `
    SELECT
      campaign_name,
      adset_name,
      ad_name,
      ${FULL_METRICS}
    FROM ${TABLE}
    WHERE ${buildWhere(f)}
    GROUP BY campaign_name, adset_name, ad_name
    ORDER BY spend DESC`
}

export function filtersQuery(): string {
  return `
    SELECT
      ARRAY_AGG(DISTINCT source            IGNORE NULLS ORDER BY source)            AS sources,
      ARRAY_AGG(DISTINCT country           IGNORE NULLS ORDER BY country)           AS countries,
      ARRAY_AGG(DISTINCT campaign_objective IGNORE NULLS ORDER BY campaign_objective) AS objectives,
      ARRAY_AGG(DISTINCT campaign_name     IGNORE NULLS ORDER BY campaign_name)     AS campaigns,
      ARRAY_AGG(DISTINCT adset_name        IGNORE NULLS ORDER BY adset_name)        AS adsets,
      ARRAY_AGG(DISTINCT ad_name           IGNORE NULLS ORDER BY ad_name)           AS ads
    FROM ${TABLE}`
}

// ── /api/dashboard queries ───────────────────────────────────

export function dashKpiQuery(f: DashboardFilters): string {
  return `SELECT ${FULL_METRICS} FROM ${TABLE} WHERE ${buildDashWhere(f)}`
}

export function dashSeriesQuery(f: DashboardFilters, granularity: Granularity): string {
  return `
    SELECT
      DATE_TRUNC(date, ${granularity}) AS period,
      ${RAW_METRICS}
    FROM ${TABLE}
    WHERE ${buildDashWhere(f)}
    GROUP BY period
    ORDER BY period`
}

export function dashGeoQuery(f: DashboardFilters): string {
  // The GEO breakdown is a facet selector — it must NOT filter itself by `geo`,
  // otherwise picking a country collapses the chart to that single bar and you
  // can't toggle others. All OTHER filters still apply.
  const { geo: _omitGeo, ...rest } = f
  return `
    SELECT
      country AS geo,
      ${RAW_METRICS}
    FROM ${TABLE}
    WHERE ${buildDashWhere(rest as DashboardFilters)}
    GROUP BY country
    ORDER BY spend DESC`
}

export function dashTableQuery(f: DashboardFilters): string {
  return `
    SELECT
      campaign_name,
      adset_name,
      ad_name,
      CAST(SUM(spend) AS FLOAT64)   AS spend,
      SUM(impressions)               AS impressions,
      SUM(clicks)                   AS clicks,
      SUM(purchases)                AS purchases,
      CAST(SUM(revenue) AS FLOAT64) AS revenue
    FROM ${TABLE}
    WHERE ${buildDashWhere(f)}
    GROUP BY campaign_name, adset_name, ad_name
    ORDER BY spend DESC`
}

export function exportQuery(f: DashboardFilters): string {
  return `
    SELECT
      date,
      source,
      account_id,
      country AS geo,
      campaign_id,
      campaign_name,
      campaign_objective,
      adset_id,
      adset_name,
      ad_id,
      ad_name,
      impressions,
      clicks,
      CAST(spend AS FLOAT64)   AS spend,
      purchases,
      CAST(revenue AS FLOAT64) AS revenue,
      reach
    FROM ${TABLE}
    WHERE ${buildDashWhere(f)}
    ORDER BY date, spend DESC`
}

// ── shared request parsing ───────────────────────────────────

export function parseDashboardFilters(s: URLSearchParams): DashboardFilters {
  const getAll = (k: string) => {
    const vals = s.getAll(k).filter(Boolean)
    return vals.length > 0 ? vals : undefined
  }
  return {
    since: s.get('from') ?? format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    until: s.get('to')   ?? format(new Date(), 'yyyy-MM-dd'),
    source:        getAll('source'),
    geo:           getAll('geo'),
    campaign_type: getAll('campaign_type'),
    campaign:      getAll('campaign'),
    adset:         getAll('adset'),
    ad:            getAll('ad'),
  }
}

// ── period helpers ───────────────────────────────────────────

export function prevPeriodFilters(f: DashboardFilters): DashboardFilters {
  const days = differenceInDays(parseISO(f.until), parseISO(f.since)) + 1
  return {
    ...f,
    since: format(subDays(parseISO(f.since), days), 'yyyy-MM-dd'),
    until: format(subDays(parseISO(f.until), days), 'yyyy-MM-dd'),
  }
}

export function prevYearFilters(f: DashboardFilters): DashboardFilters {
  return {
    ...f,
    since: format(subYears(parseISO(f.since), 1), 'yyyy-MM-dd'),
    until: format(subYears(parseISO(f.until), 1), 'yyyy-MM-dd'),
  }
}

// ── tree builder ─────────────────────────────────────────────

interface Sums { spend: number; impressions: number; clicks: number; purchases: number; revenue: number }

function zeros(): Sums {
  return { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 }
}

function addSums(s: Sums, r: FlatTableRow): void {
  s.spend += r.spend
  s.impressions += r.impressions
  s.clicks += r.clicks
  s.purchases += r.purchases
  s.revenue += r.revenue
}

function roas(s: Sums): number {
  return s.spend > 0 ? s.revenue / s.spend : 0
}

export function buildTableTree(flatRows: FlatTableRow[]): TreeNode[] {
  type AdsetEntry = { sums: Sums; ads: FlatTableRow[] }
  type CampEntry = { sums: Sums; adsets: Map<string, AdsetEntry> }

  const campaignMap = new Map<string, CampEntry>()

  for (const row of flatRows) {
    const cn = row.campaign_name || ''
    const an = row.adset_name || ''

    if (!campaignMap.has(cn)) {
      campaignMap.set(cn, { sums: zeros(), adsets: new Map() })
    }
    const camp = campaignMap.get(cn)!
    addSums(camp.sums, row)

    if (!camp.adsets.has(an)) {
      camp.adsets.set(an, { sums: zeros(), ads: [] })
    }
    const adset = camp.adsets.get(an)!
    addSums(adset.sums, row)
    adset.ads.push(row)
  }

  return [...campaignMap.entries()].map(([cn, cd]) => ({
    campaign: cn,
    adset: null,
    ad: null,
    ...cd.sums,
    roas: roas(cd.sums),
    children: [...cd.adsets.entries()].map(([an, ad]) => ({
      campaign: cn,
      adset: an,
      ad: null,
      ...ad.sums,
      roas: roas(ad.sums),
      children: ad.ads.map((r) => ({
        campaign: cn,
        adset: an,
        ad: r.ad_name,
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
        purchases: r.purchases,
        revenue: r.revenue,
        roas: r.spend > 0 ? r.revenue / r.spend : 0,
      })),
    })),
  }))
}

// ── period label formatter ───────────────────────────────────

export function formatPeriodLabel(period: string, granularity: Granularity): string {
  try {
    const d = parseISO(period)
    switch (granularity) {
      case 'DAY':     return format(d, 'MMM d')
      case 'WEEK':    return format(d, 'MMM d')
      case 'MONTH':   return format(d, 'MMM yyyy')
      case 'QUARTER': return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`
      case 'YEAR':    return String(d.getFullYear())
    }
  } catch {
    return period
  }
}
