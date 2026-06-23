import { Dropdown } from '../ui/Dropdown'
import { DateRangePicker } from '../ui/DateRangePicker'

interface Props {
  since: string
  until: string
  compare: string
  onCompare: (v: string) => void
  onDateChange: (since: string, until: string) => void
  onExport: () => void
}

const COMPARE_OPTS = ['vs previous period', 'vs previous year', 'no comparison']
const COMPARE_MAP: Record<string, string> = {
  'vs previous period': 'previous_period',
  'vs previous year':   'previous_year',
  'no comparison':      'none',
}
const COMPARE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(COMPARE_MAP).map(([k, v]) => [v, k])
)

export function DashboardHeader({ since, until, compare, onCompare, onDateChange, onExport }: Props) {
  return (
    <header className="dash-head">
      <div className="head-left">
        <span className="hm-logo">High<span className="slash">/</span>Mark</span>
        <span className="head-div" />
        <span className="head-title-inline">Performance Overview</span>
      </div>
      <div className="head-right">
        <DateRangePicker since={since} until={until} onApply={onDateChange} />
        <Dropdown
          options={COMPARE_OPTS}
          value={COMPARE_REVERSE[compare] ?? COMPARE_OPTS[0]}
          onChange={(v) => onCompare(COMPARE_MAP[v] ?? 'previous_period')}
          compact
        />
        <button className="export-btn" onClick={onExport}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export
        </button>
      </div>
    </header>
  )
}
