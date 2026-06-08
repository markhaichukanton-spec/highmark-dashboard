# Claude Design Prompt — High Mark Agency Dashboard (Aurora Scents)

## What to build

A **performance marketing analytics dashboard** for an e-commerce client (Aurora Scents — luxury perfume brand). The dashboard shows Meta Ads data: spend, revenue, ROAS, purchases, and efficiency metrics. It is used by a media buying team and shared with the client as a read-only view.

## Tech stack

- **Next.js 16 App Router**, TypeScript
- **shadcn/ui** components (Card, Badge, Select, Separator, Table, Tabs, Button)
- **Tailwind CSS** for layout and styling
- **Recharts** for all charts
- All components go into `app/src/components/`
- Main page: `app/src/app/page.tsx`

---

## Layout (1440px wide, full-screen analytics style)

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER bg #F4F0E6: High/Mark logo · "Aurora Scents — Meta Ads"  │
│                              [Date range] [vs prev period ▼]    │
├─────────────────────────────────────────────────────────────────┤
│ FILTER BAR bg #EDE6D2: Source ▾  GEO ▾  Campaign Type ▾         │
│                         Campaign ▾  Adset ▾  Ad ▾               │
├─────────────────────────────────────────────────────────────────┤
│ KPI ROW (8 white cards on cream bg):                            │
│ [ROAS] [Purchases] [CPO] [Revenue] [CR] [CTR] [CPC] [CPM]       │
├─────────────────────────────────────────────────────────────────┤
│ Granularity: [Day] [Week] [Month] [Quarter] [Year]              │
├──────────────────┬──────────────────┬───────────────────────────┤
│  Chart 1         │  Chart 2         │  Chart 3                  │
│  Spend+Revenue   │  Clicks vs CPC   │  Purchases vs CPO         │
│  vs ROAS         │                  │                           │
├─────────────────────────────────────────────────────────────────┤
│  Summary Table  Campaign → Adset → Ad (collapsible rows)        │
│  ROAS | Purchases | Spend | CPO | CR | Revenue | Clicks | Impr  │
└─────────────────────────────────────────────────────────────────┘
```

**Header logo:** Render "High**/**Mark" — the slash `/` is `#C9A84C` (Signature Gold), the rest is `#15131A`. Use Cormorant Garamond, weight 600. Below the project name use DM Mono eyebrow: `"AURORA SCENTS · META ADS"` in `#6B6E7A`.

---

## Visual style

This dashboard uses the **High Mark Agency brand system** — warm cream canvas, minimal gold accent, data colors from the channel palette. No blues or greens outside the defined roles below.

### Color tokens (from brand guidelines)

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#F4F0E6` | Page background (Warm Cream) |
| `--paper` | `#FFFFFF` | Card / panel surface |
| `--cream` | `#EDE6D2` | Subtle fills, alternating rows |
| `--ink` | `#15131A` | All text — headlines, values |
| `--gold` | `#C9A84C` | Accent only — active states, key lines, badges |
| `--gold-deep` | `#8E6F3E` | Eyebrow labels, mono uppercased tags |
| `--muted` | `#6B6E7A` | Secondary labels, subtitles |
| `--blue` | `#5B8DEF` | Data — cost metrics (Spend, Clicks) |
| `--violet` | `#7A6ECC` | Data — Meta revenue metrics (Revenue, Purchases) |
| `--line` | `rgba(20,18,30,0.10)` | Borders, dividers |
| `--line-2` | `rgba(20,18,30,0.16)` | Stronger borders on hover/active |
| Midnight Navy | `#080E1A` | Inverse screens only (not used on light bg) |

Gold ratio rule: **90% neutrals (cream / ink / muted), 10% gold**. Gold is never used as a fill.

### Chart colors

| Series | Color | Why |
|--------|-------|-----|
| Spend bars | `#5B8DEF` (Channel Blue) | Cost metric |
| Revenue bars | `#7A6ECC` (Channel Violet) | Meta revenue series |
| ROAS line | `#C9A84C` (Signature Gold) | Key KPI — one gold line per chart |
| Purchases bars | `#7A6ECC` at 70% opacity | Meta conversion series |
| CPO / CPC lines | `#C9A84C` (Gold) | Key efficiency line |
| Clicks bars | `#5B8DEF` at 70% opacity | Volume metric |

