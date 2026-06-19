'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { loadDashboard, exportUrl, type DashboardData, type DashboardFilterOptions } from '@/lib/dashboard-client'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { Granularity } from '@/components/dashboard/Granularity'
import { KPIRow } from '@/components/dashboard/KPIRow'
import { SummaryTable } from '@/components/dashboard/SummaryTable'
import { MetricChart } from '@/components/charts/MetricChart'
import { GeoBar } from '@/components/charts/GeoBar'

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

  const topbarRef = useRef<HTMLDivElement>(null)

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

  // Scroll-linked KPI compaction — inline styles via lerp so it never stalls
  // under Recharts' continuous work (CSS transitions on layout props would freeze)
  useEffect(() => {
    const dash = document.querySelector('.dash') as HTMLElement | null
    const topbar = topbarRef.current
    const body = document.querySelector('.dash-body') as HTMLElement | null
    if (!dash || !topbar || !body) return
    const RANGE = 90
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const paint = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0
      const t = Math.min(1, Math.max(0, y / RANGE))
      const block = topbar.querySelector('.kpi-block') as HTMLElement | null
      const head  = topbar.querySelector('.kpi-block-head') as HTMLElement | null
      if (block) { block.style.paddingTop = lerp(11, 8, t) + 'px'; block.style.paddingBottom = lerp(14, 8, t) + 'px' }
      if (head)  { head.style.maxHeight = lerp(18, 0, t) + 'px'; head.style.opacity = String(1 - t); head.style.marginBottom = lerp(8, 0, t) + 'px' }
      topbar.querySelectorAll('.kpi').forEach((c) => {
        const el = c as HTMLElement; const p = lerp(9, 6, t)
        el.style.paddingTop = p + 'px'; el.style.paddingBottom = p + 'px'
      })
      topbar.querySelectorAll('.kpi-value').forEach((v) => { (v as HTMLElement).style.fontSize = lerp(19, 15, t) + 'px' })
      topbar.querySelectorAll('.kpi-sub').forEach((s) => {
        const el = s as HTMLElement; el.style.maxHeight = lerp(16, 0, t) + 'px'; el.style.opacity = String(1 - t)
      })
      topbar.classList.toggle('stuck', y > 6)

      // Swap KPI bar ⇄ table header: when thead reaches the top, KPI slides away
      const wide = dash.getBoundingClientRect().width >= 1025
      const thead = dash.querySelector('.summary-table thead')
      if (wide && thead) {
        const theadTop = (thead as HTMLElement).getBoundingClientRect().top
        const wasAway = topbar.classList.contains('away')
        const away = wasAway ? theadTop <= 28 : theadTop <= 0.5
        topbar.classList.toggle('away', away)
      } else {
        topbar.classList.remove('away')
      }

      const padTop = parseFloat(getComputedStyle(body).paddingTop) || 0
      dash.style.setProperty('--topbar-ch', Math.round(topbar.getBoundingClientRect().height + padTop) + 'px')
    }
    window.addEventListener('scroll', paint, { passive: true })
    window.addEventListener('resize', paint, { passive: true })
    paint()
    if (document.fonts?.ready) document.fonts.ready.then(paint)
    return () => { window.removeEventListener('scroll', paint); window.removeEventListener('resize', paint) }
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
      {/* Header scrolls away freely — not part of the sticky topbar */}
      <DashboardHeader
        since={since}
        until={until}
        compare={compare}
        onCompare={setCompare}
        onDateChange={onDateChange}
        onExport={onExport}
      />

      {/* Sticky topbar: FilterBar + KPI block pin together; KPI shrinks scroll-linked */}
      <div className="topbar" ref={topbarRef}>
        <FilterBar filters={filters} values={filterValues} onChange={onFilter} onReset={resetFilters} />
        {data && (
          <KPIRow
            kpis={data.KPIS}
            selected={selected}
            onToggle={toggleMetric}
            metas={data.METRIC_META}
          />
        )}
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
            <div className="overview">
              <Granularity value={gran} onChange={setGran} />
              <div className="analytics-grid">
                <MetricChart data={data.SERIES} selected={selected} metas={data.METRIC_META} />
                <GeoBar geoData={data.GEO} metas={data.METRIC_META} colors={data.GEO_COLORS} />
              </div>
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
