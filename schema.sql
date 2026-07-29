-- User statistics table
-- 存储用户在各项目的统计数据
CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    project TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, project, metric_name, date)
);

CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX idx_user_stats_project ON user_stats(project);
CREATE INDEX idx_user_stats_date ON user_stats(date);

-- User profiles table
-- 存储用户的扩展资料（bio 等）
-- 基本资料（display_name, avatar_url）由 SEKAI Pass 管理
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    bio TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_user_profiles_updated_at ON user_profiles(updated_at);

-- User activities table
-- 存储用户的活动时间线
CREATE TABLE IF NOT EXISTS user_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    project TEXT NOT NULL,
    event_type TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at);

-- Achievements table
-- 定义所有可用的成就
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    project TEXT,
    type TEXT NOT NULL,
    requirement TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- User achievements table
-- 存储用户解锁的成就
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    unlocked_at INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, achievement_id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_unlocked_at ON user_achievements(unlocked_at);

-- User sync data table
-- 存储用户的完整同步数据（用于多设备同步）
CREATE TABLE IF NOT EXISTS user_sync_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    project TEXT NOT NULL,
    sync_data TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, project)
);

CREATE INDEX idx_user_sync_data_user_id ON user_sync_data(user_id);
CREATE INDEX idx_user_sync_data_project ON user_sync_data(project);
CREATE INDEX idx_user_sync_data_updated_at ON user_sync_data(updated_at);

-- Only registered leaderboard definitions can be queried.
CREATE TABLE IF NOT EXISTS leaderboard_definitions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'metric' CHECK (source_type IN ('metric', 'submission')),
    aggregation TEXT NOT NULL DEFAULT 'sum' CHECK (aggregation IN ('sum', 'max', 'min', 'latest')),
    dimensions TEXT NOT NULL DEFAULT '{}',
    submit_client_id TEXT,
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),
    sort_direction TEXT NOT NULL DEFAULT 'desc' CHECK (sort_direction IN ('asc', 'desc')),
    min_score INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_leaderboard_definitions_project
    ON leaderboard_definitions(project, enabled);

-- Publishing leaderboard identity is optional and separate from auth data.
CREATE TABLE IF NOT EXISTS leaderboard_profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    show_profile INTEGER NOT NULL DEFAULT 0 CHECK (show_profile IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_leaderboard_profiles_show_profile
    ON leaderboard_profiles(show_profile, user_id);

CREATE INDEX idx_user_stats_leaderboard
    ON user_stats(project, metric_name, date, user_id);

CREATE TABLE IF NOT EXISTS leaderboard_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    submission_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    metadata TEXT,
    achieved_date TEXT NOT NULL,
    achieved_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(board_id, user_id, submission_id),
    FOREIGN KEY (board_id) REFERENCES leaderboard_definitions(id)
);

CREATE INDEX idx_leaderboard_submissions_rank
    ON leaderboard_submissions(board_id, achieved_date, user_id, score);
