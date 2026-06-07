# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**High Mark Agency Platform** — agentic analytics and advertising management platform. Aggregates data from ad channels and analytics systems, delivers AI-powered insights, and alerts when KPIs deviate from targets.

Two primary use cases:
1. **Ongoing project management** — continuous monitoring, alerts, AI recommendations for active ad accounts
2. **Presale audits** — rapid onboarding to a new client, deep analysis, exportable slide deck

---

## Commands

```powershell
# Python env (Windows)
python -m venv .venv; .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # then fill in values

# Meta ingestion → BigQuery (full history from 2025-01-01 already loaded)
# Daily refresh: pull last 3 days to catch delayed conversions
python src/ingestion/meta/pull_insights.py --project aurora-scents --since 2026-06-01
# Re-pull specific range:
python src/ingestion/meta/pull_insights.py --project aurora-scents --since 2025-01-01 --until 2025-12-31

# Creative metadata (run after pull_insights)
python src/ingestion/meta/pull_creatives.py --project aurora-scents

# Quick CSV export for one day
python src/tmp_export_daily.py --project aurora-scents --date 2026-06-03

# (future) Next.js app
cd app && npm install && npm run dev
```

Environment variables: `secrets/.env`. Project configs: `src/config/<project-id>.yaml`.

---

## Architecture

### Current state (MVP)

```
Meta Marketing API ──> src/ingestion/meta/pull_insights.py ──> BigQuery raw_ad_insights
                                                                      │
Meta Marketing API ──> src/ingestion/meta/pull_creatives.py ──> BigQuery raw_ad_creatives
                                                                      │
                                                             Looker Studio dashboard
                                                          (source: raw_ad_insights only)

Cloud Scheduler (05:00 Asia/Dubai daily)
  └──> Cloud Function highmark-daily-refresh (europe-west1)
         └──> DELETE last 3 days + pull from Meta API + APPEND to raw_ad_insights
```

### Target state (Phase 2+)

```
Meta API ──────────────┐
Google Ads API ─────────┤──> BigQuery raw ──> dbt staging ──> dbt marts ──┬─> Next.js app (/app)
GA4 (native BQ export) ┤                                                   ├─> Looker Studio
Shopify API ────────────┘                                                  ├─> Claude assistant
                                                                           ├─> Alerts runner
                                                                           └─> Presale audit/PPTX
```

---

## Project Config — Single Source of Truth

Every client project is defined in `src/config/<id>.yaml`:

```yaml
project_id: aurora-scents
meta:
  ad_account_id: act_XXXXXX
bigquery:
  project: aurora-scents-494012
  dataset: meta_ads
  location: EU
kpi_targets:
  target_roas: 3.0
  target_cpa: null
brief: "..."
```

The `--project <id>` flag is used by all CLI entry points to locate this YAML.

---

## BigQuery Schema (finalized)

Dataset: `meta_ads` | GCP project: `aurora-scents-494012` | Region: EU

### One flat table — `raw_ad_insights`

This is the **only source for Looker Studio**. One row = date × country × campaign × adset × ad.

| # | Column | Type | Notes |
|---|--------|------|-------|
| 1 | `date` | DATE | Daily granularity |
| 2 | `source` | STRING | Always "meta" |
| 3 | `account_id` | STRING | Meta ad account ID |
| 4 | `country` | STRING | ISO country code |
| 5 | `campaign_id` | STRING | |
| 6 | `campaign_name` | STRING | |
| 7 | `campaign_objective` | STRING | e.g. OUTCOME_SALES |
| 8 | `adset_id` | STRING | |
| 9 | `adset_name` | STRING | |
| 10 | `ad_id` | STRING | |
| 11 | `ad_name` | STRING | |
| 12 | `impressions` | INT64 | |
| 13 | `clicks` | INT64 | |
| 14 | `spend` | FLOAT64 | |
| 15 | `purchases` | INT64 | |
| 16 | `revenue` | FLOAT64 | purchase_value from Meta API |
| 17 | `reach` | INT64 | Not additive across rows |
| — | `_loaded_at` | TIMESTAMP | Technical, not a data column |

Partitioned by `date` (MONTH).

