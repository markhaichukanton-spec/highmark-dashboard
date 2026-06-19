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
}

const OPTS = ['revenue', 'spend', 'purchases'] as const
const AX = { fontFamily: '"DM Mono", monospace', fontSize: 10, fill: '#6B6E7A', letterSpacing: '0.04em' }
const LABEL_FONT = { fontFamily: '"DM Mono", monospace', fontSize: 9.5, fontWeight: 500 }

export function GeoBar({ geoData, metas, colors }: Props) {
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

  const total = data.reduce((a, d) => a + d.value, 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barLabel = (v: any) => {
    const n = Number(v)
    return `${meta?.short(n) ?? n} · ${total ? Math.round((n / total) * 100) : 0}%`
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
              tick={{ ...AX, fontSize: 11, fill: '#3A3B47' }}
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
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              <LabelList
                dataKey="value"
                position="right"
                formatter={barLabel}
                fill="#3A3B47"
                offset={8}
                style={LABEL_FONT}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
