export const COLORS = {
  bg: '#F4F0E6', paper: '#FFFFFF', cream: '#EDE6D2', ink: '#15131A',
  gold: '#C9A84C', goldDeep: '#8E6F3E', muted: '#6B6E7A',
  blue: '#5B8DEF', violet: '#7A6ECC',
  line: 'rgba(20,18,30,0.10)', line2: 'rgba(20,18,30,0.16)',
  goodBg: '#ECFDF0', goodInk: '#15803D', badBg: '#FEF2F2', badInk: '#B91C1C',
}

export type Colors = typeof COLORS

const dh2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dh0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const numFmt = new Intl.NumberFormat('en-US')

export const fmt = {
  currency:  (v: number) => dh2.format(v) + ' dh',
  currency0: (v: number) => dh0.format(v) + ' dh',
  number:    (v: number) => numFmt.format(v),
  ratio:     (v: number) => v.toFixed(2),
  percent:   (v: number) => v.toFixed(1) + '%',
  compact:   (v: number) => {
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k'
    // sub-1000: round to 2 decimals, drop trailing zeros (no ".00" on integers)
    return String(Math.round(v * 100) / 100)
  },
}

export interface MetricMeta {
  key: string
  label: string
  axis: 'left' | 'right'
  type: 'bar' | 'line'
  color: string
  fmt: (v: number) => string
  short: (v: number) => string
}

export const METRIC_META: Record<string, MetricMeta> = {
  roas:      { key: 'roas',      label: 'ROAS',      axis: 'right', type: 'line', color: '#C9A84C', fmt: (v) => fmt.ratio(v),    short: (v) => v.toFixed(2) },
  revenue:   { key: 'revenue',   label: 'Revenue',   axis: 'left',  type: 'bar',  color: '#5B8DEF', fmt: (v) => fmt.currency0(v), short: (v) => fmt.compact(v) },
  spend:     { key: 'spend',     label: 'Spend',     axis: 'left',  type: 'bar',  color: '#7A6ECC', fmt: (v) => fmt.currency0(v), short: (v) => fmt.compact(v) },
  purchases: { key: 'purchases', label: 'Purchases', axis: 'left',  type: 'bar',  color: '#2F9E6A', fmt: (v) => fmt.number(v),    short: (v) => fmt.number(v) },
  cpo:       { key: 'cpo',       label: 'CPO',       axis: 'right', type: 'line', color: '#C2703D', fmt: (v) => fmt.currency(v),  short: (v) => v.toFixed(0) },
  cr:        { key: 'cr',        label: 'CR',        axis: 'right', type: 'line', color: '#4FA6C4', fmt: (v) => fmt.percent(v),   short: (v) => v.toFixed(2) + '%' },
  ctr:       { key: 'ctr',       label: 'CTR',       axis: 'right', type: 'line', color: '#8E6F3E', fmt: (v) => fmt.percent(v),   short: (v) => v.toFixed(2) + '%' },
  cpc:       { key: 'cpc',       label: 'CPC',       axis: 'right', type: 'line', color: '#B0589C', fmt: (v) => fmt.currency(v),  short: (v) => v.toFixed(2) },
  cpm:       { key: 'cpm',       label: 'CPM',       axis: 'right', type: 'line', color: '#6B7280', fmt: (v) => fmt.currency(v),  short: (v) => v.toFixed(1) },
  aov:       { key: 'aov',       label: 'AOV',       axis: 'right', type: 'line', color: '#B5832E', fmt: (v) => fmt.currency(v),  short: (v) => v.toFixed(0) },
}

export const GEO_COLORS = ['#C9A84C', '#5B8DEF', '#7A6ECC', '#2F9E6A', '#8E6F3E']
