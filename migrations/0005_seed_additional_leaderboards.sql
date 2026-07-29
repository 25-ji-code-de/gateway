INSERT OR IGNORE INTO leaderboard_definitions (
    id, title, project, metric_name, source_type, aggregation, dimensions,
    submit_client_id, period, sort_direction, min_score, enabled, created_at, updated_at
) VALUES
    ('25ji-songs-all-time', '累计听歌', '25ji', 'songs_played', 'metric', 'max', '{}', NULL, 'all_time', 'desc', 1, 1, 0, 0),
    ('25ji-streak-best', '最高连续登录', '25ji', 'streak_days', 'metric', 'max', '{}', NULL, 'all_time', 'desc', 1, 1, 0, 0),
    ('25ji-achievements', '成就进度', '25ji', 'achievements_unlocked', 'metric', 'max', '{}', NULL, 'all_time', 'desc', 1, 1, 0, 0),
    ('pico-endless', 'Puzzle SEKAI 无尽模式', 'pico', 'effective_score', 'submission', 'max', '{"mode":"endless","entertainment":false}', 'client-pico-AC7D9279977E0954', 'all_time', 'desc', 1, 1, 0, 0),
    ('pico-time-attack', 'Puzzle SEKAI 计时模式', 'pico', 'effective_score', 'submission', 'max', '{"mode":"timeAttack","entertainment":false,"normalized_seconds":90}', 'client-pico-AC7D9279977E0954', 'all_time', 'desc', 1, 1, 0, 0);
