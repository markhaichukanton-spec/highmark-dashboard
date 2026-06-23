# Контракт данных — Meta Ads Dashboard

Это **единственное, что нужно реализовать на бэкенде.** Весь фронтенд уже
отрисован и работает: он читает один объект `DATA` (см. `design/dash-data.r2.jsx`).
«Натянуть на базу» = вернуть из API JSON в форме, описанной ниже, и отдать его
во фронт вместо мок-массивов.

Фронт **сам считает** производные метрики (`cr, ctr, cpc, cpm, cpo, aov`) из
сырых полей, поэтому бэкенду их возвращать **не обязательно** — достаточно
«сырых» полей (`spend, revenue, roas, purchases, clicks, impressions`). Что
именно является сырым, отмечено ниже.

---

## Запрос

Дашборд — это один экран с фильтрами. Один эндпоинт на всё:

```
GET /api/dashboard
  ?from=2026-05-26          # начало периода (ISO date)
  &to=2026-06-01            # конец периода (ISO date)
  &granularity=day          # day | week | month | quarter | year  → бьёт SERIES
  &compare=previous_period  # previous_period | previous_year | none → считает delta у KPI
  &source=Meta              # повторяемые параметры фильтров (любой можно опустить = «все»)
  &geo=United Arab Emirates
  &campaign_type=Sales
  &device=Mobile
  &campaign=...
  &adset=...
  &ad=...
```

Ответ — один JSON-объект с пятью секциями: `kpis`, `series`, `geo`, `table`, `filters`.

---

## 1. `kpis` — плитки ключевых метрик (ровно 10)

```jsonc
{
  "label": "ROAS",            // подпись плитки
  "seriesKey": "roas",        // связь с графиком/донатом — НЕ менять набор ключей
  "value": 2.7244,            // текущее значение (сырое число)
  "unit": "ratio",            // как форматировать: ratio | percent | currency | currency0 | number
  "deltaPct": 28.1,           // % изменения к сравниваемому периоду (знак = направление)
  "sub": "Return on ad spend" // мелкий пояснительный текст
}
```

Набор `seriesKey` фиксирован и должен присутствовать целиком, в этом порядке:
`roas, purchases, revenue, spend, cpm, ctr, cr, aov, cpo, cpc`.

> В текущем макете `value`/`delta` приходят уже строками (`"272.44%"`, `"+28.1%"`).
> Рекомендуется отдавать **числа** + `unit` и форматировать на фронте (`fmt.*` уже
> есть). `up` (рост/падение) фронт вычислит из знака `deltaPct`.
> `unit` по метрикам: roas→ratio, purchases→number, revenue/spend→currency0,
> ctr/cr→percent, aov/cpo/cpc/cpm→currency.

## 2. `series` — временной ряд (по гранулярности)

Массив точек. Каждая точка — **только сырые поля**, остальное фронт досчитает:

```jsonc
{
  "period": "2026-05-26",  // ISO; ключ сортировки
  "label": "May 26",       // готовая подпись оси X (бэкенд формирует под granularity)
  "spend": 2200,
  "revenue": 5720,
  "roas": 2.60,
  "clicks": 1850,
  "purchases": 18,
  "impressions": 176000
}
```

Фронт добавит к каждой точке: `cr = purchases/clicks*100`, `ctr = clicks/impressions*100`,
`cpc = spend/clicks`, `cpm = spend/impressions*1000`, `cpo = spend/purchases`,
`aov = revenue/purchases`. (Деление на ноль → 0.)

## 3. `geo` — разбивка по странам (горизонтальные бары)

Массив, **сырые поля** (как у series, плюс `geo`):

```jsonc
{ "geo": "UAE", "spend": 1800, "revenue": 6840, "roas": 3.8,
  "purchases": 52, "clicks": 19800, "impressions": 1085000 }
```

Производные считаются так же. Виджет «By GEO» рисует горизонтальный bar-chart
(одна полоса на страну, отсортированы по убыванию), подпись каждой полосы —
значение + доля в % от суммы. Переключатель Revenue / Spend / Purchases выбирает
метрику. Строки с нулевым значением выбранной метрики
автоматически прячутся (напр. Nigeria с revenue=0).

## 4. `table` — дерево Кампания → Адсет → Объявление

Рекурсивная структура. Узел любого уровня:

```jsonc
{
  "campaign": "UAE | ROAS | Sales", // присутствует на всех уровнях
  "adset": null,                    // null на уровне кампании
  "ad": null,                       // null на уровнях кампании/адсета
  "spend": 1800, "revenue": 6840, "roas": 3.8,
  "purchases": 52, "clicks": 19800, "impressions": 1085000,
  "children": [ /* узлы того же вида; у листа children отсутствует/пуст */ ]
}
```

Подпись строки фронт берёт по глубине: уровень 0 → `campaign`, 1 → `adset`, 2 → `ad`.
Сортировка по колонкам и раскрытие/сворачивание — целиком на фронте.
Цвет ячейки ROAS: ≥3.0 зелёная, <2.0 красная — порог зашит во фронте.

## 5. `filters` — доступные значения фильтров

```jsonc
{
  "Source": ["All sources", "Meta", "Instagram", "Facebook", "Audience Network"],
  "GEO": ["All GEOs", "United Arab Emirates", "Saudi Arabia", "Nigeria", "Kuwait", "Qatar"],
  "Campaign Type": ["All types", "Sales", "Prospecting", "Top Funnel", "Retargeting"],
  "Device": ["All devices", "Mobile", "Desktop", "Tablet"],
  "Campaign": ["All campaigns", "..."],
  "Adset": ["All adsets", "..."],
  "Ad": ["All ads", "..."]
}
```

**Важно:** первый элемент каждого массива — это метка «Все …» (псевдо-опция).
Реальные значения идут со второго. Пустой выбор во фронте === «все».

---

## Что НЕ из базы

`METRIC_META`, `GEO_COLORS`, `COLORS`, форматтеры `fmt` — это статическая
конфигурация представления (оси, цвета, формат). Оставить во фронте как есть.

См. `api-response.example.json` — полный валидный ответ, и `data-loader.example.js`
— готовый адаптер «ответ API → объект DATA».
