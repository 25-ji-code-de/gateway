# Leaderboards

## Scope

Leaderboards are a gateway user-data domain. They reuse authenticated event statistics and D1; clients such as Hub only render the result. Achievements remain in the same domain because both features consume the same metrics.

The first version intentionally does not use Durable Objects, KV, or a separate Worker. D1 is the source of truth and computes ranks on read. Revisit materialized scores or a separate service when query volume or participant count makes aggregation measurably slow.

## Privacy

Users with qualifying statistics participate automatically and appear anonymously by default. They can choose to publish a display name by calling:

```http
PUT /user/leaderboard-profile
Content-Type: application/json

{
  "show_profile": true,
  "display_name": "Miku"
}
```

Anonymous entries return `display_name: null` and `is_public: false`. The leaderboard database stores only an optional public display name. It does not expose user IDs, usernames, email addresses, tokens, or profile bios. Turning profile visibility off keeps the score on the board and hides the identity immediately.

## Board Definitions

Requests select a registered `leaderboard_definitions.id`. Project and metric identifiers are never accepted from URL parameters and interpolated into SQL.

Supported periods use the existing UTC date buckets:

- `daily`: current UTC day
- `weekly`: Monday through the current UTC day
- `monthly`: first of the UTC month through today
- `all_time`: every stored date through today

Example definition:

```sql
INSERT INTO leaderboard_definitions (
  id, title, project, metric_name, period, sort_direction,
  min_score, enabled, created_at, updated_at
) VALUES (
  '25ji-focus-all-time', 'All-time focus', '25ji', 'study_minutes',
  'all_time', 'desc', 1, 1, unixepoch() * 1000, unixepoch() * 1000
);
```

Definitions are operational configuration. Do not seed a product board until its metric semantics and anti-abuse limits have been approved.

## API

All endpoints require a SEKAI Pass token issued to a first-party client.

```http
GET /user/leaderboard-profile
PUT /user/leaderboard-profile
GET /user/leaderboards/{board_id}?limit=50&offset=0
```

A leaderboard response contains the board definition, UTC period range, page entries, total participant count, and `me`. The `me` value is independent of pagination and is `null` only when the caller has no qualifying score. Ties use competition ranking (`1, 1, 3`).

## Deployment

Apply [0001_leaderboards.sql](../migrations/0001_leaderboards.sql) to the gateway D1 database before deploying code that exposes these routes. Apply it locally first, run the test suite, then apply it remotely using the database name from the deployment configuration.

The Worker must expose the gateway data database as `env.DB`. `env.AUTH_DB` remains the separate SEKAI Pass authentication binding and is not queried for other users' leaderboard identities.

The migration is additive. Operational rollback disables definitions (`enabled = 0`) and rolls back the Worker. Keep the new tables during rollback so profile visibility settings are not lost.

## Known Boundaries

- Event scores are client-reported. Competitive or rewarded boards need event IDs, idempotency, rate limits, and server-verifiable increments before launch.
- Existing `user_stats.metric_value` is text and is cast to integer during aggregation.
- UTC periods match the current write path but may not match a user's local calendar day.
- Current achievement checks read only the current day's metrics. Cumulative achievements need a separate aggregation correction before they can share all-time leaderboard semantics.
