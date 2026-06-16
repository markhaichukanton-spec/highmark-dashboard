'use client'
import { useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import { loadDashboard, exportUrl, type DashboardData, type DashboardFilterOptions } from '@/lib/dashboard-client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { Granularity } from '@/components/dashboard/Granularity'
import { KPIRow } from '@/components/dashboard/KPIRow'
import { SummaryTable } from '@/components/dashboard/SummaryTable'
import { MetricChart } from '@/components/charts/MetricChart'
import { GeoPie } from '@/components/charts/GeoPie'

const DEFAULT_FROM = format(subDays(new Date(), 30), 'yyyy-MM-dd')
const DEFAULT_TO   = format(new Date(), 'yyyy-MM-dd')

const EMPTY_FILTERS: DashboardFilterOptions = {
  Source: ['All sources'],
  GEO: ['All GEOs'],
  'Campaign Type': ['All types'],
  Device: ['All devices'],
  Campaign: ['All campaigns'],
  Adset: ['All adsets'],
  Ad: ['All ads'],
}

export default function DashboardPage() {
  const [compare, setCompare]   = useState('previous_period')
  const [gran, setGran]         = useState('Day')
  const [selected, setSelected] = useState(['roas', 'revenue', 'spend'])
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({})
  const [range, setRange]       = useState({ from: DEFAULT_FROM, to: DEFAULT_TO })
  const [data, setData]         = useState<DashboardData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [compact, setCompact]   = useState(false)

  const filters = data?.FILTERS ?? EMPTY_FILTERS

  const onFilter = useCallback((k: string, v: string[]) => {
    setFilterValues((f) => ({ ...f, [k]: v }))
  }, [])

  const resetFilters = useCallback(() => setFilterValues({}), [])

  const toggleMetric = useCallback((key: string) => {
    setSelected((cur) => {
      if (cur.includes(key)) {
        if (cur.length === 1) return cur
        return cur.filter((k) => k !== key)
      }
      return [...cur, key]
    })
  }, [])

  const onDateChange = useCallback((from: string, to: string) => {
    setRange({ from, to })
  }, [])

  const onExport = useCallback(() => {
    const url = exportUrl({
      from: range.from,
      to: range.to,
      filters: filterValues as Partial<DashboardFilterOptions>,
    })
    const a = document.createElement('a')
    a.href = url
    a.click()
  }, [range, filterValues])

  useEffect(() => {
    let ticking = false
    const apply = () => {
      ticking = false
      const y = window.scrollY
      setCompact((c) => (c ? y > 24 : y > 120))
    }
    const onScroll = () => {
      if (!ticking) { ticking = true; window.requestAnimationFrame(apply) }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    apply()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    loadDashboard({
      from: range.from,
      to: range.to,
      granularity: gran.toLowerCase(),
      compare,
      filters: filterValues as Partial<DashboardFilterOptions>,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [range, gran, compare, filterValues])

  const since = range.from
  const until = range.to

  return (
    <div className="dash">
      <div className={'topbar' + (compact ? ' compact' : '')}>
        <DashboardHeader
          since={since}
          until={until}
          compare={compare}
          onCompare={setCompare}
          onDateChange={onDateChange}
          onExport={onExport}
        />
        <FilterBar filters={filters} values={filterValues} onChange={onFilter} onReset={resetFilters} />
      </div>

      <div className="dash-body">
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontFamily: 'var(--mono)', fontSize: 12, color: '#B91C1C' }}>
            Error: {error}
          </div>
        )}

        {loading && !data ? (
          <div style={{ textAlign: 'center', padding: '80px 0', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Loading…
          </div>
        ) : data ? (
          <>
            <KPIRow
              kpis={data.KPIS}
              selected={selected}
              onToggle={toggleMetric}
              metas={data.METRIC_META}
            />

            <Granularity value={gran} onChange={setGran} />

            <div className="analytics-grid">
              <MetricChart data={data.SERIES} selected={selected} metas={data.METRIC_META} />
              <GeoPie geoData={data.GEO} metas={data.METRIC_META} colors={data.GEO_COLORS} />
            </div>

            <SummaryTable rows={data.TABLE} />

            <div className="dash-foot">
              <span>Data refreshed daily · Source: Meta Marketing API</span>
              <span className="hm-mini">High<span className="slash">/</span>Mark</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
