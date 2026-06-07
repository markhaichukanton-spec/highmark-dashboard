# Looker Studio Dashboard Spec — Aurora Scents MVP

**Data source:** `aurora-scents-494012.meta_ads.raw_ad_insights` (BigQuery connector)
**Audience:** High Mark team + Aurora Scents client (view-only link)

---

## 1. Data Source Setup

1. Open [lookerstudio.google.com](https://lookerstudio.google.com) → Create → Report
2. Add data → BigQuery → Project: `aurora-scents-494012` → Dataset: `meta_ads` → Table: `raw_ad_insights`
3. Click **Add to report**

---

## 2. Calculated Fields

In the data source editor, create these fields:

| Field Name | Formula | Format |
|------------|---------|--------|
| `ROAS` | `SUM(revenue) / SUM(spend)` | Number, 2 decimals |
| `CPO` | `SUM(spend) / SUM(purchases)` | Number, 2 decimals (AED) |
| `CR` | `SUM(purchases) / SUM(clicks)` | Percent, 2 decimals |
| `CTR` | `SUM(clicks) / SUM(impressions)` | Percent, 2 decimals |
| `CPC` | `SUM(spend) / SUM(clicks)` | Number, 2 decimals (AED) |
| `CPM` | `SUM(spend) / SUM(impressions) * 1000` | Number, 2 decimals (AED) |

> All use SUM()-based aggregation — safe to filter and drill down.

---

## 3. Page Layout

### Canvas size: 1440×900 (Widescreen)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo 120×40px]    Aurora Scents · Meta Ads Performance        │
│                                          [Date range] [▲ vs prev]│
├─────────────────────────────────────────────────────────────────┤
│  ROW 1 (filters):                                               │
│  Source ▾  GEO ▾  Device ▾  Publisher ▾  Position ▾  Camp.Type▾│
│  Campaign ▾  Adset ▾  Ad ▾                                      │
├─────────────────────────────────────────────────────────────────┤
│  ROW 2 (KPI scorecards, 8 cards × equal width):                 │
│  ROAS | Purchases | CPO | CR | CTR | CPC | CPM | Revenue        │
│  (each card: value + Δ% vs prev period)                         │
├─────────────────────────────────────────────────────────────────┤
│  ROW 3 (granularity control):                                   │
│  [Date granularity: Day / Week / Month / Quarter / Year]        │
├────────────────────┬────────────────────┬───────────────────────┤
│  Chart 1           │  Chart 2           │  Chart 3              │
│  Spend+Revenue     │  Clicks vs CPC     │  Purchases vs CPO     │
│  vs ROAS           │                    │                        │
├─────────────────────────────────────────────────────────────────┤
│  Summary Table (drill-down: Campaign → Adset → Ad)              │
│  ROAS | Purchases | Spend | CPO | CR | Revenue | CPM | CPC |   │
│  Clicks | Impressions                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Filters

Add as **Filter controls** (Insert → Filter control). Each linked to all charts + table.

| Control | Field | Type |
|---------|-------|------|
| Date range | `date` | Date range control — enable "Comparison date range" |
| Source | `source` | Dropdown |
| GEO | `country` | Dropdown |
| Campaign Type | `campaign_objective` | Dropdown |
| Campaign | `campaign_name` | Dropdown |
| Adset | `adset_name` | Dropdown |
| Ad | `ad_name` | Dropdown |

> **Device / Placement filters** — не добавляются в MVP. Meta API блокирует сочетание
> `country` + любой второй breakdown при наличии полей `actions`/`action_values` (покупки, выручка).
> Phase 2: отдельный pull через async AdReportRun + отдельная таблица `raw_ad_placements`.
> Тогда в LS появится blended source с Publisher/Position фильтрами.

---

## 5. KPI Scorecards

Insert → Scorecard. Create 8, place in a row.

| # | Metric | Field | Format |
|---|--------|-------|--------|
| 1 | ROAS | `ROAS` (calculated) | Number, 2 dec |
| 2 | Purchases | `purchases` | Integer |
| 3 | CPO | `CPO` (calculated) | Number, 2 dec |
| 4 | CR | `CR` (calculated) | Percent |
| 5 | CTR | `CTR` (calculated) | Percent |
| 6 | CPC | `CPC` (calculated) | Number, 2 dec |
| 7 | CPM | `CPM` (calculated) | Number, 2 dec |
| 8 | Revenue | `revenue` | Number, 2 dec |

For each scorecard:
- Enable **"Show comparison period"** → shows Δ% vs previous period automatically
- Set comparison period type: **Previous period**

---

## 6. Date Granularity Control

Insert → Date range control → type: **Granularity**.
Options: Day, Week, Month, Quarter, Year.
Link to all 3 combo charts (same data source filter).

---

## 7. Charts

### Chart 1 — Spend & Revenue vs ROAS

- Type: **Combo chart** (bar + line)
- X-axis: `date` (granularity from control above)
- Bar series (Left Y): `spend` (blue), `revenue` (green)
- Line series (Right Y): `ROAS` (orange)
- Right Y-axis label: "ROAS"
- Add **Constant line** on Right Y = `3.0` (ROAS target, dashed red)
- Style: bars stacked = NO, enable dual Y-axis

### Chart 2 — Clicks vs CPC

- Type: **Combo chart** (bar + line)
- X-axis: `date`
- Bar series (Left Y): `clicks` (blue)
- Line series (Right Y): `CPC` (orange)
- Enable dual Y-axis

### Chart 3 — Purchases vs CPO

- Type: **Combo chart** (bar + line)
- X-axis: `date`
- Bar series (Left Y): `purchases` (blue)
- Line series (Right Y): `CPO` (orange)
- Enable dual Y-axis

---

## 8. Summary Table

- Type: **Table with row drill-down** (Pivot table → Rows drill-down)
- Row dimension 1: `campaign_name`
- Row dimension 2: `adset_name`
- Row dimension 3: `ad_name`
- Metrics (columns):

| Column | Field | Format |
|--------|-------|--------|
| ROAS | `ROAS` | Number, 2 dec |
| Purchases | `purchases` | Integer |
| Spend | `spend` | Number, 2 dec |
| CPO | `CPO` | Number, 2 dec |
| CR | `CR` | Percent |
| Revenue | `revenue` | Number, 2 dec |
| CPM | `CPM` | Number, 2 dec |
| CPC | `CPC` | Number, 2 dec |
| Clicks | `clicks` | Integer |
| Impressions | `impressions` | Integer |

**Conditional formatting on ROAS column:**
- Rule 1: value ≥ 3.0 → background: #d4edda (light green)
- Rule 2: value < 2.0 → background: #f8d7da (light red)

---

## 9. Sharing

1. Click **Share** (top right)
2. Manage access → **Anyone with the link** → **Viewer**
3. Send link to Aurora Scents client

Optional: Add High Mark logo as Image element (Insert → Image → upload logo file from `assets/brand/`)

---

## 10. Notes on Reach & Frequency

- Do **not** add `SUM(reach)` as a general metric — it is not additive (same user counted across multiple rows)
- If Frequency is needed: only show it with filters narrowed to one country + short date range
- Formula if needed: `SUM(impressions) / SUM(reach)` — label clearly as "approximate"
