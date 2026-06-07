import { BigQuery } from '@google-cloud/bigquery'

let _client: BigQuery | null = null

export function getClient(): BigQuery {
  if (!_client) {
    _client = new BigQuery({
      projectId: process.env.BQ_PROJECT_ID,
      credentials: JSON.parse(process.env.BQ_SERVICE_ACCOUNT_JSON!),
    })
  }
  return _client
}

export const PROJECT = process.env.BQ_PROJECT_ID!
export const DATASET = process.env.BQ_DATASET!
export const TABLE = `\`${process.env.BQ_PROJECT_ID}.${process.env.BQ_DATASET}.raw_ad_insights\``
