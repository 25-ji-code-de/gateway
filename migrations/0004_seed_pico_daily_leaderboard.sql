INSERT OR IGNORE INTO leaderboard_definitions (
    id, title, project, metric_name, source_type, aggregation, dimensions,
    submit_client_id, period, sort_direction, min_score, enabled, created_at, updated_at
) VALUES (
    'pico-daily', 'Puzzle SEKAI 每日挑战', 'pico', 'score', 'submission', 'max',
    '{"mode":"daily","rules_version":1}',
    'client-pico-AC7D9279977E0954', 'daily', 'desc', 1, 1, 0, 0
);
