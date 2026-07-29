ALTER TABLE leaderboard_definitions
    ADD COLUMN source_type TEXT NOT NULL DEFAULT 'metric'
    CHECK (source_type IN ('metric', 'submission'));
ALTER TABLE leaderboard_definitions
    ADD COLUMN aggregation TEXT NOT NULL DEFAULT 'sum'
    CHECK (aggregation IN ('sum', 'max', 'min', 'latest'));
ALTER TABLE leaderboard_definitions
    ADD COLUMN dimensions TEXT NOT NULL DEFAULT '{}';
ALTER TABLE leaderboard_definitions
    ADD COLUMN submit_client_id TEXT;

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

CREATE INDEX IF NOT EXISTS idx_leaderboard_submissions_rank
    ON leaderboard_submissions(board_id, achieved_date, user_id, score);
