import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/bigquery'
import { tableQuery, type Filters } from '@/lib/queries'
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
    const bq = getClient()
    const [rows] = await bq.query({ query: tableQuery(filters) })

    const data = (rows as Record<string, unknown>[]).map((r) => ({
      campaign_name: r.campaign_name ?? null,
      adset_name:    r.adset_name ?? null,
      ad_name:       r.ad_name ?? null,
      spend:         toNumber(r.spend) ?? 0,
      impressions:   toNumber(r.impressions) ?? 0,
      clicks:        toNumber(r.clicks) ?? 0,
      purchases:     toNumber(r.purchases) ?? 0,
      revenue:       toNumber(r.revenue) ?? 0,
      roas:          toNumber(r.roas),
      cpo:           toNumber(r.cpo),
      cr:            toNumber(r.cr),
      ctr:           toNumber(r.ctr),
      cpc:           toNumber(r.cpc),
      cpm:           toNumber(r.cpm),
    }))

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/table]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