Reference line (ROAS target = 3.0): dashed `#C9A84C` at 40% opacity.

### Typography

Three typefaces from the brand system — each has a strict role:

| Face | CSS variable | Role in dashboard |
|------|-------------|-------------------|
| **Cormorant Garamond** | `--serif` | Section headings (`h2`, dashboard title) |
| **DM Sans** | `--sans` | All body text, filter labels, table cells |
| **DM Mono** | `--mono` | KPI values, numeric cells, eyebrow labels (ALL CAPS + tracking) |

Load via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- KPI value: `font-family: DM Mono`, `text-2xl font-medium`, color `--ink`
- KPI label (eyebrow above value): `font-family: DM Mono`, `text-[10px] tracking-[0.2em] uppercase`, color `--muted`
- Section headings: `font-family: Cormorant Garamond`, `font-weight: 500`
- All other UI: `font-family: DM Sans`

### KPI cards

- Background: `--paper` (`#FFFFFF`)
- Border: `1px solid rgba(20,18,30,0.10)`
- Radius: `rounded-xl`
- Shadow: `shadow-sm`
- Hover: border becomes `rgba(20,18,30,0.16)`, shadow lifts slightly

### Table

- Header background: `--cream` (`#EDE6D2`)
- Alternating rows: white / `#F9F7F2` (cream at 50%)
- Sticky header
- Sorted by Spend DESC by default

### ROAS conditional formatting

These are functional semantic colors — use restrained, muted versions consistent with the cream canvas:

- ≥ 3.0 → `#ECFDF0` background with `#15803D` text (muted green)
- < 2.0 → `#FEF2F2` background with `#B91C1C` text (muted red)
- 2.0–2.9 → no background, default `--ink` text

### Currency

AED (UAE Dirham). Format: `"AED 1,234.56"` or `"1,234 AED"` — use `Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' })`.

---

## Component 1 — `<KPICard>`

Props:
```typescript
interface KPICardProps {
  label: string        // e.g. "ROAS"
  value: string        // formatted, e.g. "3.42"
  delta: string        // e.g. "+17.3%" or "-5.1%"
  format: "number" | "percent" | "currency"
  isPositiveGood?: boolean  // false for CPO, CPC, CPM (lower = better)
}
```

Behavior:
- **Eyebrow label** above value: DM Mono, 10px, `tracking-[0.2em] uppercase`, color `#6B6E7A`
- **Value:** DM Mono, `text-2xl font-medium`, color `#15131A`
- **Delta badge** below value: small pill, DM Sans text-xs
  - Improvement → `#ECFDF0` background, `#15803D` text
  - Deterioration → `#FEF2F2` background, `#B91C1C` text
  - For CPO/CPC/CPM: negative delta is green (cheaper = better)
- Hover: border transitions from `rgba(20,18,30,0.10)` → `rgba(20,18,30,0.16)`, shadow lifts

8 cards in order: ROAS · Purchases · CPO · Revenue · CR · CTR · CPC · CPM

---

## Component 2 — `<ComboChart>`

Dual Y-axis chart using Recharts `CompositeChart`. Props:
```typescript
interface ComboChartProps {
  data: Array<{ period: string; barValue1?: number; barValue2?: number; lineValue: number }>
  bar1Label: string   // e.g. "Spend"
  bar2Label?: string  // optional second bar (used for Chart 1 only)
  lineLabel: string   // e.g. "ROAS"
  bar1Color: string
  bar2Color?: string
  lineColor: string
  leftYLabel: string  // e.g. "AED"
  rightYLabel: string // e.g. "ROAS"
  referenceLine?: number  // dashed horizontal line on right Y (ROAS target = 3.0)
  title: string
}
```

Three instances:
1. **Spend & Revenue vs ROAS** — bars: Spend + Revenue (stacked=false), line: ROAS, reference line at 3.0
2. **Clicks vs CPC** — bar: Clicks, line: CPC
3. **Purchases vs CPO** — bar: Purchases, line: CPO

---

## Component 3 — `<FilterBar>`

Dropdowns using shadcn `Select`. All filters are optional (default = "All").

Filters: Source | GEO | Campaign Type | Campaign | Adset | Ad

