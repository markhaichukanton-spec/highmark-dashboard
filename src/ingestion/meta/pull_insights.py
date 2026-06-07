"""
pull_insights.py — Meta Marketing API: pull one flat ad-level table.

One row = date × country × campaign × adset × ad.
Writes to BigQuery raw_ad_insights (17 columns + _loaded_at).

Usage:
    python src/ingestion/meta/pull_insights.py --project aurora-scents --since 2026-01-01
    python src/ingestion/meta/pull_insights.py --project aurora-scents --since 2026-05-01 --until 2026-05-31
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import yaml
from datetime import date, datetime, timedelta, timezone
UTC = timezone.utc
from pathlib import Path

from dotenv import load_dotenv
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env", override=False)
load_dotenv(ROOT / "secrets" / ".env", override=False)

sys.path.insert(0, str(ROOT / "src"))
from ingestion.common.bq_writer import get_client, ensure_dataset, load_rows


def load_project(project_id: str) -> dict:
    path = ROOT / "src" / "config" / f"{project_id}.yaml"
    if not path.exists():
        sys.exit(f"ERROR: config not found: {path}")
    with open(path) as f:
        return yaml.safe_load(f)


FIELDS = [
    "campaign_id", "campaign_name", "objective",
    "adset_id", "adset_name",
    "ad_id", "ad_name",
    "spend", "impressions", "clicks", "reach",
    "actions", "action_values",
    "date_start",
]


def _extract_action(lst: list | None, *action_types: str) -> float:
    if not lst:
        return 0.0
    for item in lst:
        if item.get("action_type") in action_types:
            try:
                return float(item["value"])
            except (KeyError, ValueError, TypeError):
                pass
    return 0.0


def flatten_row(row: dict, account_id: str) -> dict:
    actions = row.get("actions") or []
    action_values = row.get("action_values") or []
    return {
        "date":               row.get("date_start"),
        "source":             "meta",
        "account_id":         account_id,
        "country":            row.get("country"),
        "campaign_id":        row.get("campaign_id"),
        "campaign_name":      row.get("campaign_name"),
        "campaign_objective": row.get("objective"),
        "adset_id":           row.get("adset_id"),
        "adset_name":         row.get("adset_name"),
        "ad_id":              row.get("ad_id"),
        "ad_name":            row.get("ad_name"),
        "impressions":        int(row.get("impressions") or 0),
        "clicks":             int(row.get("clicks") or 0),
        "spend":              float(row.get("spend") or 0),
        "purchases":          int(_extract_action(actions, "purchase", "omni_purchase")),
        "revenue":            _extract_action(action_values, "purchase", "omni_purchase"),
        "reach":              int(row.get("reach") or 0),
        "_loaded_at":         datetime.now(UTC).isoformat(),
    }


def week_chunks(since: str, until: str):
    s = datetime.fromisoformat(since).date()
    u = datetime.fromisoformat(until).date()
    cur = s
    while cur <= u:
        chunk_end = min(cur + timedelta(days=6), u)
        yield cur.isoformat(), chunk_end.isoformat()
        cur = chunk_end + timedelta(days=1)


def pull_chunk(account: AdAccount, since: str, until: str) -> list:
    params = {
        "time_range": {"since": since, "until": until},
        "time_increment": "1",
        "level": "ad",
        "fields": FIELDS,
        "breakdowns": ["country"],
        "limit": 5000,
    }
    cursor = account.get_insights(params=params)
    rows = [dict(r) for r in cursor]
    while cursor.load_next_page():
        rows.extend(dict(r) for r in cursor)
        time.sleep(0.5)
    return rows


def pull_all(account: AdAccount, since: str, until: str, account_id: str):
    """Yield (label, flat_rows) for each weekly chunk, with retry logic."""
    print(f"Pulling {since} -> {until} (ad level + country)", flush=True)
    total = 0
    for cs, ce in week_chunks(since, until):
        attempt = 0
        while True:
            try:
                chunk = pull_chunk(account, cs, ce)
                break
            except Exception as exc:
                attempt += 1
                if attempt >= 6:
                    raise
                wait = 15 * (2 ** (attempt - 1))
                print(f"  [{cs}->{ce}] retry {attempt}/5 in {wait}s ({type(exc).__name__})", flush=True)
                time.sleep(wait)

        flat = [flatten_row(r, account_id) for r in chunk]
        total += len(flat)
        print(f"  [{cs}->{ce}] +{len(flat)} rows (total {total})", flush=True)
        yield f"{cs}->{ce}", flat
        time.sleep(1.5)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--project", required=True)
    p.add_argument("--since", default="2025-01-01")
    p.add_argument("--until", default=date.today().isoformat())
    args = p.parse_args()

    cfg = load_project(args.project)
    account_id = cfg["meta"]["ad_account_id"]
    bq_project  = cfg["bigquery"]["project"]
    bq_dataset  = cfg["bigquery"]["dataset"]
    bq_location = cfg["bigquery"].get("location", "EU")

    creds_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if creds_env:
        creds_path = Path(creds_env) if Path(creds_env).is_absolute() else ROOT / creds_env
    else:
        candidates = list((ROOT / "secrets").glob("*.json"))
        if not candidates:
            sys.exit("ERROR: No service account JSON found in secrets/")
        creds_path = candidates[0]

    token = os.environ.get("META_ACCESS_TOKEN") or os.environ.get("ACCESS_TOKEN")
    if not token:
        sys.exit("ERROR: META_ACCESS_TOKEN (or ACCESS_TOKEN) missing in .env")

    FacebookAdsApi.init(access_token=token)
    account = AdAccount(account_id)

    bq = get_client(creds_path, bq_project)
    ensure_dataset(bq, bq_project, bq_dataset, bq_location)

    first_chunk = True
    for _label, rows in pull_all(account, args.since, args.until, account_id):
        if rows:
            load_rows(bq, bq_project, bq_dataset, "ad_insights", rows, append=not first_chunk)
            first_chunk = False

    print("Done.")


if __name__ == "__main__":
    main()
