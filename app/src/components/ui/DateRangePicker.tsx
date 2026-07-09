'use client'
import { useState, useRef, useEffect } from 'react'
import { format, subDays, startOfMonth, startOfYear } from 'date-fns'

interface Props {
  since: string
  until: string
  onApply: (since: string, until: string) => void
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

function presets() {
  const today = new Date()
  return [
    { label: 'Yesterday',    since: fmt(subDays(today, 1)),  until: fmt(subDays(today, 1)) },
    { label: 'Last 3 days',  since: fmt(subDays(today, 2)),  until: fmt(today) },
    { label: 'Last 7 days',  since: fmt(subDays(today, 6)),  until: fmt(today) },
    { label: 'Last 14 days', since: fmt(subDays(today, 13)), until: fmt(today) },
    { label: 'Last 30 days', since: fmt(subDays(today, 29)), until: fmt(today) },
    { label: 'Last 90 days', since: fmt(subDays(today, 89)), until: fmt(today) },
    { label: 'This month',   since: fmt(startOfMonth(today)), until: fmt(today) },
    { label: 'Year to date', since: fmt(startOfYear(today)), until: fmt(today) },
  ]
}

export function DateRangePicker({ since, until, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [draftSince, setDraftSince] = useState(since)
  const [draftUntil, setDraftUntil] = useState(until)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setDraftSince(since)
    setDraftUntil(until)
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, since, until])

  const pick = (s: string, u: string) => { onApply(s, u); setOpen(false) }
  const applyCustom = () => {
    if (draftSince && draftUntil && draftSince <= draftUntil) pick(draftSince, draftUntil)
  }

  return (
    <div className={'drp' + (open ? ' open' : '')} ref={ref}>
      <button type="button" className="daterange" onClick={() => setOpen((o) => !o)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span className="dr-val">{since}</span>
        <span className="dr-sep">→</span>
        <span className="dr-val">{until}</span>
      </button>
      {open && (
        <div className="drp-pop">
          <div className="drp-presets">
            {presets().map((p) => (
              <button
                type="button"
                key={p.label}
                className={'drp-preset' + (p.since === since && p.until === until ? ' on' : '')}
                onClick={() => pick(p.since, p.until)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="drp-custom">
            <label className="drp-field">
              <span>From</span>
              <input
                type="date"
                value={draftSince}
                max={draftUntil}
                onChange={(e) => setDraftSince(e.target.value)}
              />
            </label>
            <label className="drp-field">
              <span>To</span>
              <input
                type="date"
                value={draftUntil}
                min={draftSince}
                onChange={(e) => setDraftUntil(e.target.value)}
              />
            </label>
            <button type="button" className="drp-apply" onClick={applyCustom}>Apply</button>
          </div>
        </div>
      )}
    </div>
  )
}
