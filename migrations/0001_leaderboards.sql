CREATE TABLE IF NOT EXISTS leaderboard_definitions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),
    sort_direction TEXT NOT NULL DEFAULT 'desc' CHECK (sort_direction IN ('asc', 'desc')),
    min_score INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_definitions_project
    ON leaderboard_definitions(project, enabled);

CREATE TABLE IF NOT EXISTS leaderboard_profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    show_profile INTEGER NOT NULL DEFAULT 0 CHECK (show_profile IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_profiles_show_profile
    ON leaderboard_profiles(show_profile, user_id);

CREATE INDEX IF NOT EXISTS idx_user_stats_leaderboard
    ON user_stats(project, metric_name, date, user_id);
