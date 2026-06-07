"""
pull_creatives.py — fetch creative metadata for Sales-campaign ads and write to BigQuery.

Reads ad IDs from BigQuery raw_ad_insights (Sales objective only),
classifies each creative as partners_branded / partners_ig_other / dpa_share /
regular_video / regular_image / unknown.

Run AFTER pull_insights.py:
    python src/ingestion/meta/pull_creatives.py --project aurora-scents

Adapted from Aurora Scents pull_ad_creatives.py.
"""
from __future__ import annotations

import os
import sys
import threading
import time
import yaml
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.adcreative import AdCreative
from facebook_business.api import FacebookAdsApi

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


# Aurora Scents-specific IDs — parameterise per project if/when needed
AURORA_IG_USER_ID = "17841436831636611"


def fetch_creative(ad_id: str) -> dict:
    try:
        ad = Ad(ad_id).api_get(fields=["creative"])
        cdict = dict(ad.get("creative") or {})
        cid = cdict.get("id")
        if not cid:
            return {"ad_id": ad_id, "kind": "unknown", "error": "no_creative_id"}

        creative = AdCreative(cid).api_get(fields=[
            "id", "name", "object_type",
            "video_id", "image_url", "image_hash",
            "object_story_spec",
            "branded_content_sponsor_page_id",
        ])
        d = dict(creative)
        obj_spec = dict(d.get("object_story_spec") or {})
        ig_user = obj_spec.get("instagram_user_id")
        page_id = obj_spec.get("page_id")
        video_data = obj_spec.get("video_data") or {}
        link_data = obj_spec.get("link_data") or {}
        photo_data = obj_spec.get("photo_data") or {}

        bc_sponsor = d.get("branded_content_sponsor_page_id")
        has_branded = bool(bc_sponsor)
        partner_ig = bool(ig_user and ig_user != AURORA_IG_USER_ID)
        has_video = bool(d.get("video_id") or video_data or video_data.get("video_id"))
        has_image = bool(d.get("image_url") or d.get("image_hash") or photo_data or link_data.get("picture"))

        if has_branded:
            kind = "partners_branded"
        elif partner_ig:
            kind = "partners_ig_other"
        elif d.get("object_type") == "SHARE":
            kind = "dpa_share"
        elif has_video:
            kind = "regular_video"
        elif has_image:
            kind = "regular_image"
        else:
            kind = "unknown"

        return {
            "ad_id": ad_id,
            "creative_id": cid,
            "creative_name": d.get("name"),
            "object_type": d.get("object_type"),
            "branded_content_sponsor_page_id": bc_sponsor,
            "instagram_user_id": ig_user,
            "page_id_in_creative": page_id,
            "has_video": has_video,
            "has_image": has_image,
            "kind": kind,
            "_loaded_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as exc:
        return {
            "ad_id": ad_id,
            "kind": "unknown",
            "error": str(exc)[:200],
            "_loaded_at": datetime.utcnow().isoformat() + "Z",
        }


def main() -> None:
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--project", required=True)
    args = p.parse_args()

    cfg = load_project(args.project)
    bq_project = cfg["bigquery"]["project"]
    bq_dataset = cfg["bigquery"]["dataset"]
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

    bq = get_client(creds_path, bq_project)
    ensure_dataset(bq, bq_project, bq_dataset, bq_location)

    # Get Sales ad IDs by joining ad insights with campaign insights on campaign_id
    query = f"""
        SELECT DISTINCT ad_id
        FROM `{bq_project}.{bq_dataset}.raw_ad_insights`
        WHERE campaign_objective = 'OUTCOME_SALES'
          AND ad_id IS NOT NULL
    """
    print("Querying Sales ad IDs from BigQuery...", flush=True)
    ad_ids = [row["ad_id"] for row in bq.query(query).result()]
    print(f"Found {len(ad_ids)} unique Sales ads", flush=True)

    results: list[dict] = []
    lock = threading.Lock()
    done_count = [0]

    def worker(ad_id: str) -> None:
        res = fetch_creative(ad_id)
        with lock:
            results.append(res)
            done_count[0] += 1
            if done_count[0] % 50 == 0:
                print(f"  {done_count[0]}/{len(ad_ids)} done", flush=True)
        time.sleep(0.15)

    with ThreadPoolExecutor(max_workers=6) as ex:
        list(ex.map(worker, ad_ids))

    errors = sum(1 for r in results if "error" in r)
    print(f"Fetched {len(results)} creatives ({errors} errors)", flush=True)

    load_rows(bq, bq_project, bq_dataset, "creatives", results)
    print("Done.")


if __name__ == "__main__":
    main()
