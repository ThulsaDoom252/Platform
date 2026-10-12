/** Additive only: no backfill translates accounts that have not opted in. */
export const LEARNING_LANGUAGE_STORAGE_SQL = `
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS learning_language public.vocab_lang;
CREATE TABLE IF NOT EXISTS public.student_learning_translations (
  id text PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  language public.vocab_lang NOT NULL,
  translation text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_learning_translations_student_lang_idx
  ON public.student_learning_translations(student_id, language);
CREATE TABLE IF NOT EXISTS public.student_learning_translation_jobs (
  student_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  token uuid NOT NULL, language public.vocab_lang NOT NULL,
  segments jsonb NOT NULL DEFAULT '[]', cursor integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'RUNNING',
  processing_until timestamp, error text, updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE public.student_learning_translation_jobs ADD COLUMN IF NOT EXISTS processing_until timestamp;
`;
