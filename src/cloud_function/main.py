"""
Cloud Function — daily Meta -> BigQuery refresh.
Triggered by Cloud Scheduler via HTTP POST.
Pulls last 3 days to catch delayed conversions.
Auth: ADC (no service account JSON needed in Cloud environment).
"""
import io
import json
import os
import time
import functions_framework
from datetime import date, datetime, timedelta, timezone

UTC = timezone.utc


def get_secret(name: str, project: str) -> str:
    from google.cloud import secretmanager
    client = secretmanager.SecretManagerServiceClient()
    resource = f"projects/{project}/secrets/{name}/versions/latest"
    return client.access_secret_version(name=resource).payload.data.decode("utf-8-sig").strip()


def _extract_action(lst, *action_types):
    if not lst:
        return 0.0
    for item in lst:
        if item.get("action_type") in action_types:
            try:
                return float(item["value"])
            except (KeyError, ValueError, TypeError):
                pass
    return 0.0


FIELDS = [
    "campaign_id", "campaign_name", "objective",
    "adset_id", "adset_name",
    "ad_id", "ad_name",
    "spend", "impressions", "clicks", "reach",
    "actions", "action_values",
    "date_start",
]

SCHEMA_INSIGHTS = [
    {"name": "date",               "type": "DATE"},
    {"name": "source",             "type": "STRING"},
    {"name": "account_id",         "type": "STRING"},
    {"name": "country",            "type": "STRING"},
    {"name": "campaign_id",        "type": "STRING"},
    {"name": "campaign_name",      "type": "STRING"},
    {"name": "campaign_objective", "type": "STRING"},
    {"name": "adset_id",           "type": "STRING"},
    {"name": "adset_name",         "type": "STRING"},
    {"name": "ad_id",              "type": "STRING"},
    {"name": "ad_name",            "type": "STRING"},
    {"name": "impressions",        "type": "INTEGER"},
    {"name": "clicks",             "type": "INTEGER"},
    {"name": "spend",              "type": "FLOAT"},
    {"name": "purchases",          "type": "INTEGER"},
    {"name": "revenue",            "type": "FLOAT"},
    {"name": "reach",              "type": "INTEGER"},
    {"name": "_loaded_at",         "type": "TIMESTAMP"},
]

SCHEMA_PLACEMENTS = [
    {"name": "date",               "type": "DATE"},
    {"name": "source",             "type": "STRING"},
    {"name": "account_id",         "type": "STRING"},
    {"name": "publisher_platform", "type": "STRING"},
    {"name": "platform_position",  "type": "STRING"},
    {"name": "campaign_id",        "type": "STRING"},
    {"name": "campaign_name",      "type": "STRING"},
    {"name": "campaign_objective", "type": "STRING"},
    {"name": "adset_id",           "type": "STRING"},
    {"name": "adset_name",         "type": "STRING"},
    {"name": "ad_id",              "type": "STRING"},
    {"name": "ad_name",            "type": "STRING"},
    {"name": "impressions",        "type": "INTEGER"},
    {"name": "clicks",             "type": "INTEGER"},
    {"name": "spend",              "type": "FLOAT"},
    {"name": "purchases",          "type": "INTEGER"},
    {"name": "revenue",            "type": "FLOAT"},
    {"name": "reach",              "type": "INTEGER"},
    {"name": "_loaded_at",         "type": "TIMESTAMP"},
]


def flatten_insights(row: dict, account_id: str) -> dict:
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


