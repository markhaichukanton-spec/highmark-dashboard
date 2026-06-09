interface Props {
  value: string
  onChange: (v: string) => void
}

const OPTS = ['Day', 'Week', 'Month', 'Quarter', 'Year']

export function Granularity({ value, onChange }: Props) {
  return (
    <div className="gran">
      <span className="gran-lbl">Granularity</span>
      <div className="seg">
        {OPTS.map((o) => (
          <button
            key={o}
            className={'seg-btn' + (value === o ? ' on' : '')}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
