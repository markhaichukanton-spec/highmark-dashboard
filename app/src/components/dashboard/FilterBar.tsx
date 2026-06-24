import { MultiSelect } from '../ui/MultiSelect'
import type { DashboardFilterOptions } from '@/lib/dashboard-client'

interface Props {
  filters: DashboardFilterOptions
  values: Record<string, string[]>
  onChange: (key: string, v: string[]) => void
  onReset: () => void
}

export function FilterBar({ filters, values, onChange, onReset }: Props) {
  const keys = Object.keys(filters) as (keyof DashboardFilterOptions)[]
  const active = keys.filter((k) => {
    const v = values[k]
    return Array.isArray(v) && v.length > 0
  })
  return (
    <div className="filter-bar">
      <span className="fb-tag">Filters</span>
      <div className="fb-fields">
        {keys.map((k) => (
          <MultiSelect
            key={k}
            label={k}
            options={filters[k]}
            value={values[k] || []}
            onChange={(v) => onChange(k, v)}
            additive={k === 'Campaign' || k === 'Adset' || k === 'Ad'}
          />
        ))}
      </div>
      <button className="fb-reset" onClick={onReset} disabled={active.length === 0}>
        Reset{active.length ? ` (${active.length})` : ''}
      </button>
    </div>
  )
}
