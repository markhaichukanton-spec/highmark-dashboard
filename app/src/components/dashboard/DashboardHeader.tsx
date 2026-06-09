import { Dropdown } from '../ui/Dropdown'

interface Props {
  since: string
  until: string
  compare: string
  onCompare: (v: string) => void
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

export function DashboardHeader({ since, until, compare, onCompare }: Props) {
  return (
    <header className="dash-head">
      <div className="head-left">
        <span className="hm-logo">High<span className="slash">/</span>Mark</span>
        <span className="head-div" />
        <div className="head-titles">
          <div className="eyebrow">Aurora Scents · Meta Ads</div>
          <h1 className="head-h1">Performance Overview</h1>
        </div>
      </div>
      <div className="head-right">
        <div className="daterange">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span className="dr-val">{since}</span>
          <span className="dr-sep">→</span>
          <span className="dr-val">{until}</span>
        </div>
        <Dropdown
          options={COMPARE_OPTS}
          value={COMPARE_REVERSE[compare] ?? COMPARE_OPTS[0]}
          onChange={(v) => onCompare(COMPARE_MAP[v] ?? 'previous_period')}
          compact
        />
        <button className="export-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export
        </button>
      </div>
    </header>
  )
}