On filter change → update URL query params (`?since=...&until=...&country=AE&...`) so links are shareable.

---

## Component 4 — `<DateRangePicker>`

Two date inputs (since / until) + "vs previous period" toggle. Previous period = same duration, shifted back.

Default: last 30 days.

---

## Component 5 — `<GranularitySelector>`

Segmented control (button group): Day · Week · Month · Quarter · Year

Selected granularity is passed to timeseries API as `?granularity=DAY`.

---

## Component 6 — `<SummaryTable>`

Collapsible drill-down: Campaign → Adset → Ad (click row to expand).

Columns: ROAS · Purchases · Spend · CPO · CR · Revenue · CPC · CPM · Clicks · Impressions

- ROAS column has conditional background color (green ≥ 3.0, red < 2.0)
- Sorted by Spend DESC by default
- Clicking column headers re-sorts
- Campaign-level rows are bold; adset rows are indented; ad rows are double-indented

---

## API contract (for wiring later — use mock data for prototype)

```typescript
// GET /api/kpi?since=YYYY-MM-DD&until=YYYY-MM-DD
// Returns:
{
  current:  { roas, purchases, cpo, cr, ctr, cpc, cpm, revenue, spend, clicks, impressions },
  previous: { same fields },
  delta:    { roas: "+17.3%", purchases: "+8%", ... }
}

// GET /api/timeseries?since=&until=&granularity=DAY
// Returns:
[{ period: "2026-06-01", spend, revenue, roas, clicks, cpc, purchases, cpo }]

// GET /api/table?since=&until=
// Returns:
[{ campaign_name, adset_name, ad_name, spend, revenue, roas, purchases, cpo, cr, ctr, cpc, cpm, clicks, impressions }]

// GET /api/filters
// Returns:
{ sources, countries, objectives, campaigns, adsets, ads }
```

---

## Mock data for prototype

Use this for all components while API is not connected:

**KPI (current):**
- ROAS: 3.42 (Δ +17.3%)
- Purchases: 120 (Δ +8.5%)
- CPO: 42.50 AED (Δ -12.1%) ← lower is better
- Revenue: 5,100 AED (Δ +27.4%)
- CR: 2.1% (Δ +3.2%)
- CTR: 1.8% (Δ -0.5%)
- CPC: 0.90 AED (Δ -8.2%) ← lower is better
- CPM: 16.20 AED (Δ +1.1%)

**Timeseries (last 7 days):**
```
2026-05-26: spend=380, revenue=1140, roas=3.0, clicks=4200, cpc=0.09, purchases=12, cpo=31.7
2026-05-27: spend=420, revenue=1470, roas=3.5, clicks=4800, cpc=0.09, purchases=15, cpo=28.0
2026-05-28: spend=310, revenue=870,  roas=2.8, clicks=3600, cpc=0.09, purchases=9,  cpo=34.4
2026-05-29: spend=450, revenue=1620, roas=3.6, clicks=5100, cpc=0.09, purchases=18, cpo=25.0
2026-05-30: spend=390, revenue=1365, roas=3.5, clicks=4400, cpc=0.09, purchases=14, cpo=27.9
2026-05-31: spend=510, revenue=1887, roas=3.7, clicks=5800, cpc=0.09, purchases=22, cpo=23.2
2026-06-01: spend=340, revenue=918,  roas=2.7, clicks=3900, cpc=0.09, purchases=10, cpo=34.0
```

**Table rows (campaigns):**
```
UAE | ROAS | Sales → spend=1800, revenue=6840, roas=3.8, purchases=52
KSA | Prospecting → spend=620, revenue=1364, roas=2.2, purchases=14
Nigeria | Top Funnel → spend=290, revenue=0,    roas=0.0, purchases=0
```

---

## Deliverables

1. `page.tsx` — main dashboard page with filter state, date state, granularity state
2. `components/KPICard.tsx`
3. `components/ComboChart.tsx`
4. `components/FilterBar.tsx`
5. `components/DateRangePicker.tsx`
6. `components/GranularitySelector.tsx`
7. `components/SummaryTable.tsx`

All components use mock data by default. Each component exports a clear props interface so API data can be wired in later by replacing mock with `fetch('/api/...')` calls.
