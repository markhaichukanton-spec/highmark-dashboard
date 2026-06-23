/* dash-ui.jsx — header, controls, KPI cards, summary table.
   Exports to window: Header, FilterBar, DateRange, Granularity, KPIRow, SummaryTable */
const { useState, useMemo, useCallback, useRef, useEffect } = React;

/* ── small primitives ─────────────────────────────────────── */
function Caret() {
  return (
    <svg className="caret" width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// dropdown styled as the brand Select; native <select> for reliability
function Dropdown({ label, options, value, onChange, compact }) {
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
  );
}

/* ── MultiSelect — checkboxes + search + select-all ────────── */
// options[0] is treated as the "All …" label; the rest are selectable.
// `value` is an array of selected real options ([] === all).
function MultiSelect({ label, options, value, onChange }) {
  const allLabel = options[0];
  const real = useMemo(() => options.slice(1), [options]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const sel = value || [];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const allChecked = sel.length === 0 || sel.length === real.length;
  const filtered = real.filter((o) => o.toLowerCase().includes(query.toLowerCase().trim()));

  const summary = sel.length === 0 || sel.length === real.length
    ? allLabel
    : sel.length === 1 ? sel[0] : `${sel.length} selected`;

  const toggleOne = (o) => {
    const set = new Set(sel.length === 0 ? real : sel); // editing from "all" starts from full set
    if (set.has(o)) set.delete(o); else set.add(o);
    const next = [...set];
    onChange(next.length === real.length ? [] : next); // full set collapses back to "all"
  };
  const selectAll = () => onChange([]);            // [] === all selected
  const clearAll = () => onChange(['\u0000']);      // sentinel: nothing (no real match)

  const noneSelected = sel.length === 1 && sel[0] === '\u0000';

  return (
    <div className={'dd ms' + (open ? ' open' : '')} ref={ref}>
      <span className="dd-lbl">{label}</span>
      <button type="button" className={'ms-trigger' + (!allChecked ? ' active' : '')} onClick={() => setOpen((o) => !o)}>
        <span className="ms-summary">{noneSelected ? 'None' : summary}</span>
        <Caret />
      </button>
      {open && (
        <div className="ms-pop">
          <div className="ms-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`} />
            {query && <button className="ms-clear" onClick={() => setQuery('')} aria-label="clear">×</button>}
          </div>
          <div className="ms-actions">
            <button className="ms-act" onClick={selectAll}>Select all</button>
            <button className="ms-act" onClick={clearAll}>Clear</button>
          </div>
          <div className="ms-list">
            {filtered.length === 0 && <div className="ms-empty">No matches</div>}
            {filtered.map((o) => {
              const checked = !noneSelected && (sel.length === 0 || sel.includes(o));
              return (
                <button type="button" key={o} className={'ms-opt' + (checked ? ' on' : '')} onClick={() => toggleOne(o)}>
                  <span className="ms-box">
                    {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <span className="ms-opt-txt">{o}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Header ────────────────────────────────────────────────── */
function Logo() {
  return (
    <span className="hm-logo">High<span className="slash">/</span>Mark</span>
  );
}

function Header({ since, until, compare, onCompare }) {
  return (
    <header className="dash-head">
      <div className="head-left">
        <Logo />
        <span className="head-div" />
        <div className="head-titles">
          <div className="eyebrow">Aurora Scents · Meta Ads</div>
          <h1 className="head-h1">Performance Overview</h1>
        </div>
      </div>
      <div className="head-right">
        <div className="daterange">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" /><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          <span className="dr-val">{since}</span>
          <span className="dr-sep">→</span>
          <span className="dr-val">{until}</span>
        </div>
        <Dropdown options={['vs previous period', 'vs previous year', 'no comparison']} value={compare} onChange={onCompare} compact />
        <button className="export-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Export
        </button>
      </div>
    </header>
  );
}

/* ── Filter bar ────────────────────────────────────────────── */
function FilterBar({ filters, values, onChange, onReset }) {
  const keys = Object.keys(filters);
  const active = keys.filter((k) => {
    const v = values[k];
    return Array.isArray(v) && v.length > 0; // [] === all; any entries === a real filter
  });
  return (
    <div className="filter-bar">
      <span className="fb-tag">Filters</span>
      <div className="fb-fields">
        {keys.map((k) => (
          <MultiSelect key={k} label={k} options={filters[k]} value={values[k]} onChange={(v) => onChange(k, v)} />
        ))}
      </div>
      <button className="fb-reset" onClick={onReset} disabled={active.length === 0}>
        Reset{active.length ? ` (${active.length})` : ''}
      </button>
    </div>
  );
}

/* ── Granularity selector ──────────────────────────────────── */
function Granularity({ value, onChange }) {
  const opts = ['Day', 'Week', 'Month', 'Quarter', 'Year'];
  return (
    <div className="gran">
      <span className="gran-lbl">Granularity</span>
      <div className="seg">
        {opts.map((o) => (
          <button key={o} className={'seg-btn' + (value === o ? ' on' : '')} onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

/* ── KPI card + row ────────────────────────────────────────── */
function DeltaArrow({ up }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
      <path d="M12 5v14M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KPICard({ k, color, selected, onToggle }) {
  // colored purely by direction: up = green, down = red
  const positive = k.up;
  return (
    <button type="button" className={'kpi' + (selected ? ' sel' : '')}
      style={selected ? { '--mc': color } : undefined}
      onClick={onToggle} aria-pressed={selected}>
      <span className="kpi-accent" />
      <div className="kpi-top">
        <span className="kpi-label">
          <span className="kpi-dot" style={{ borderColor: color, background: selected ? color : 'transparent' }} />
          {k.label}
        </span>
        <span className={'kpi-delta ' + (positive ? 'good' : 'bad')}>
          <DeltaArrow up={k.up} />{k.delta.replace(/^[+\-]/, '')}
        </span>
      </div>
      <div className="kpi-value">{k.value}</div>
      <div className="kpi-sub">{k.sub}</div>
    </button>
  );
}

function KPIRow({ kpis, selected, onToggle, metas }) {
  return (
    <div className="kpi-block">
      <div className="kpi-block-head">
        <span className="eyebrow">Key Metrics</span>
        <span className="kpi-hint">Click a metric to plot it on the chart — keep at least one</span>
      </div>
      <div className="kpi-row">
        {kpis.map((k) => {
          const m = metas[k.seriesKey];
          return (
            <KPICard key={k.label} k={k} color={m ? m.color : '#999'}
              selected={selected.includes(k.seriesKey)} onToggle={() => onToggle(k.seriesKey)} />
          );
        })}
      </div>
    </div>
  );
}

/* ── Summary table (drill-down) ────────────────────────────── */
function roasStyle(roas) {
  if (roas >= 3.0) return { background: DATA.COLORS.goodBg, color: DATA.COLORS.goodInk };
  if (roas < 2.0) return { background: DATA.COLORS.badBg, color: DATA.COLORS.badInk };
  return { color: DATA.COLORS.ink };
}

const COLDEFS = [
  { key: 'name',        label: 'Campaign / Adset / Ad', align: 'left', sortable: false },
  { key: 'roas',        label: 'ROAS', align: 'right', fmt: (v) => fmt.ratio(v) },
  { key: 'purchases',   label: 'Purch.', align: 'right', fmt: (v) => fmt.number(v) },
  { key: 'spend',       label: 'Spend', align: 'right', fmt: (v) => fmt.currency0(v) },
  { key: 'cpo',         label: 'CPO', align: 'right', fmt: (v) => v ? fmt.currency(v) : '—' },
  { key: 'cr',          label: 'CR', align: 'right', fmt: (v) => fmt.percent(v) },
  { key: 'revenue',     label: 'Revenue', align: 'right', fmt: (v) => fmt.currency0(v) },
  { key: 'cpc',         label: 'CPC', align: 'right', fmt: (v) => fmt.currency(v) },
  { key: 'cpm',         label: 'CPM', align: 'right', fmt: (v) => fmt.currency(v) },
  { key: 'clicks',      label: 'Clicks', align: 'right', fmt: (v) => fmt.number(v) },
  { key: 'impressions', label: 'Impr.', align: 'right', fmt: (v) => fmt.compact(v) },
];

function TableRow({ node, depth, label, expanded, onToggle, path }) {
  const hasKids = node.children && node.children.length > 0;
  const isOpen = expanded[path];
  return (
    <React.Fragment>
      <tr className={'tr-d' + depth}>
        <td className="tcell-name" style={{ paddingLeft: 16 + depth * 22 }}>
          {hasKids ? (
            <button className={'twist' + (isOpen ? ' open' : '')} onClick={() => onToggle(path)} aria-label="toggle">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ) : <span className="twist-spacer" />}
          <span className="name-txt">{label}</span>
        </td>
        {COLDEFS.slice(1).map((c) => (
          <td key={c.key} className="tcell-num" style={c.key === 'roas' ? roasStyle(node.roas) : undefined}>
            {c.fmt(node[c.key])}
          </td>
        ))}
      </tr>
      {hasKids && isOpen && node.children.map((child, i) => {
        const childLabel = depth === 0 ? child.adset : child.ad;
        return (
          <TableRow key={path + '-' + i} node={child} depth={depth + 1}
            label={childLabel} expanded={expanded} onToggle={onToggle} path={path + '-' + i} />
        );
      })}
    </React.Fragment>
  );
}

function SummaryTable({ rows }) {
  const [sort, setSort] = useState({ key: 'spend', dir: 'desc' });
  const [expanded, setExpanded] = useState({ '0': true }); // first campaign open

  const toggle = useCallback((p) => setExpanded((e) => ({ ...e, [p]: !e[p] })), []);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const d = (a[sort.key] ?? 0) - (b[sort.key] ?? 0);
      return sort.dir === 'desc' ? -d : d;
    });
    return arr;
  }, [rows, sort]);

  const setSortKey = (key) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  };

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
                <th key={c.key} className={'th-' + c.align + (c.sortable === false ? '' : ' sortable') + (sort.key === c.key ? ' sorted' : '')}
                  onClick={c.sortable === false ? undefined : () => setSortKey(c.key)}>
                  <span className="th-inner">
                    {c.label}
                    {c.sortable !== false && (
                      <span className={'sort-ind' + (sort.key === c.key ? ' on ' + sort.dir : '')}>▾</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((node, i) => (
              <TableRow key={i} node={node} depth={0} label={node.campaign}
                expanded={expanded} onToggle={toggle} path={String(i)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { Header, FilterBar, Granularity, KPIRow, SummaryTable, Dropdown });
