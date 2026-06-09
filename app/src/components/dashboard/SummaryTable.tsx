'use client'
import { useState, useMemo, useCallback, Fragment } from 'react'
import { fmt, COLORS } from '@/lib/dashboard-config'
import type { TreeNode } from '@/lib/dashboard-client'

const COLDEFS = [
  { key: 'name',        label: 'Campaign / Adset / Ad', align: 'left',  sortable: false, fmt: (_v: number) => '' },
  { key: 'roas',        label: 'ROAS',   align: 'right', sortable: true, fmt: (v: number) => fmt.ratio(v) },
  { key: 'purchases',   label: 'Purch.', align: 'right', sortable: true, fmt: (v: number) => fmt.number(v) },
  { key: 'spend',       label: 'Spend',  align: 'right', sortable: true, fmt: (v: number) => fmt.currency0(v) },
  { key: 'cpo',         label: 'CPO',    align: 'right', sortable: true, fmt: (v: number) => v ? fmt.currency(v) : '—' },
  { key: 'cr',          label: 'CR',     align: 'right', sortable: true, fmt: (v: number) => fmt.percent(v) },
  { key: 'revenue',     label: 'Revenue',align: 'right', sortable: true, fmt: (v: number) => fmt.currency0(v) },
  { key: 'cpc',         label: 'CPC',    align: 'right', sortable: true, fmt: (v: number) => fmt.currency(v) },
  { key: 'cpm',         label: 'CPM',    align: 'right', sortable: true, fmt: (v: number) => fmt.currency(v) },
  { key: 'clicks',      label: 'Clicks', align: 'right', sortable: true, fmt: (v: number) => fmt.number(v) },
  { key: 'impressions', label: 'Impr.',  align: 'right', sortable: true, fmt: (v: number) => fmt.compact(v) },
] as const

function roasStyle(roas: number): React.CSSProperties {
  if (roas >= 3.0) return { background: COLORS.goodBg, color: COLORS.goodInk }
  if (roas < 2.0)  return { background: COLORS.badBg,  color: COLORS.badInk }
  return { color: COLORS.ink }
}

interface RowProps {
  node: TreeNode
  depth: number
  label: string | null
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
  path: string
}

function TableRow({ node, depth, label, expanded, onToggle, path }: RowProps) {
  const hasKids = !!(node.children && node.children.length > 0)
  const isOpen = expanded[path]
  return (
    <Fragment>
      <tr className={'tr-d' + depth}>
        <td className="tcell-name" style={{ paddingLeft: 16 + depth * 22 }}>
          {hasKids ? (
            <button
              className={'twist' + (isOpen ? ' open' : '')}
              onClick={() => onToggle(path)}
              aria-label="toggle"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : <span className="twist-spacer" />}
          <span className="name-txt">{label}</span>
        </td>
        {COLDEFS.slice(1).map((c) => (
          <td
            key={c.key}
            className="tcell-num"
            style={c.key === 'roas' ? roasStyle(node.roas) : undefined}
          >
            {c.fmt((node as unknown as Record<string, number>)[c.key])}
          </td>
        ))}
      </tr>
      {hasKids && isOpen && node.children!.map((child, i) => (
        <TableRow
          key={path + '-' + i}
          node={child}
          depth={depth + 1}
          label={depth === 0 ? child.adset : child.ad}
          expanded={expanded}
          onToggle={onToggle}
          path={path + '-' + i}
        />
      ))}
    </Fragment>
  )
}

interface Props {
  rows: TreeNode[]
}

export function SummaryTable({ rows }: Props) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '0': true })

  const toggle = useCallback((p: string) => {
    setExpanded((e) => ({ ...e, [p]: !e[p] }))
  }, [])

  const sorted = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const d = ((a as unknown as Record<string, number>)[sort.key] ?? 0) -
                ((b as unknown as Record<string, number>)[sort.key] ?? 0)
      return sort.dir === 'desc' ? -d : d
    })
    return arr
  }, [rows, sort])

  const setSortKey = (key: string) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' })
  }

  return (
    <div className="table-card">
      <div className="table-head-bar">
        <h2 className="table-title">Campaign breakdown</h2>
        <span className="table-hint">Click a row to drill into adsets &amp; ads</span>
      </div>
      <div className="table-scroll">
        <table className="summary-table">
          <thead>
            <tr>
              {COLDEFS.map((c) => (
                <th
                  key={c.key}
                  className={
                    'th-' + c.align +
                    (c.sortable ? ' sortable' : '') +
                    (sort.key === c.key ? ' sorted' : '')
                  }
                  onClick={c.sortable ? () => setSortKey(c.key) : undefined}
                >
                  <span className="th-inner">
                    {c.label}
                    {c.sortable && (
                      <span className={'sort-ind' + (sort.key === c.key ? ' on ' + sort.dir : '')}>▾</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((node, i) => (
              <TableRow
                key={i}
                node={node}
                depth={0}
                label={node.campaign}
                expanded={expanded}
                onToggle={toggle}
                path={String(i)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
