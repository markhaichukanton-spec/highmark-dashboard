"""
tmp_export_daily.py — pull one day of ad-level stats and export to CSV.

Each row = date × country × device × placement × campaign × adset × ad

Usage:
    python src/tmp_export_daily.py --project aurora-scents
    python src/tmp_export_daily.py --project aurora-scents --date 2026-06-01

Output: dist/<project>_raw_<date>.csv
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
import yaml

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env", override=False)
load_dotenv(ROOT / "secrets" / ".env", override=False)

COUNTRY_NAMES: dict[str, str] = {
    "AE": "UAE", "US": "USA", "QA": "Qatar", "SA": "Saudi Arabia",
    "IQ": "Iraq", "NG": "Nigeria", "KE": "Kenya", "CA": "Canada",
    "PY": "Paraguay", "BR": "Brazil", "OM": "Oman", "KW": "Kuwait",
    "JO": "Jordan", "LB": "Lebanon", "EG": "Egypt", "GB": "UK",
    "DE": "Germany", "FR": "France", "IT": "Italy", "ES": "Spain",
    "TR": "Turkey", "PK": "Pakistan", "IN": "India", "AU": "Australia",
    "ZA": "South Africa", "MA": "Morocco", "DZ": "Algeria",
}


def _extract_action(lst: list | None, *types: str) -> float:
    if not lst:
        return 0.0
    for item in lst:
        if item.get("action_type") in types:
            try:
                return float(item["value"])
            except (KeyError, ValueError, TypeError):
                pass
    return 0.0


def pull_day(account: AdAccount, target_date: str) -> list[dict]:
    fields = [
        "campaign_id", "campaign_name", "objective",
        "adset_id", "adset_name",
        "ad_id", "ad_name",
        "spend", "impressions", "clicks", "reach",
        "actions", "action_values",
        "date_start",
    ]
    params = {
        "time_range": {"since": target_date, "until": target_date},
        "time_increment": "1",
        "level": "ad",
        "fields": fields,
        "breakdowns": ["country", "impression_device", "publisher_platform", "platform_position"],
        "limit": 5000,
    }
    cursor = account.get_insights(params=params)
    rows = [dict(r) for r in cursor]
    while cursor.load_next_page():
        rows.extend(dict(r) for r in cursor)
    return rows


def flatten(rows: list[dict], account_id: str) -> list[dict]:
    out = []
    for r in rows:
        spend = float(r.get("spend") or 0)
        impressions = int(r.get("impressions") or 0)
        clicks = int(r.get("clicks") or 0)
        purchases = int(_extract_action(r.get("actions"), "purchase", "omni_purchase"))
        revenue = _extract_action(r.get("action_values"), "purchase", "omni_purchase")
        country_code = r.get("country", "")
        country = COUNTRY_NAMES.get(country_code, country_code)

        out.append({
            "Date":               r.get("date_start"),
            "Source":             "meta",
            "Account ID":         account_id,
            "GEO":                country,
            "Device":             r.get("impression_device"),
            "Publisher Platform": r.get("publisher_platform"),
            "Platform Position":  r.get("platform_position"),
            "Campaign ID":        r.get("campaign_id"),
            "Campaign Name":      r.get("campaign_name"),
            "Campaign Objective": r.get("objective"),
            "Ad Set ID":          r.get("adset_id"),
            "Ad Set Name":        r.get("adset_name"),
            "Ad ID":              r.get("ad_id"),
            "Ad Name":            r.get("ad_name"),
            "Impressions":        impressions,
            "Clicks":             clicks,
            "Spend":              spend,
            "Purchases":          purchases,
            "Revenue":            revenue,
            "Reach":              int(r.get("reach") or 0),
        })
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--date", default=(date.today() - timedelta(days=1)).isoformat())
    args = parser.parse_args()

    cfg_path = ROOT / "src" / "config" / f"{args.project}.yaml"
    with open(cfg_path) as f:
        cfg = yaml.safe_load(f)

    token = os.environ.get("META_ACCESS_TOKEN") or os.environ.get("ACCESS_TOKEN")
    if not token:
        sys.exit("ERROR: META_ACCESS_TOKEN missing")

    FacebookAdsApi.init(access_token=token)
    account = AdAccount(cfg["meta"]["ad_account_id"])

    print(f"Pulling {args.date} (ad level + country + device + placement)...", flush=True)
    raw = pull_day(account, args.date)
    print(f"  {len(raw)} rows from Meta API", flush=True)

    df = pd.DataFrame(flatten(raw, cfg["meta"]["ad_account_id"]))
    df = df[df["Spend"] > 0].copy()
    df.sort_values("Spend", ascending=False, inplace=True)
    df.reset_index(drop=True, inplace=True)

    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    out_path = dist / f"{args.project}_raw_{args.date}.csv"
    df.to_csv(out_path, index=False, encoding="utf-8-sig")

    print(f"Saved {len(df)} rows -> {out_path}")
    print(df[["Date","GEO","Campaign Name","Ad Set Name","Ad Name","Spend","Purchases","Revenue"]].to_string(index=False))


if __name__ == "__main__":
    main()
