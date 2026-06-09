'use client'
import { useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import type { MetricMeta } from '@/lib/dashboard-config'
import type { GeoPoint } from '@/lib/dashboard-client'

interface Props {
  geoData: GeoPoint[]
  metas: Record<string, MetricMeta>
  colors: string[]
}

const OPTS = ['revenue', 'spend', 'purchases'] as const

export function GeoPie({ geoData, metas, colors }: Props) {
  const [pieKey, setPieKey] = useState<string>('revenue')
  const meta = metas[pieKey]

  const data = geoData
    .map((g, i) => ({
      name: g.geo,
      value: (g as unknown as Record<string, number>)[pieKey],
      color: colors[i % colors.length],
    }))
    .filter((d) => d.value > 0)

  const total = data.reduce((a, d) => a + d.value, 0)

  return (
    <div className="chart-card pie-card">
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
            className={'pie-seg-btn' + (k === pieKey ? ' on' : '')}
            style={k === pieKey ? { '--mc': metas[k]?.color } as React.CSSProperties : undefined}
            onClick={() => setPieKey(k)}
          >
            {metas[k]?.label ?? k}
          </button>
        ))}
      </div>
      <div className="pie-body">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const p = payload[0] as { value: number; name: string; payload: { color: string } }
                const share = total ? (p.value / total * 100).toFixed(1) : 0
                return (
                  <div className="chart-tip">
                    <div className="tip-row" style={{ marginTop: 0 }}>
                      <span className="tip-dot" style={{ background: p.payload.color }} />
                      <span className="tip-name">{p.name}</span>
                      <span className="tip-val">{meta?.fmt(p.value)}</span>
                    </div>
                    <div className="tip-share">{share}% of total</div>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pie-center">
          <span className="pc-lbl">GEOs</span>
          <span className="pc-val">{data.length}</span>
        </div>
      </div>
      <div className="pie-legend">
        {data.map((d) => (
          <div className="pl-row" key={d.name}>
            <span className="pl-dot" style={{ background: d.color }} />
            <span className="pl-name">{d.name}</span>
            <span className="pl-amt">{meta?.fmt(d.value)}</span>
            <span className="pl-val">{total ? (d.value / total * 100).toFixed(0) + '%' : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
