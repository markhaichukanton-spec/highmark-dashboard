"""
bq_writer.py — BigQuery helper for High Mark Agency ingestion pipelines.
"""
from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

from google.cloud import bigquery
from google.oauth2 import service_account

# ── Schema definitions ────────────────────────────────────────────────────────

SCHEMAS: dict[str, list[bigquery.SchemaField]] = {
    # One flat row = date × country × campaign × adset × ad
    "ad_insights": [
        bigquery.SchemaField("date",               "DATE"),
        bigquery.SchemaField("source",             "STRING"),
        bigquery.SchemaField("account_id",         "STRING"),
        bigquery.SchemaField("country",            "STRING"),
        bigquery.SchemaField("campaign_id",        "STRING"),
        bigquery.SchemaField("campaign_name",      "STRING"),
        bigquery.SchemaField("campaign_objective", "STRING"),
        bigquery.SchemaField("adset_id",           "STRING"),
        bigquery.SchemaField("adset_name",         "STRING"),
        bigquery.SchemaField("ad_id",              "STRING"),
        bigquery.SchemaField("ad_name",            "STRING"),
        bigquery.SchemaField("impressions",        "INT64"),
        bigquery.SchemaField("clicks",             "INT64"),
        bigquery.SchemaField("spend",              "FLOAT64"),
        bigquery.SchemaField("purchases",          "INT64"),
        bigquery.SchemaField("revenue",            "FLOAT64"),
        bigquery.SchemaField("reach",              "INT64"),
        bigquery.SchemaField("_loaded_at",         "TIMESTAMP"),
    ],
    "creatives": [
        bigquery.SchemaField("ad_id",                             "STRING"),
        bigquery.SchemaField("creative_id",                       "STRING"),
        bigquery.SchemaField("creative_name",                     "STRING"),
        bigquery.SchemaField("object_type",                       "STRING"),
        bigquery.SchemaField("branded_content_sponsor_page_id",   "STRING"),
        bigquery.SchemaField("instagram_user_id",                 "STRING"),
        bigquery.SchemaField("page_id_in_creative",               "STRING"),
        bigquery.SchemaField("has_video",                         "BOOL"),
        bigquery.SchemaField("has_image",                         "BOOL"),
        bigquery.SchemaField("kind",                              "STRING"),
        bigquery.SchemaField("_loaded_at",                        "TIMESTAMP"),
    ],
}

TABLE_NAMES = {
    "ad_insights": "raw_ad_insights",
    "creatives":   "raw_ad_creatives",
}

# ── Client ────────────────────────────────────────────────────────────────────

def get_client(credentials_path: str | Path, project: str) -> bigquery.Client:
    creds = service_account.Credentials.from_service_account_file(
        str(credentials_path),
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    return bigquery.Client(project=project, credentials=creds)


def ensure_dataset(client: bigquery.Client, project: str, dataset: str, location: str = "EU") -> None:
    ds_ref = bigquery.Dataset(f"{project}.{dataset}")
    ds_ref.location = location
    client.create_dataset(ds_ref, exists_ok=True)


# ── Load ──────────────────────────────────────────────────────────────────────

def load_rows(
    client: bigquery.Client,
    project: str,
    dataset: str,
    level: str,
    rows: list[dict[str, Any]],
    append: bool = False,
) -> int:
    """Write rows to the table for level.

    append=False: WRITE_TRUNCATE — replaces the whole table (first chunk).
    append=True:  WRITE_APPEND  — adds rows (subsequent chunks).
    """
    if not rows:
        print(f"  [bq] no rows for level={level}", flush=True)
        return 0

    table_ref = f"{project}.{dataset}.{TABLE_NAMES[level]}"
    schema    = SCHEMAS[level]

    if not append:
        client.delete_table(table_ref, not_found_ok=True)

    job_config = bigquery.LoadJobConfig(
        schema=schema,
        write_disposition=(
            bigquery.WriteDisposition.WRITE_APPEND
            if append else
            bigquery.WriteDisposition.WRITE_TRUNCATE
        ),
        time_partitioning=bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.MONTH,
            field="date" if level != "creatives" else None,
        ),
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
    )

    ndjson = "\n".join(json.dumps(r, default=str) for r in rows)
    job = client.load_table_from_file(
        io.BytesIO(ndjson.encode()),
        table_ref,
        job_config=job_config,
    )
    job.result()

    loaded = client.get_table(table_ref).num_rows
    print(f"  [bq] {table_ref} -> {loaded:,} rows total", flush=True)
    return len(rows)
