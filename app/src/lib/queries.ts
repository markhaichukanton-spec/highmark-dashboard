import { TABLE } from './bigquery'

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
  cpc: number | null
  purchases: number
  cpo: number | null
}

export interface TableRow {
  campaign_name: string
  adset_name: string | null
  ad_name: string | null
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

export interface FilterOptions {
  sources: string[]
  countries: string[]
  objectives: string[]
  campaigns: string[]
  adsets: string[]
  ads: string[]
}

function buildWhere(f: Filters): string {
  const clauses: string[] = [`date BETWEEN '${f.since}' AND '${f.until}'`]
  if (f.source) clauses.push(`source = '${f.source}'`)
  if (f.country) clauses.push(`country = '${f.country}'`)
  if (f.campaign_objective) clauses.push(`campaign_objective = '${f.campaign_objective}'`)
  if (f.campaign_name) clauses.push(`campaign_name = '${f.campaign_name}'`)
  if (f.adset_name) clauses.push(`adset_name = '${f.adset_name}'`)
  if (f.ad_name) clauses.push(`ad_name = '${f.ad_name}'`)
  return clauses.join(' AND ')
}

const METRICS = `
  CAST(SUM(spend) AS FLOAT64)       AS spend,
  SUM(impressions)                   AS impressions,
  SUM(clicks)                        AS clicks,
  SUM(purchases)                     AS purchases,
  CAST(SUM(revenue) AS FLOAT64)     AS revenue,
  SAFE_DIVIDE(SUM(revenue), SUM(spend))                     AS roas,
  SAFE_DIVIDE(SUM(spend), SUM(purchases))                   AS cpo,
  SAFE_DIVIDE(SUM(purchases), SUM(clicks))                  AS cr,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions))                AS ctr,
  SAFE_DIVIDE(SUM(spend), SUM(clicks))                      AS cpc,
  SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000          AS cpm`

export function kpiQuery(f: Filters): string {
  return `SELECT ${METRICS} FROM ${TABLE} WHERE ${buildWhere(f)}`
}

export function timeseriesQuery(f: Filters, granularity: Granularity): string {
  return `
    SELECT
      DATE_TRUNC(date, ${granularity}) AS period,
      ${METRICS}
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
      ${METRICS}
    FROM ${TABLE}
    WHERE ${buildWhere(f)}
    GROUP BY campaign_name, adset_name, ad_name
    ORDER BY spend DESC`
}

export function filtersQuery(): string {
  return `
    SELECT
      ARRAY_AGG(DISTINCT source       IGNORE NULLS ORDER BY source)               AS sources,
      ARRAY_AGG(DISTINCT country      IGNORE NULLS ORDER BY country)              AS countries,
      ARRAY_AGG(DISTINCT campaign_objective IGNORE NULLS ORDER BY campaign_objective) AS objectives,
      ARRAY_AGG(DISTINCT campaign_name IGNORE NULLS ORDER BY campaign_name)       AS campaigns,
      ARRAY_AGG(DISTINCT adset_name   IGNORE NULLS ORDER BY adset_name)          AS adsets,
      ARRAY_AGG(DISTINCT ad_name      IGNORE NULLS ORDER BY ad_name)             AS ads
    FROM ${TABLE}`
}
