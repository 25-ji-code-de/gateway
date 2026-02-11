-- 25ji 成就定义导入脚本
-- 共 34 个成就，分为 5 大类

-- 1. 番茄钟相关成就 (9个)
INSERT INTO achievements (id, name, description, icon, project, type, requirement, created_at) VALUES
('25ji_first_pomodoro', '初めての一歩', '完成第一个番茄钟', '🍅', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"pomodoro_completed","value":1}', 1739232000000),
('25ji_pomodoro_10', '番茄收集者', '累计完成10个番茄钟', '🍅', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"pomodoro_completed","value":10}', 1739232000000),
('25ji_rank_platinum', 'Platinum（白金）', '累计完成50个番茄钟', '🏆', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"pomodoro_completed","value":50}', 1739232000000),
('25ji_rank_diamond', 'Diamond（钻石）', '累计完成100个番茄钟', '💎', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"pomodoro_completed","value":100}', 1739232000000),
('25ji_rank_ruby', 'Ruby（红宝石）', '累计完成200个番茄钟', '🔴', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"pomodoro_completed","value":200}', 1739232000000),
('25ji_rank_pearl', 'Pearl（珍珠）', '累计完成300个番茄钟', '⚪', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"pomodoro_completed","value":300}', 1739232000000),
('25ji_rank_sapphire', 'Sapphire（蓝宝石）', '累计完成400个番茄钟', '🔵', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"pomodoro_completed","value":400}', 1739232000000),
('25ji_rank_garnet', 'Garnet（石榴石）', '累计完成500个番茄钟', '🟤', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"pomodoro_completed","value":500}', 1739232000000),
('25ji_rank_emerald', 'Emerald（祖母绿）', '累计完成1000个番茄钟', '💚', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"pomodoro_completed","value":1000}', 1739232000000);

-- 2. 连续天数成就 (7个)
INSERT INTO achievements (id, name, description, icon, project, type, requirement, created_at) VALUES
('25ji_streak_3', '三日坚持', '连续3天学习', '🔥', '25ji', 'streak', '{"type":"streak","project":"25ji","days":3}', 1739232000000),
('25ji_streak_7', '皆勤賞', '连续7天学习', '📅', '25ji', 'streak', '{"type":"streak","project":"25ji","days":7}', 1739232000000),
('25ji_streak_14', '高校1年生', '连续14天学习', '🏫', '25ji', 'streak', '{"type":"streak","project":"25ji","days":14}', 1739232000000),
('25ji_streak_30', '高校2年生', '连续30天学习', '🔥', '25ji', 'streak', '{"type":"streak","project":"25ji","days":30}', 1739232000000),
('25ji_streak_60', '高校3年生', '连续60天学习', '🌸', '25ji', 'streak', '{"type":"streak","project":"25ji","days":60}', 1739232000000),
('25ji_streak_100', '一直都在身边', '连续100天学习', '💑', '25ji', 'streak', '{"type":"streak","project":"25ji","days":100}', 1739232000000),
('25ji_streak_365', '永远都在身边', '连续365天学习', '💍', '25ji', 'streak', '{"type":"streak","project":"25ji","days":365}', 1739232000000);

-- 3. 学习时长成就 (6个)
INSERT INTO achievements (id, name, description, icon, project, type, requirement, created_at) VALUES
('25ji_time_10h', '一人前', '累计学习10小时', '🐣', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"study_minutes","value":600}', 1739232000000),
('25ji_time_50h', 'Veteran（资深老手）', '累计学习50小时', '🦅', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"study_minutes","value":3000}', 1739232000000),
('25ji_time_100h', '老相识', '累计学习100小时', '👴', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"study_minutes","value":6000}', 1739232000000),
('25ji_time_200h', '元老级', '累计学习200小时', '🦕', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"study_minutes","value":12000}', 1739232000000),
('25ji_time_500h', '远古居民', '累计学习500小时', '🦖', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"study_minutes","value":30000}', 1739232000000),
('25ji_time_1000h', '前世之缘', '累计学习1000小时', '👻', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"study_minutes","value":60000}', 1739232000000);

-- 4. 歌曲播放成就 (7个)
INSERT INTO achievements (id, name, description, icon, project, type, requirement, created_at) VALUES
('25ji_live_master_beginner', 'Live Master 初級', '播放10首歌曲', '🎵', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"songs_played","value":10}', 1739232000000),
('25ji_song_39', '39！', '播放39首歌曲', '🎵', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"songs_played","value":39}', 1739232000000),
('25ji_live_master_intermediate', 'Live Master 中級', '播放50首歌曲', '🎧', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"songs_played","value":50}', 1739232000000),
('25ji_live_master_advanced', 'Live Master 上級', '播放100首歌曲', '🎹', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"songs_played","value":100}', 1739232000000),
('25ji_live_master_expert', 'Live Master 達人', '播放500首歌曲', '🎸', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"songs_played","value":500}', 1739232000000),
('25ji_live_master_master', 'Live Master 皆伝', '播放1000首歌曲', '🎺', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"songs_played","value":1000}', 1739232000000),
('25ji_live_master_true_master', 'Live Master 真・皆伝', '播放2000首歌曲', '🎻', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"songs_played","value":2000}', 1739232000000),
('25ji_song_3939', '3939！', '播放3939首歌曲', '🎵', '25ji', 'stat', '{"type":"stat","project":"25ji","metric":"songs_played","value":3939}', 1739232000000);

-- 5. 特殊成就 (5个)
-- 注意：这些成就需要特殊逻辑处理，暂时不导入
-- night_owl, early_bird, session_duration 需要在前端或 API 中特殊处理