Meta breakdowns: `["country"]` only. Adding placement/device breakdowns is blocked by Meta API when
`actions`/`action_values` (purchases/revenue) are requested — Meta implicitly adds `action_type` which
exhausts the breakdown combination limit. Phase 2: use async AdReportRun API for placement data.

### ⚠️ Raw metrics only — NO calculated fields anywhere

**NEVER** store or export: ROAS, CTR, CPC, CPM, CPO, CR, Frequency, Avg Check, or any metric requiring division.

These aggregate incorrectly when summed across rows. Build them in Looker Studio as SUM()-based formulas:
- ROAS = SUM(revenue) / SUM(spend)
- CTR = SUM(clicks) / SUM(impressions)
- CPC = SUM(spend) / SUM(clicks)
- etc.

`reach` is also not additive across rows (same user counted multiple times across days/countries/ads) — use with caution in LS.

### Supporting table — `raw_ad_creatives`

Creative metadata for future creative analysis. Not a Looker Studio source.
Schema defined in `src/ingestion/common/bq_writer.py` → `SCHEMAS["creatives"]`.

---

## CSV Export Format

`src/tmp_export_daily.py` exports one day to `dist/<project>_raw_<date>.csv`.

Same 17 columns as `raw_ad_insights`, human-readable headers:
```
Date, Source, Account ID, GEO, Campaign ID, Campaign Name, Campaign Objective,
Ad Set ID, Ad Set Name, Ad ID, Ad Name,
Impressions, Clicks, Spend, Purchases, Revenue, Reach
```

---

## Meta API Patterns (validated)

- **SDK**: `facebook-business` >= 18.0.0 (official Meta SDK via PyPI)
- **Auth**: `META_ACCESS_TOKEN` or `ACCESS_TOKEN` from `secrets/.env`
- **Level**: always `"ad"` with `breakdowns: ["country"]`
- **Granularity**: `time_increment: "1"` (daily)
- **Chunking**: `week_chunks()` — 7-day windows prevent rate limits with daily+country
- **Page limit**: 5000 rows per page; cursor-based pagination; 0.5s sleep between pages
- **Retry backoff**: 15s → 30s → 60s → 120s → 240s (5 attempts)
  - Code 2 "Service temporarily unavailable": needs ~60s to clear
  - Code 4 "Application request limit reached": wait ~70s before retrying

## BQ Write Patterns (validated)

- **Load method**: `load_table_from_file()` with NDJSON
- **Streaming**: first chunk = WRITE_TRUNCATE (drops table), subsequent = WRITE_APPEND
- **Schema changes**: `delete_table(not_found_ok=True)` auto-called on first chunk
- **`_loaded_at`**: `datetime.now(timezone.utc)` — never `utcnow()` (deprecated in Python 3.12)
- Schema defined in `src/ingestion/common/bq_writer.py` → `SCHEMAS["ad_insights"]`

---

## Current State (as of 2026-06-04)

| Table | State |
|-------|-------|
| `raw_ad_insights` | **50,999 rows**, 2025-01-01 → 2026-06-04, full history loaded |
| `raw_ad_creatives` | 2,382 rows — valid, untouched |

**Next steps (priority order):**
1. Looker Studio dashboard — connect `raw_ad_insights`, build calculated fields in LS
2. GA4 → BQ — native BigQuery export in GA4 console
3. Google Ads → BQ — BigQuery Data Transfer Service

---

## Alerts and Diagnostics (planned)

Root-cause analysis runs in this fixed order when KPI deviates from target:

1. Product availability on landing pages
2. Landing page 404 / accessibility errors
3. CPC / CTR / CVR changes
4. Distribution shifts — geo, device, daypart

---

## Integration Architecture

Priority order when adding a new data source:

1. **Official MCP servers** — check what exists before implementing anything else
2. **Native platform APIs** — Google Ads API, Meta Marketing API, Shopify Admin/Storefront API
3. **Claude Code Skills** — for reusable analytical workflows

**Meta note:** Meta's official MCP (`https://mcp.facebook.com/ads`) works in Claude Desktop / claude.ai only — NOT in Claude Code. Use the `facebook-business` Python SDK here.

**Currently implemented:** Meta (Marketing API → BigQuery). Everything else is planned.