def flatten_placement(row: dict, account_id: str) -> dict:
    actions = row.get("actions") or []
    action_values = row.get("action_values") or []
    return {
        "date":               row.get("date_start"),
        "source":             "meta",
        "account_id":         account_id,
        "publisher_platform": row.get("publisher_platform"),
        "platform_position":  row.get("platform_position"),
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


# Keep old name as alias so nothing else breaks
flatten_row = flatten_insights


def day_chunks(since: str, until: str, step: int = 3):
    s = datetime.fromisoformat(since).date()
    u = datetime.fromisoformat(until).date()
    cur = s
    while cur <= u:
        chunk_end = min(cur + timedelta(days=step - 1), u)
        yield cur.isoformat(), chunk_end.isoformat()
        cur = chunk_end + timedelta(days=1)


def week_chunks(since: str, until: str):
    yield from day_chunks(since, until, step=7)


def pull_chunk_insights(account, since: str, until: str) -> list:
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


def pull_chunk_placements(account, since: str, until: str) -> list:
    params = {
        "time_range": {"since": since, "until": until},
        "time_increment": "1",
        "level": "ad",
        "fields": FIELDS,
        "breakdowns": ["publisher_platform", "platform_position"],
        "limit": 1000,  # smaller pages — placements table is ~5x larger per chunk
    }
    cursor = account.get_insights(params=params)
    rows = [dict(r) for r in cursor]
    while cursor.load_next_page():
        rows.extend(dict(r) for r in cursor)
        time.sleep(0.5)
    return rows


# Keep old name as alias
pull_chunk = pull_chunk_insights


def load_rows(bq, project: str, dataset: str, table: str, schema_def: list, rows: list):
    from google.cloud import bigquery as bq_lib
    table_ref = f"{project}.{dataset}.{table}"
    schema = [bq_lib.SchemaField(f["name"], f["type"]) for f in schema_def]
    job_config = bq_lib.LoadJobConfig(
        schema=schema,
        write_disposition=bq_lib.WriteDisposition.WRITE_APPEND,
        time_partitioning=bq_lib.TimePartitioning(type_=bq_lib.TimePartitioningType.MONTH, field="date"),
        source_format=bq_lib.SourceFormat.NEWLINE_DELIMITED_JSON,
    )
    ndjson = "\n".join(json.dumps(r, default=str) for r in rows)
    bq.load_table_from_file(io.BytesIO(ndjson.encode()), table_ref, job_config=job_config).result()


def run_refresh(bq, account, project: str, dataset: str, since: str, until: str, account_id: str) -> dict:
    """Pull and reload last N days for both tables. Returns row counts."""
    totals = {"insights": 0, "placements": 0}

    # Delete date range from both tables
    for table in ("raw_ad_insights", "raw_ad_placements"):
        bq.query(f"""
            DELETE FROM `{project}.{dataset}.{table}`
            WHERE date BETWEEN '{since}' AND '{until}'
        """).result()
        print(f"Deleted {since}->{until} from {table}", flush=True)

    # Pull insights (country breakdown)
    for cs, ce in week_chunks(since, until):
        attempt = 0
        while True:
            try:
                chunk = pull_chunk_insights(account, cs, ce)
                break
            except Exception as exc:
                attempt += 1
                if attempt >= 6:
                    raise
                wait = 15 * (2 ** (attempt - 1))
                print(f"  [insights] retry {attempt}/5 in {wait}s", flush=True)
                time.sleep(wait)
        flat = [flatten_insights(r, account_id) for r in chunk]
        if flat:
            load_rows(bq, project, dataset, "raw_ad_insights", SCHEMA_INSIGHTS, flat)
        totals["insights"] += len(flat)
        print(f"  [insights {cs}->{ce}] +{len(flat)} rows", flush=True)
        time.sleep(1.5)

    # Pull placements (publisher_platform + platform_position breakdown)
    for cs, ce in day_chunks(since, until, step=3):
        attempt = 0
        while True:
            try:
                chunk = pull_chunk_placements(account, cs, ce)
                break
            except Exception as exc:
                attempt += 1
                if attempt >= 6:
                    raise
                wait = 15 * (2 ** (attempt - 1))
                print(f"  [placements] retry {attempt}/5 in {wait}s", flush=True)
                time.sleep(wait)
        flat = [flatten_placement(r, account_id) for r in chunk]
        if flat:
            load_rows(bq, project, dataset, "raw_ad_placements", SCHEMA_PLACEMENTS, flat)
        totals["placements"] += len(flat)
        print(f"  [placements {cs}->{ce}] +{len(flat)} rows", flush=True)
        time.sleep(1.5)

    return totals


@functions_framework.http
def daily_refresh(request):
    from facebook_business.api import FacebookAdsApi
    from facebook_business.adobjects.adaccount import AdAccount
    from google.cloud import bigquery

    project    = "aurora-scents-494012"
    dataset    = "meta_ads"
    account_id = "act_623779156320026"

    token = get_secret("META_ACCESS_TOKEN", project)
    FacebookAdsApi.init(access_token=token)
    account = AdAccount(account_id)

    bq = bigquery.Client(project=project)

    since = (date.today() - timedelta(days=3)).isoformat()
    until = (date.today() - timedelta(days=1)).isoformat()
    print(f"Daily refresh: {since} -> {until}", flush=True)

    totals = run_refresh(bq, account, project, dataset, since, until, account_id)

    msg = f"OK: insights={totals['insights']} rows, placements={totals['placements']} rows ({since} -> {until})"
    print(msg, flush=True)
    return msg, 200
