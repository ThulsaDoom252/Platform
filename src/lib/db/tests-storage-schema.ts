/** Shared additive DDL for deploy setup and the cold-start compatibility guard. */
export const TESTS_STORAGE_SQL = `
  CREATE TABLE IF NOT EXISTS test_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    test_id text NOT NULL, definition jsonb NOT NULL, grading jsonb NOT NULL,
    exercise_ids jsonb NOT NULL, assigned_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS test_assignments_student_date_idx ON test_assignments(student_id, assigned_at);
  CREATE INDEX IF NOT EXISTS test_assignments_teacher_date_idx ON test_assignments(teacher_id, assigned_at);
  CREATE TABLE IF NOT EXISTS test_attempts (
    id uuid PRIMARY KEY, assignment_id uuid NOT NULL REFERENCES test_assignments(id) ON DELETE CASCADE,
    results jsonb NOT NULL DEFAULT '{}', checked_exercise_ids jsonb NOT NULL DEFAULT '[]',
    correct integer NOT NULL DEFAULT 0, total integer NOT NULL DEFAULT 0,
    percent integer NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
    created_at timestamp NOT NULL DEFAULT now(), completed_at timestamp
  );
  CREATE INDEX IF NOT EXISTS test_attempts_assignment_date_idx ON test_attempts(assignment_id, created_at);
`;
