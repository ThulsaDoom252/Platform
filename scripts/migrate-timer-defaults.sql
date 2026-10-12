-- Only defaults for future rows change. Existing durations (including NULL/Off)
-- and all student progress remain untouched. Safe to run repeatedly.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE class_timer_presets ALTER COLUMN duration_seconds SET DEFAULT 120;
ALTER TABLE class_student_timers ALTER COLUMN duration_seconds SET DEFAULT 120;
ALTER TABLE activity_games ALTER COLUMN seconds SET DEFAULT 120;
ALTER TABLE word_revisions ALTER COLUMN answer_seconds SET DEFAULT 120;
ALTER TABLE word_revisions ALTER COLUMN total_seconds SET DEFAULT 120;
ALTER TABLE word_revision_presets ALTER COLUMN answer_seconds SET DEFAULT 120;
ALTER TABLE word_revision_presets ALTER COLUMN total_seconds SET DEFAULT 120;
COMMIT;
