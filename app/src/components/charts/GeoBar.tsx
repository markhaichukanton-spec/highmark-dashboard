'use client'
import { useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, LabelList,
} from 'recharts'
import type { MetricMeta } from '@/lib/dashboard-config'
import type { GeoPoint } from '@/lib/dashboard-client'
import { fmt } from '@/lib/dashboard-config'

interface Props {
  geoData: GeoPoint[]
  metas: Record<string, MetricMeta>
  colors: string[]
  selected: string[]                 // GEOs currently in the filter
  onToggle: (geo: string) => void    // click a bar/label to add/remove from the GEO filter
}

const OPTS = ['revenue', 'spend', 'purchases'] as const
const AX = { fontFamily: '"DM Mono", monospace', fontSize: 10, fill: '#6B6E7A', letterSpacing: '0.04em' }
const LABEL_FONT = { fontFamily: '"DM Mono", monospace', fontSize: 9.5, fontWeight: 500 }
const GRAY_BAR = '#DAD5C7'    // inactive bar
const INK = '#3A3B47'
const INK_DIM = '#B7B1A1'     // inactive label text

export function GeoBar({ geoData, metas, colors, selected, onToggle }: Props) {
  const [key, setKey] = useState<string>('revenue')
  const meta = metas[key]

  const data = geoData
    .map((g, i) => ({
      name: g.geo,
      value: (g as unknown as Record<string, number>)[key],
      color: colors[i % colors.length],
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const hasSel = selected.length > 0
  const isOn = (name: string) => !hasSel || selected.includes(name)

  const total = data.reduce((a, d) => a + d.value, 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barLabel = (v: any) => {
    const n = Number(v)
    return `${meta?.short(n) ?? n} · ${total ? Math.round((n / total) * 100) : 0}%`
  }

  // clickable + dimmable country code on the Y axis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTick = (props: any) => {
    const { x, y, payload } = props
    const name = String(payload?.value ?? '')
    return (
      <text
        x={x} y={y} dy={4} textAnchor="end"
        style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer' }}
        fill={isOn(name) ? INK : INK_DIM}
        onClick={() => onToggle(name)}
      >
        {name}
      </text>
    )
  }

  // value label, dimmed when the bar is inactive
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderValueLabel = (props: any) => {
    const { x, y, width, height, value, index } = props
    const d = data[index]
    if (!d) return null
    return (
      <text
        x={Number(x) + Number(width) + 8}
        y={Number(y) + Number(height) / 2} dy={3.5}
        textAnchor="start" style={LABEL_FONT}
        fill={isOn(d.name) ? INK : INK_DIM}
      >
        {barLabel(value)}
      </text>
    )
  }

  return (
    <div className="chart-card pie-card geo-bars">
      <div className="chart-head pie-head">
        <div>
          <span className="chart-eyebrow">By GEO</span>
          <h3 className="chart-title">{meta?.label ?? ''}</h3>
        </div>
      </div>
      <div className="pie-seg">
        {OPTS.map((k) => (
          <button
            key={k}
            className={'pie-seg-btn' + (k === key ? ' on' : '')}
            style={k === key ? { '--mc': metas[k]?.color } as React.CSSProperties : undefined}
            onClick={() => setKey(k)}
          >
            {metas[k]?.label ?? k}
          </button>
        ))}
      </div>
      <div className="pie-body geo-bars-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 6, right: 78, left: 4, bottom: 2 }}
            barCategoryGap="34%"
          >
            <CartesianGrid stroke="rgba(20,18,30,0.07)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ ...AX, fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(20,18,30,0.14)' }}
              tickFormatter={(v: number) => fmt.compact(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={renderTick}
              interval={0}
              tickLine={false}
              axisLine={false}
              width={58}
            />
            <Tooltip
              cursor={{ fill: 'rgba(20,18,30,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const p = payload[0] as { value: number; payload: { name: string; color: string } }
                return (
                  <div className="chart-tip">
                    <div className="tip-row" style={{ marginTop: 0 }}>
                      <span className="tip-dot" style={{ background: p.payload.color }} />
                      <span className="tip-name">{p.payload.name}</span>
                      <span className="tip-val">{meta?.fmt(p.value)}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={26}
              isAnimationActive={false}
              style={{ cursor: 'pointer' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(entry: any) => { const n = entry?.name ?? entry?.payload?.name; if (n) onToggle(String(n)) }}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={isOn(d.name) ? d.color : GRAY_BAR} cursor="pointer" />
              ))}
              <LabelList dataKey="value" content={renderValueLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
