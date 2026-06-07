import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/bigquery'
import { kpiQuery, type Filters, type KPIRow } from '@/lib/queries'
import { subDays, format, parseISO, differenceInDays } from 'date-fns'

function parseFilters(req: NextRequest): Filters {
  const s = req.nextUrl.searchParams
  return {
    since: s.get('since') ?? format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    until: s.get('until') ?? format(new Date(), 'yyyy-MM-dd'),
    source: s.get('source') ?? undefined,
    country: s.get('country') ?? undefined,
    campaign_objective: s.get('campaign_objective') ?? undefined,
    campaign_name: s.get('campaign_name') ?? undefined,
    adset_name: s.get('adset_name') ?? undefined,
    ad_name: s.get('ad_name') ?? undefined,
  }
}

function prevPeriod(f: Filters): Filters {
  const days = differenceInDays(parseISO(f.until), parseISO(f.since)) + 1
  return {
    ...f,
    since: format(subDays(parseISO(f.since), days), 'yyyy-MM-dd'),
    until: format(subDays(parseISO(f.until), days), 'yyyy-MM-dd'),
  }
}

function calcDelta(curr: KPIRow, prev: KPIRow): Record<string, string> {
  const metrics = ['roas', 'purchases', 'cpo', 'cr', 'ctr', 'cpc', 'cpm', 'revenue', 'spend'] as const
  const result: Record<string, string> = {}
  for (const m of metrics) {
    const c = curr[m as keyof KPIRow] as number | null
    const p = prev[m as keyof KPIRow] as number | null
    if (c == null || p == null || p === 0) {
      result[m] = '—'
    } else {
      const pct = ((c - p) / Math.abs(p)) * 100
      result[m] = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
    }
  }
  return result
}

function toNumber(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'object' && v !== null && 'value' in v
    ? parseFloat((v as { value: string }).value)
    : Number(v)
  return isNaN(n) ? null : n
}

function normalizeRow(raw: Record<string, unknown>): KPIRow {
  return {
    spend:       toNumber(raw.spend) ?? 0,
    impressions: toNumber(raw.impressions) ?? 0,
    clicks:      toNumber(raw.clicks) ?? 0,
    purchases:   toNumber(raw.purchases) ?? 0,
    revenue:     toNumber(raw.revenue) ?? 0,
    roas:        toNumber(raw.roas),
    cpo:         toNumber(raw.cpo),
    cr:          toNumber(raw.cr),
    ctr:         toNumber(raw.ctr),
    cpc:         toNumber(raw.cpc),
    cpm:         toNumber(raw.cpm),
  }
}

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req)
    const bq = getClient()
    const [[currRaw], [prevRaw]] = await Promise.all([
      bq.query({ query: kpiQuery(filters) }),
      bq.query({ query: kpiQuery(prevPeriod(filters)) }),
    ])
    const current = normalizeRow((currRaw[0] ?? {}) as Record<string, unknown>)
    const previous = normalizeRow((prevRaw[0] ?? {}) as Record<string, unknown>)
    return NextResponse.json({ current, previous, delta: calcDelta(current, previous) })
  } catch (err) {
    console.error('[/api/kpi]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
