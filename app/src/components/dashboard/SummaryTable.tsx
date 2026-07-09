'use client'
import { useState, useMemo, useCallback, useRef, useEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { fmt, COLORS } from '@/lib/dashboard-config'
import { SEP } from '@/lib/dashboard-client'
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
  { key: 'ctr',         label: 'CTR',    align: 'right', sortable: true, fmt: (v: number) => fmt.percent(v) },
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
  rowKey: string                      // hierarchy key campaign▸adset▸ad
  parentKeys: string[]
  selectedKeys: Set<string>
  onToggleKey: (key: string) => void
  anySelected: boolean
}

function TableRow({ node, depth, label, expanded, onToggle, path, rowKey, parentKeys, selectedKeys, onToggleKey, anySelected }: RowProps) {
  const hasKids = !!(node.children && node.children.length > 0)
  const isOpen = expanded[path]
  const checked = selectedKeys.has(rowKey)
  // a row is "active" (not dimmed) when nothing is selected, or it sits on the
  // path of a selection: itself selected, an ancestor of a selected row, or a
  // descendant of a selected row. Unrelated rows dim.
  const onAncestorPath = [...selectedKeys].some((k) => k.startsWith(rowKey + SEP))
  const onDescendantPath = parentKeys.some((pk) => selectedKeys.has(pk))
  const active = !anySelected || checked || onAncestorPath || onDescendantPath

  return (
    <Fragment>
      <tr className={'tr-d' + depth + (checked ? ' tr-sel' : '') + (anySelected && !active ? ' tr-dim' : '')}>
        <td className="tcell-name" style={{ paddingLeft: 16 + depth * 22 }}>
          <button
            className={'row-check' + (checked ? ' on' : '')}
            onClick={() => onToggleKey(rowKey)}
            aria-label={checked ? 'remove from chart' : 'show on chart'}
            title={checked ? 'Plotted on chart — click to remove' : 'Plot only this row on the chart'}
          >
            {checked && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
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
      {hasKids && isOpen && node.children!.map((child, i) => {
        const childLabel = depth === 0 ? child.adset : child.ad
        const childKey = rowKey + SEP + (childLabel ?? '')
        return (
          <TableRow
            key={path + '-' + i}
            node={child}
            depth={depth + 1}
            label={childLabel}
            expanded={expanded}
            onToggle={onToggle}
            path={path + '-' + i}
            rowKey={childKey}
            parentKeys={[...parentKeys, rowKey]}
            selectedKeys={selectedKeys}
            onToggleKey={onToggleKey}
            anySelected={anySelected}
          />
        )
      })}
    </Fragment>
  )
}

interface Props {
  rows: TreeNode[]
  selectedKeys: Set<string>
  onToggleKey: (key: string) => void
  onClearScope: () => void
}

export function SummaryTable({ rows, selectedKeys, onToggleKey, onClearScope }: Props) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = useCallback((p: string) => {
    setExpanded((e) => ({ ...e, [p]: !e[p] }))
  }, [])

  const scopeCount = selectedKeys.size
  const anySelected = scopeCount > 0

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

  // header <tr> — rendered twice: in the real thead and in the floating clone.
  const headRow = () => (
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
  )

  // ── Floating pinned header (mobile) ──────────────────────────────────────
  // The table scrolls horizontally (12 columns), and a horizontal-scroll container
  // clips vertical position:sticky — so the real thead can't stick on mobile. We clone
  // the header into a position:FIXED bar so the browser pins it vertically on the
  // compositor (smooth, no per-frame JS = no jitter). Because `.dash` has container-type
  // (which makes it the containing block for fixed descendants), the clone is rendered
  // in a body PORTAL so `fixed` resolves against the viewport. JS only sets the static
  // geometry on show/resize and mirrors the table's horizontal scroll (translateX).
  const scrollRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const theadRef = useRef<HTMLTableSectionElement>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const dash = document.querySelector('.dash') as HTMLElement | null
    const head = document.querySelector('.dash-head') as HTMLElement | null
    const scroller = scrollRef.current
    const table = tableRef.current
    const thead = theadRef.current
    const floatEl = floatRef.current
    if (!dash || !head || !scroller || !table || !thead || !floatEl) return
    const floatTable = floatEl.querySelector('table') as HTMLTableElement | null
    const floatCols = [...floatEl.querySelectorAll('col')] as HTMLTableColElement[]
    if (!floatTable) return

    const isMobile = () => dash.getBoundingClientRect().width < 1025
    let shown = false
    let hraf = 0

    const syncWidths = () => {
      const ths = [...thead.querySelectorAll('th')] as HTMLElement[]
      let total = 0
      ths.forEach((th, i) => {
        const w = th.getBoundingClientRect().width
        total += w
        if (floatCols[i]) floatCols[i].style.width = w + 'px'
      })
      floatTable.style.width = total + 'px'
    }
    const syncX = () => { floatTable.style.transform = 'translateX(' + (-scroller.scrollLeft) + 'px)' }
    // static geometry — set only when the bar appears / on resize, never per scroll frame.
    // `top` is viewport-relative (fixed), so the browser keeps it pinned as the page scrolls.
    const place = () => {
      syncWidths()
      floatEl.style.top = head.getBoundingClientRect().bottom + 'px'
      const sRect = scroller.getBoundingClientRect()
      floatEl.style.left = sRect.left + 'px'
      floatEl.style.width = sRect.width + 'px'
      syncX()
    }

    let raf = 0
    const update = () => {
      raf = 0
      if (!isMobile()) { if (shown) { floatEl.style.display = 'none'; shown = false } return }
      const pin = head.getBoundingClientRect().bottom
      const tRect = table.getBoundingClientRect()
      const hH = thead.getBoundingClientRect().height
      // show once the real header has scrolled above the pin line, until the table
      // itself scrolls (nearly) out of view above it
      const show = tRect.top < pin && tRect.bottom > pin + hH
      if (show && !shown) { shown = true; floatEl.style.display = 'block'; place() }
      else if (!show && shown) { shown = false; floatEl.style.display = 'none' }
    }
    // vertical scroll: only the cheap show/hide check — while shown, no style writes,
    // so the fixed bar stays pinned by the browser (no jitter)
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }
    const onHScroll = () => { if (shown && !hraf) hraf = requestAnimationFrame(() => { hraf = 0; syncX() }) }
    const remeasure = () => { if (shown) place(); schedule() }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', remeasure, { passive: true })
    scroller.addEventListener('scroll', onHScroll, { passive: true })
    const ro = new ResizeObserver(remeasure)
    ro.observe(table)
    ro.observe(scroller)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', remeasure)
      scroller.removeEventListener('scroll', onHScroll)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
      if (hraf) cancelAnimationFrame(hraf)
    }
  }, [mounted])

  return (
    <>
      <div className="table-card">
        <div className="table-head-bar">
          <h2 className="table-title">Campaign breakdown</h2>
          {anySelected ? (
            <span className="table-scope">
              <span className="scope-dot" />
              {scopeCount} row{scopeCount === 1 ? '' : 's'} on chart
              <button className="scope-clear" onClick={onClearScope}>Clear</button>
            </span>
          ) : (
            <span className="table-hint">Tick a row to plot only it on the chart</span>
          )}
        </div>
        <div className="table-scroll" ref={scrollRef}>
          <table className="summary-table" ref={tableRef}>
            <thead ref={theadRef}>
              {headRow()}
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
                  rowKey={node.campaign}
                  parentKeys={[]}
                  selectedKeys={selectedKeys}
                  onToggleKey={onToggleKey}
                  anySelected={anySelected}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating pinned header clone — body portal so position:fixed resolves against
          the viewport (not the container-typed .dash). Shown/positioned via the effect. */}
      {mounted && createPortal(
        <div className="floating-thead" ref={floatRef} aria-hidden="true">
          <table className="summary-table">
            <colgroup>{COLDEFS.map((c) => <col key={c.key} />)}</colgroup>
            <thead>{headRow()}</thead>
          </table>
        </div>,
        document.body
      )}
    </>
  )
}
