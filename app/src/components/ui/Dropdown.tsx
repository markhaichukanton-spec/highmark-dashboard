'use client'
import { Caret } from './Caret'

interface Props {
  label?: string
  options: string[]
  value: string
  onChange: (v: string) => void
  compact?: boolean
}

export function Dropdown({ label, options, value, onChange, compact }: Props) {
  return (
    <label className={'dd' + (compact ? ' dd-compact' : '')}>
      {label && <span className="dd-lbl">{label}</span>}
      <span className="dd-field">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Caret />
      </span>
    </label>
  )
}
