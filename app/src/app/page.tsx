'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { loadDashboard, exportUrl, chartSeries, type DashboardData, type DashboardFilterOptions } from '@/lib/dashboard-client'
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

  const toggleEntity = useCallback((levelKey: string, name: string) => {
    setFilterValues((f) => {
      const cur = (f[levelKey] || []).filter((n) => n !== ' ')
      const next = cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]
      return { ...f, [levelKey]: next }
    })
  }, [])

  const clearScope = useCallback(() => {
    setFilterValues((f) => ({ ...f, Campaign: [], Adset: [], Ad: [] }))
  }, [])

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

  // Scroll handler — binary tween (expanded ⇄ compact) with hysteresis.
  // Per-pixel lerp caused scroll-anchoring jitter when the bar resized every frame.
  // Now: cross a threshold once → one 220ms ease-out tween, then done.
  // Compact state covers filters + KPI + granularity all at once.
  // At the table: gran-bar collapses via .topbar.swap; thead pins at --kpi-bottom.
  useEffect(() => {
    const dash = document.querySelector('.dash') as HTMLElement | null
    const topbar = topbarRef.current
    const head = document.querySelector('.dash-head') as HTMLElement | null
    const body = document.querySelector('.dash-body') as HTMLElement | null
    if (!dash || !topbar || !head || !body) return

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    const filterBar = topbar.querySelector('.filter-bar') as HTMLElement | null
    const fbTag     = topbar.querySelector('.fb-tag') as HTMLElement | null
    const fbLabels  = [...topbar.querySelectorAll('.fb-fields .dd-lbl')] as HTMLElement[]
    const fbSelects = [...topbar.querySelectorAll('.fb-fields .dd-field select, .fb-fields .ms-trigger')] as HTMLElement[]
    const granBar   = topbar.querySelector('.gran-bar') as HTMLElement | null
    const granLbl   = topbar.querySelector('.gran-lbl') as HTMLElement | null

    const applyT = (t: number) => {
      // filters: hide field labels, tighten padding
      if (filterBar) { filterBar.style.paddingTop = lerp(11, 6, t) + 'px'; filterBar.style.paddingBottom = lerp(11, 6, t) + 'px' }
      if (fbTag)     { fbTag.style.paddingBottom = lerp(10, 6, t) + 'px' }
      fbLabels.forEach((l) => { l.style.maxHeight = lerp(14, 0, t) + 'px'; l.style.opacity = String(1 - t); l.style.marginBottom = lerp(5, 0, t) + 'px' })
      fbSelects.forEach((s) => { const p = lerp(9, 6, t); s.style.paddingTop = p + 'px'; s.style.paddingBottom = p + 'px' })
      // granularity: tighten
      if (granBar) { granBar.style.paddingTop = lerp(8, 5, t) + 'px'; granBar.style.paddingBottom = lerp(9, 5, t) + 'px' }
      if (granLbl) { granLbl.style.opacity = String(1 - t * 0.5) }
      // KPI: hide "KEY METRICS" header, tighten cards (keep values readable)
      const block = topbar.querySelector('.kpi-block') as HTMLElement | null
      const khead = topbar.querySelector('.kpi-block-head') as HTMLElement | null
      if (block) { block.style.paddingTop = lerp(9, 6, t) + 'px'; block.style.paddingBottom = lerp(11, 7, t) + 'px' }
      if (khead) { khead.style.maxHeight = lerp(17, 0, t) + 'px'; khead.style.opacity = String(1 - t); khead.style.marginBottom = lerp(7, 0, t) + 'px' }
      topbar.querySelectorAll('.kpi').forEach((c) => { const el = c as HTMLElement; const p = lerp(11, 8, t); el.style.paddingTop = p + 'px'; el.style.paddingBottom = p + 'px' })
      topbar.querySelectorAll('.kpi-value').forEach((v) => { (v as HTMLElement).style.fontSize = lerp(16, 14.5, t) + 'px' })
    }

    // one-shot tween between 0 (expanded) and 1 (compact)
    let rafId = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let animFrom = 0, animTo = 0, animStart = 0
    let tCurrent = 0
    const DUR = 220
    const ease = (x: number) => 1 - Math.pow(1 - x, 3)

    const finalize = () => { tCurrent = animTo; applyT(animTo) }
    const step = (now: number) => {
      const p = Math.min(1, (now - animStart) / DUR)
      tCurrent = animFrom + (animTo - animFrom) * ease(p)
      applyT(tCurrent)
      rafId = p < 1 ? requestAnimationFrame(step) : 0
    }
    const tweenTo = (target: number) => {
      if (animTo === target && (rafId !== 0 || tCurrent === target)) return
      animFrom = tCurrent; animTo = target; animStart = performance.now()
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(step)
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(finalize, DUR + 60)
    }

    // stable compact height of the granularity strip — defines where its bottom edge
    // sits below Key Metrics (used to hide it when it pokes past the chart's bottom)
    let granBarH = 0

    // measure --head-h (slim header) and --topbar-ch (compact topbar + head + body-pad)
    // and --kpi-bottom (where table thead should pin = bottom of KPI block)
    const measure = () => {
      const headH = Math.round(head.getBoundingClientRect().height)
      dash.style.setProperty('--head-h', headH + 'px')
      // measure compact height without transitions
      dash.classList.add('no-anim')
      applyT(1)
      const compactTopbar = topbar.getBoundingClientRect().height
      const granH = granBar ? granBar.getBoundingClientRect().height : 0
      if (granH > 0) granBarH = granH  // keep last good value if currently swapped out
      const fbH   = filterBar ? filterBar.getBoundingClientRect().height : 0
      const kpiEl = topbar.querySelector('.kpi-block') as HTMLElement | null
      const kpiH  = kpiEl ? kpiEl.getBoundingClientRect().height : 0
      applyT(tCurrent)
      void topbar.offsetWidth
      dash.classList.remove('no-anim')
      const padTop = parseFloat(getComputedStyle(body).paddingTop) || 0
      dash.style.setProperty('--topbar-ch', Math.round(headH + compactTopbar + padTop) + 'px')
      dash.style.setProperty('--kpi-bottom', Math.round(headH + fbH + kpiH) + 'px')
    }

    let compact = false
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0
      // hysteresis: expand requires scrolling back past 12px, compact triggers at 40px
      const next = compact ? y > 12 : y > 40
      if (next !== compact) { compact = next; tweenTo(compact ? 1 : 0) }
      topbar.classList.toggle('stuck', y > 6)

      // swap: hide the granularity strip the instant it would poke ≥1px below the
      // chart's bottom edge (the chart has scrolled up far enough that the pinned
      // gran-bar no longer sits over the chart). Table thead — always sticky — then
      // pins at --kpi-bottom right under Key Metrics. Filters + KPI stay pinned above.
      const wide = dash.getBoundingClientRect().width >= 1025
      const overview = dash.querySelector('.overview') as HTMLElement | null
      const kpiEl = topbar.querySelector('.kpi-block') as HTMLElement | null
      if (wide && overview && kpiEl) {
        const kpiBot = Math.round(kpiEl.getBoundingClientRect().bottom)
        dash.style.setProperty('--kpi-bottom', kpiBot + 'px')
        const granBot = kpiBot + granBarH          // viewport y of the gran-bar's bottom edge
        const chartBottom = overview.getBoundingClientRect().bottom
        const wasSwap = topbar.classList.contains('swap')
        // on: chart bottom risen ≥1px above gran-bar bottom · off: chart pulled back 40px (hysteresis)
        const swap = wasSwap ? chartBottom < granBot + 40 : chartBottom < granBot - 1
        topbar.classList.toggle('swap', swap)
      } else {
        topbar.classList.remove('swap')
      }
    }

    applyT(0)
    measure()
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure,  { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    if (document.fonts?.ready) document.fonts.ready.then(measure)

    // Re-measure whenever topbar height changes (e.g. KPIRow renders after data loads)
    const ro = new ResizeObserver(measure)
    ro.observe(topbar)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      window.removeEventListener('resize', onScroll)
      ro.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
      if (timeoutId) clearTimeout(timeoutId)
    }
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

  const chartData = useMemo(() => {
    if (!data) return []
    return chartSeries(data.ENTITIES, data.SERIES, filterValues)
  }, [data, filterValues])

  const scopeNames = (['Campaign', 'Adset', 'Ad'] as const)
    .flatMap((k) => (filterValues[k] || []).filter((v) => v !== ' '))
  const scopeLabel = scopeNames.length === 0 ? ''
    : scopeNames.length === 1 ? scopeNames[0]
    : scopeNames.length + ' selected'

  return (
    <div className="dash">
      {/* Slim header — always sticky at top:0 */}
      <DashboardHeader
        since={range.from}
        until={range.to}
        compare={compare}
        onCompare={setCompare}
        onDateChange={onDateChange}
        onExport={onExport}
      />

      {/* Sticky topbar: filters + KPI + granularity — all compact together on scroll */}
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
        <div className="gran-bar">
          <Granularity value={gran} onChange={setGran} />
        </div>
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
            {/* chart-stage: taller than viewport by --stage-room, giving the sticky
                .overview scroll distance to stay framed before releasing upward */}
            <div className="chart-stage">
              <div className="overview">
                <div className="analytics-grid">
                  <MetricChart data={chartData} selected={selected} metas={data.METRIC_META} scope={scopeLabel} />
                  <GeoBar geoData={data.GEO} metas={data.METRIC_META} colors={data.GEO_COLORS} />
                </div>
              </div>
            </div>

            <SummaryTable
              rows={data.TABLE}
              values={filterValues}
              onToggleEntity={toggleEntity}
              onClearScope={clearScope}
            />

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
