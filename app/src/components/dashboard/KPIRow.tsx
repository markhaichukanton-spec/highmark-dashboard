import type { KPICardData } from '@/lib/dashboard-client'
import type { MetricMeta } from '@/lib/dashboard-config'

interface KPICardProps {
  k: KPICardData
  color: string
  selected: boolean
  onToggle: () => void
}

function DeltaArrow({ up }: { up: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      style={{ transform: up ? 'none' : 'rotate(180deg)' }}
    >
      <path d="M12 5v14M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function KPICard({ k, color, selected, onToggle }: KPICardProps) {
  return (
    <button
      type="button"
      className={'kpi' + (selected ? ' sel' : '')}
      style={selected ? { '--mc': color } as React.CSSProperties : undefined}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className="kpi-accent" />
      <span className="kpi-label">
        <span
          className="kpi-dot"
          style={{ borderColor: color, background: selected ? color : 'transparent' }}
        />
        <span className="kpi-label-txt">{k.label}</span>
      </span>
      <span className="kpi-right">
        <span className="kpi-value">{k.value}</span>
        <span className={'kpi-delta ' + (k.up ? 'good' : 'bad')}>
          <DeltaArrow up={k.up} />{k.delta.replace(/^[+-]/, '')}
        </span>
      </span>
    </button>
  )
}

interface Props {
  kpis: KPICardData[]
  selected: string[]
  onToggle: (key: string) => void
  metas: Record<string, MetricMeta>
}

export function KPIRow({ kpis, selected, onToggle, metas }: Props) {
  return (
    <div className="kpi-block">
      <div className="kpi-block-head">
        <span className="eyebrow">Key Metrics</span>
        <span className="kpi-hint">Click a metric to plot it on the chart — keep at least one</span>
      </div>
      <div className="kpi-row">
        {kpis.map((k) => {
          const m = metas[k.seriesKey]
          return (
            <KPICard
              key={k.label}
              k={k}
              color={m ? m.color : '#999'}
              selected={selected.includes(k.seriesKey)}
              onToggle={() => onToggle(k.seriesKey)}
            />
          )
        })}
      </div>
    </div>
  )
}
