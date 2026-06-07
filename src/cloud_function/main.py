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

SCHEMA = [
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


def pull_chunk(account, since: str, until: str) -> list:
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


def load_rows(bq, project: str, dataset: str, rows: list, append: bool):
    from google.cloud import bigquery as bq_lib
    table_ref = f"{project}.{dataset}.raw_ad_insights"
    schema = [bq_lib.SchemaField(f["name"], f["type"]) for f in SCHEMA]

    if not append:
        bq.delete_table(table_ref, not_found_ok=True)

    job_config = bq_lib.LoadJobConfig(
        schema=schema,
        write_disposition=bq_lib.WriteDisposition.WRITE_APPEND if append else bq_lib.WriteDisposition.WRITE_TRUNCATE,
        time_partitioning=bq_lib.TimePartitioning(type_=bq_lib.TimePartitioningType.MONTH, field="date"),
        source_format=bq_lib.SourceFormat.NEWLINE_DELIMITED_JSON,
    )
    ndjson = "\n".join(json.dumps(r, default=str) for r in rows)
    bq.load_table_from_file(io.BytesIO(ndjson.encode()), table_ref, job_config=job_config).result()


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
    print(f"Pulling {since} -> {until}", flush=True)

    # Delete date range first, then append fresh data
    bq.query(f"""
        DELETE FROM `{project}.{dataset}.raw_ad_insights`
        WHERE date BETWEEN '{since}' AND '{until}'
    """).result()

    print(f"Token first 20 chars: {token[:20]}", flush=True)
    print(f"Account: {account_id}", flush=True)

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
                print(f"  retry {attempt}/5 in {wait}s", flush=True)
                time.sleep(wait)

        flat = [flatten_row(r, account_id) for r in chunk]
        if flat:
            load_rows(bq, project, dataset, flat, append=True)
        total += len(flat)
        print(f"  [{cs}->{ce}] +{len(flat)} rows", flush=True)
        time.sleep(1.5)

    msg = f"OK: {total} rows loaded ({since} -> {until})"
    print(msg, flush=True)
    return msg, 200
