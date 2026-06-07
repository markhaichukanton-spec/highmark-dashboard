import { NextResponse } from 'next/server'
import { getClient } from '@/lib/bigquery'
import { filtersQuery } from '@/lib/queries'

export async function GET() {
  try {
    const bq = getClient()
    const [rows] = await bq.query({ query: filtersQuery() })
    const r = rows[0] as Record<string, string[]> ?? {}
    return NextResponse.json({
      sources:    r.sources ?? [],
      countries:  r.countries ?? [],
      objectives: r.objectives ?? [],
      campaigns:  r.campaigns ?? [],
      adsets:     r.adsets ?? [],
      ads:        r.ads ?? [],
    })
  } catch (err) {
    console.error('[/api/filters]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
