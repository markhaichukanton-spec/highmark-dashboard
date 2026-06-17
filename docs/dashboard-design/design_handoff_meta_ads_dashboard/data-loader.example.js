/* ────────────────────────────────────────────────────────────────────────
   data-loader.example.js
   Адаптер «ответ API → объект DATA», который ждёт фронтенд.

   ЕДИНСТВЕННАЯ точка подключения базы. Сейчас данные зашиты в
   dash-data.r2.jsx (мок). Чтобы перейти на живые данные:

   1. Поднимите эндпоинт GET /api/dashboard (см. DATA_CONTRACT.md).
   2. Замените статический объект DATA в dash-data.r2.jsx на результат
      loadDashboard(...) — пример внизу файла.

   Производные метрики (cr/ctr/cpc/cpm/cpo/aov) считаются ЗДЕСЬ, чтобы бэкенд
   возвращал только сырые поля.
   ──────────────────────────────────────────────────────────────────────── */

// добавляет производные метрики к «сырой» строке (series / geo / table-node)
function withDerived(d) {
  const clicks = d.clicks || 0, imp = d.impressions || 0, pur = d.purchases || 0;
  return {
    ...d,
    cr:  clicks ? +((pur / clicks) * 100).toFixed(2) : 0,
    ctr: imp    ? +((clicks / imp) * 100).toFixed(2) : 0,
    cpc: clicks ? +(d.spend / clicks).toFixed(2)     : 0,
    cpm: imp    ? +((d.spend / imp) * 1000).toFixed(2) : 0,
    cpo: pur    ? +(d.spend / pur).toFixed(2)         : 0,
    aov: pur    ? +(d.revenue / pur).toFixed(2)       : 0,
  };
}

// рекурсивно прогоняет дерево таблицы через withDerived
function deriveTree(nodes) {
  return (nodes || []).map((n) => ({
    ...withDerived(n),
    children: n.children ? deriveTree(n.children) : undefined,
  }));
}

// форматирование KPI-значения по unit (фронтовый fmt уже есть в dash-data.r2.jsx)
function formatKpi(value, unit) {
  switch (unit) {
    case 'ratio':     return value.toFixed(2);
    case 'percent':   return value.toFixed(2) + '%';
    case 'currency':  return fmt.currency(value);
    case 'currency0': return fmt.currency0(value);
    case 'number':    return fmt.number(value);
    default:          return String(value);
  }
}

// строит KPIS в форме, которую рисует KPIRow (value/delta — строки, up — bool)
function adaptKpis(kpis) {
  return kpis.map((k) => ({
    label: k.label,
    seriesKey: k.seriesKey,
    value: formatKpi(k.value, k.unit),
    delta: (k.deltaPct >= 0 ? '+' : '') + k.deltaPct.toFixed(1) + '%',
    up: k.deltaPct >= 0,
    sub: k.sub,
  }));
}

// собирает строку query из параметров фильтров/периода
function buildQuery({ from, to, granularity = 'day', compare = 'previous_period', filters = {} } = {}) {
  const q = new URLSearchParams({ from, to, granularity, compare });
  for (const [key, values] of Object.entries(filters)) {
    // ключ фильтра в snake_case; пустой массив === «все» (не отправляем)
    const param = key.toLowerCase().replace(/\s+/g, '_');
    (values || []).forEach((v) => q.append(param, v));
  }
  return q.toString();
}

/* ГЛАВНАЯ ФУНКЦИЯ — вызвать вместо чтения мока.
   Возвращает объект DATA точно той формы, что потребляют компоненты. */
async function loadDashboard(params) {
  const res = await fetch('/api/dashboard?' + buildQuery(params), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('dashboard fetch failed: ' + res.status);
  const api = await res.json();

  return {
    // статическая конфигурация представления — НЕ из базы, импортируется из dash-data.r2.jsx
    COLORS,
    METRIC_META,
    GEO_COLORS,
    // данные из API
    KPIS:    adaptKpis(api.kpis),
    SERIES:  api.series.map(withDerived),
    GEO:     api.geo.map(withDerived),
    TABLE:   deriveTree(api.table),
    FILTERS: api.filters,
  };
}

/* ─────────────────────────── КАК ПОДКЛЮЧИТЬ ───────────────────────────────

   В dash-data.r2.jsx сейчас в конце:
       const DATA = { COLORS, KPIS, SERIES, TABLE, FILTERS, METRIC_META, GEO, GEO_COLORS };
       Object.assign(window, { DATA, fmt, COLORS });

   Для живых данных удалите мок-массивы (KPIS/SERIES/GEO/TABLE/FILTERS) и
   оставьте только COLORS, fmt, METRIC_META, GEO_COLORS. Затем в Dashboard()
   (Dashboard.html) загрузите данные асинхронно:

       const [DATA, setDATA] = React.useState(null);
       React.useEffect(() => {
         loadDashboard({
           from: '2026-05-26', to: '2026-06-01',
           granularity: gran.toLowerCase(),
           compare: 'previous_period',
           filters,                          // тот же объект состояния фильтров
         }).then(setDATA);
       }, [gran, filters]);                  // перезапрос при смене периода/фильтров

       if (!DATA) return <DashboardSkeleton />;   // состояние загрузки

   Дальше весь существующий JSX работает без изменений — он уже читает DATA.*.
   ──────────────────────────────────────────────────────────────────────── */

// если нужен модульный импорт:
// export { loadDashboard, withDerived, deriveTree, adaptKpis };
