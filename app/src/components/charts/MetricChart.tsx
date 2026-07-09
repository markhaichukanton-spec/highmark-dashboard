'use client'
import { useRef, useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, LabelList,
} from 'recharts'
import type { MetricMeta } from '@/lib/dashboard-config'
import type { SeriesPoint } from '@/lib/dashboard-client'

const AX = { fontFamily: '"DM Mono", monospace', fontSize: 10, fill: '#6B6E7A', letterSpacing: '0.04em' }
const LABEL_FONT = { fontFamily: '"DM Mono", monospace', fontSize: 9.5, fontWeight: 500 }

function ChartTooltip({ active, payload, label, metas }: {
  active?: boolean
  payload?: Array<{ dataKey: string; color: string; value: number }>
  label?: string
  metas: Record<string, MetricMeta>
}) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="chart-tip">
      <div className="tip-period">{label}</div>
      {payload.map((p) => {
        const m = metas[p.dataKey]
        return (
          <div className="tip-row" key={p.dataKey}>
            <span className="tip-dot" style={{ background: p.color }} />
            <span className="tip-name">{m ? m.label : p.dataKey}</span>
            <span className="tip-val">{m ? m.fmt(p.value) : p.value}</span>
          </div>
        )
      })}
    </div>
  )
}

interface Props {
  data: SeriesPoint[]
  selected: string[]
  metas: Record<string, MetricMeta>
  scope?: string
}

export function MetricChart({ data, selected, metas, scope }: Props) {
  const ordered = selected.map((k) => metas[k]).filter(Boolean)
  const left = ordered.filter((m) => m.axis === 'left')
  const right = ordered.filter((m) => m.axis === 'right')

  // Explicit, evenly-stepped date ticks anchored to the LAST date and stepping
  // backward. Every gap equals the step, so there's never a "missing tooth" seam
  // (which Recharts' preserveStart/End auto-thinning leaves when the step doesn't
  // divide the range). The step adapts to the plot width (fewer labels when narrow).
  const bodyRef = useRef<HTMLDivElement>(null)
  const [chartW, setChartW] = useState(0)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setChartW(el.clientWidth))
    ro.observe(el)
    setChartW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const xTicks = useMemo(() => {
    const n = data.length
    if (n === 0) return [] as string[]
    const plot = Math.max(0, chartW - 92)          // minus the Y-axis gutters
    const perLabel = chartW < 560 ? 44 : 60        // tighter on phones so it's not too sparse
    const maxLabels = Math.max(2, Math.floor(plot / perLabel))
    const step = Math.max(1, Math.ceil((n - 1) / (maxLabels - 1)))
    const out: string[] = []
    for (let i = n - 1; i >= 0; i -= step) out.unshift(data[i].label)
    return out
  }, [data, chartW])

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <span className="chart-eyebrow">
            Daily · {selected.length} metric{selected.length === 1 ? '' : 's'}{scope ? ' · ' + scope : ''}
          </span>
          <h3 className="chart-title">Performance over time</h3>
        </div>
        <div className="chart-legend">
          {ordered.map((m) => (
            <span className="lg-item" key={m.key}>
              <i className={m.type === 'line' ? 'lg-line' : ''} style={{ background: m.color }} />
              {m.label}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-body" ref={bodyRef}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 22, right: 6, left: 0, bottom: 0 }}
            barGap={3}
            barCategoryGap="26%"
          >
            <CartesianGrid stroke="rgba(20,18,30,0.07)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={AX}
              tickLine={false}
              axisLine={{ stroke: 'rgba(20,18,30,0.14)' }}
              dy={6}
              // explicit, evenly-stepped ticks (computed above) — anchored to the last
              // date, no "missing tooth" seam. interval=0 shows exactly these.
              ticks={xTicks}
              interval={0}
            />
            {left.length > 0 && (
              <YAxis
                yAxisId="left"
                tick={AX}
                tickLine={false}
                axisLine={false}
                width={46}
                tickFormatter={(v: number) => v >= 1000 ? (v / 1000) + 'k' : String(v)}
              />
            )}
            {right.length > 0 && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={AX}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1)}
              />
            )}
            <Tooltip content={<ChartTooltip metas={metas} />} cursor={{ fill: 'rgba(20,18,30,0.04)' }} />
            {left.map((m) => (
              <Bar
                key={m.key}
                yAxisId="left"
                dataKey={m.key}
                name={m.label}
                fill={m.color}
                radius={[3, 3, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey={m.key}
                  position="top"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={m.short as any}
                  fill={m.color}
                  offset={7}
                  {...LABEL_FONT}
                />
              </Bar>
            ))}
            {right.map((m) => (
              <Line
                key={m.key}
                yAxisId="right"
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2.4}
                dot={{ r: 3, fill: m.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey={m.key}
                  position="top"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={m.short as any}
                  fill={m.color}
                  offset={9}
                  {...LABEL_FONT}
                />
              </Line>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
