/* dash-charts.jsx — interactive MetricChart (driven by KPI selection) + GeoPie donut.
   Exports to window: MetricChart, GeoPie */
const {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, LabelList,
  PieChart, Pie, Cell,
} = Recharts;

const AX = { fontFamily: '"DM Mono", monospace', fontSize: 10, fill: '#6B6E7A', letterSpacing: '0.04em' };
const LABEL_FONT = { fontFamily: '"DM Mono", monospace', fontSize: 9.5, fontWeight: 500 };

/* ── shared tooltip ───────────────────────────────────────── */
function ChartTooltip({ active, payload, label, metas }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tip">
      <div className="tip-period">{label}</div>
      {payload.map((p) => {
        const m = metas[p.dataKey];
        return (
          <div className="tip-row" key={p.dataKey}>
            <span className="tip-dot" style={{ background: p.color }} />
            <span className="tip-name">{m ? m.label : p.name}</span>
            <span className="tip-val">{m ? m.fmt(p.value) : p.value}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── the single interactive time-series chart ─────────────── */
function MetricChart({ data, selected, metas }) {
  const ordered = selected.map((k) => metas[k]).filter(Boolean);
  const left = ordered.filter((m) => m.axis === 'left');
  const right = ordered.filter((m) => m.axis === 'right');
  const useLeft = left.length > 0;
  const useRight = right.length > 0;
  const firstKey = selected[0];
  // value labels show on every selected metric (bars and lines alike)
  const labelled = () => true;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <span className="chart-eyebrow">Daily · {selected.length} metric{selected.length === 1 ? '' : 's'}</span>
          <h3 className="chart-title">Performance over time</h3>
        </div>
        <div className="chart-legend">
          {ordered.map((m) => (
            <span className="lg-item" key={m.key}>
              <i className={m.type === 'line' ? 'lg-line' : ''} style={{ background: m.color }} />{m.label}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 22, right: 6, left: 0, bottom: 0 }} barGap={3} barCategoryGap="26%">
            <CartesianGrid stroke="rgba(20,18,30,0.07)" vertical={false} />
            <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={{ stroke: 'rgba(20,18,30,0.14)' }} dy={6} />
            {useLeft && (
              <YAxis yAxisId="left" tick={AX} tickLine={false} axisLine={false} width={46}
                tickFormatter={(v) => v >= 1000 ? (v / 1000) + 'k' : v} />
            )}
            {useRight && (
              <YAxis yAxisId="right" orientation="right" tick={AX} tickLine={false} axisLine={false} width={40}
                tickFormatter={(v) => Number.isInteger(v) ? v : v.toFixed(1)} />
            )}
            <Tooltip content={<ChartTooltip metas={metas} />} cursor={{ fill: 'rgba(20,18,30,0.04)' }} />
            {left.map((m) => (
              <Bar key={m.key} yAxisId="left" dataKey={m.key} name={m.label} fill={m.color}
                radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false}>
                {labelled(m) && (
                  <LabelList dataKey={m.key} position="top" formatter={m.short}
                    fill={m.color} offset={7} {...LABEL_FONT} />
                )}
              </Bar>
            ))}
            {right.map((m) => (
              <Line key={m.key} yAxisId="right" type="monotone" dataKey={m.key} name={m.label} stroke={m.color}
                strokeWidth={2.4} dot={{ r: 3, fill: m.color, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false}>
                {labelled(m) && (
                  <LabelList dataKey={m.key} position="top" formatter={m.short}
                    fill={m.color} offset={9} {...LABEL_FONT} />
                )}
              </Line>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── GEO donut — switches between the three bar metrics ──── */
function GeoPie({ geoData, metas, colors }) {
  const OPTS = ['revenue', 'spend', 'purchases'];
  const [pieKey, setPieKey] = React.useState('revenue');
  const meta = metas[pieKey];
  const data = geoData
    .map((g, i) => ({ name: g.geo, value: g[meta.key], color: colors[i % colors.length] }))
    .filter((d) => d.value > 0);
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <div className="chart-card pie-card">
      <div className="chart-head pie-head">
        <div>
          <span className="chart-eyebrow">By GEO</span>
          <h3 className="chart-title">{meta.label}</h3>
        </div>
      </div>
      <div className="pie-seg">
        {OPTS.map((k) => (
          <button key={k} className={'pie-seg-btn' + (k === pieKey ? ' on' : '')}
            style={k === pieKey ? { '--mc': metas[k].color } : undefined}
            onClick={() => setPieKey(k)}>{metas[k].label}</button>
        ))}
      </div>
      <div className="pie-body">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
              innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0];
              const share = total ? (p.value / total * 100).toFixed(1) : 0;
              return (
                <div className="chart-tip">
                  <div className="tip-row" style={{ marginTop: 0 }}>
                    <span className="tip-dot" style={{ background: p.payload.color }} />
                    <span className="tip-name">{p.name}</span>
                    <span className="tip-val">{meta.fmt(p.value)}</span>
                  </div>
                  <div className="tip-share">{share}% of total</div>
                </div>
              );
            }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pie-center">
          <span className="pc-lbl">GEOs</span>
          <span className="pc-val">{data.length}</span>
        </div>
      </div>
      <div className="pie-legend">
        {data.map((d) => (
          <div className="pl-row" key={d.name}>
            <span className="pl-dot" style={{ background: d.color }} />
            <span className="pl-name">{d.name}</span>
            <span className="pl-amt">{meta.fmt(d.value)}</span>
            <span className="pl-val">{total ? (d.value / total * 100).toFixed(0) + '%' : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MetricChart, GeoPie });
