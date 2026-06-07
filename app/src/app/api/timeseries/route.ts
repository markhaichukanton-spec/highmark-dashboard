import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/bigquery'
import { timeseriesQuery, type Filters, type Granularity } from '@/lib/queries'
import { subDays, format } from 'date-fns'

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

function toNumber(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'object' && v !== null && 'value' in v
    ? parseFloat((v as { value: string }).value)
    : Number(v)
  return isNaN(n) ? null : n
}

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req)
    const rawGranularity = (req.nextUrl.searchParams.get('granularity') ?? 'DAY').toUpperCase()
    const granularity = (['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'].includes(rawGranularity)
      ? rawGranularity
      : 'DAY') as Granularity

    const bq = getClient()
    const [rows] = await bq.query({ query: timeseriesQuery(filters, granularity) })

    const data = (rows as Record<string, unknown>[]).map((r) => ({
      period:    String(r.period instanceof Date ? format(r.period, 'yyyy-MM-dd') : (r.period as { value: string }).value ?? r.period),
      spend:     toNumber(r.spend) ?? 0,
      revenue:   toNumber(r.revenue) ?? 0,
      roas:      toNumber(r.roas),
      clicks:    toNumber(r.clicks) ?? 0,
      cpc:       toNumber(r.cpc),
      purchases: toNumber(r.purchases) ?? 0,
      cpo:       toNumber(r.cpo),
    }))

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/timeseries]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
