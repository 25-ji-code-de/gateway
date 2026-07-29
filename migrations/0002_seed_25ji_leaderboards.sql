INSERT OR IGNORE INTO leaderboard_definitions (
    id, title, project, metric_name, period, sort_direction,
    min_score, enabled, created_at, updated_at
) VALUES
    ('25ji-focus-weekly', '本周专注', '25ji', 'study_minutes', 'weekly', 'desc', 1, 1, 0, 0),
    ('25ji-focus-monthly', '本月专注', '25ji', 'study_minutes', 'monthly', 'desc', 1, 1, 0, 0),
    ('25ji-pomodoros-weekly', '本周番茄钟', '25ji', 'pomodoros_completed', 'weekly', 'desc', 1, 1, 0, 0),
    ('25ji-focus-all-time', '累计专注', '25ji', 'study_minutes', 'all_time', 'desc', 1, 1, 0, 0);
