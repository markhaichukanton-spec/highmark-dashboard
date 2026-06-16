import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/bigquery'
import { exportQuery, parseDashboardFilters } from '@/lib/queries'
import { format } from 'date-fns'

const HEADERS = [
  'Date', 'Source', 'Account ID', 'GEO',
  'Campaign ID', 'Campaign Name', 'Campaign Objective',
  'Ad Set ID', 'Ad Set Name', 'Ad ID', 'Ad Name',
  'Impressions', 'Clicks', 'Spend', 'Purchases', 'Revenue', 'Reach',
]

function toPeriod(v: unknown): string {
  if (v instanceof Date) return format(v, 'yyyy-MM-dd')
  if (typeof v === 'object' && v !== null && 'value' in v) return String((v as { value: string }).value)
  return String(v ?? '')
}

function toNum(v: unknown): number {
  if (v == null) return 0
  const n =
    typeof v === 'object' && v !== null && 'value' in v
      ? parseFloat((v as { value: string }).value)
      : Number(v)
  return isNaN(n) ? 0 : n
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export async function GET(req: NextRequest) {
  try {
    const filters = parseDashboardFilters(req.nextUrl.searchParams)
    const bq = getClient()
    const [rows] = await bq.query({ query: exportQuery(filters) })

    const lines = [HEADERS.join(',')]
    for (const r of rows as Record<string, unknown>[]) {
      lines.push([
        toPeriod(r.date),
        r.source,
        r.account_id,
        r.geo,
        r.campaign_id,
        r.campaign_name,
        r.campaign_objective,
        r.adset_id,
        r.adset_name,
        r.ad_id,
        r.ad_name,
        toNum(r.impressions),
        toNum(r.clicks),
        toNum(r.spend),
        toNum(r.purchases),
        toNum(r.revenue),
        toNum(r.reach),
      ].map(csvCell).join(','))
    }

    const csv = '﻿' + lines.join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="aurora-scents_${filters.since}_${filters.until}.csv"`,
      },
    })
  } catch (err) {
    console.error('[/api/export]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
