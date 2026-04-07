-- Migra Quiz e Flashcard de lessonId -> sourceId (PostgreSQL).
-- Rode uma vez: npx prisma db execute --file scripts/migrate-quiz-flashcard-to-sourceid.sql

-- Quiz
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "difficulty" TEXT;

UPDATE "Quiz" AS q
SET "sourceId" = l."sourceId"
FROM "Lesson" AS l
WHERE q."lessonId" IS NOT NULL
  AND l.id = q."lessonId";

DELETE FROM "Quiz" WHERE "sourceId" IS NULL;

ALTER TABLE "Quiz" DROP CONSTRAINT IF EXISTS "Quiz_lessonId_fkey";
ALTER TABLE "Quiz" DROP COLUMN IF EXISTS "lessonId";

ALTER TABLE "Quiz" ALTER COLUMN "sourceId" SET NOT NULL;

DO $f$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Quiz_sourceId_fkey'
  ) THEN
    ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "Source"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $f$;

CREATE INDEX IF NOT EXISTS "Quiz_sourceId_idx" ON "Quiz"("sourceId");

-- Flashcard
ALTER TABLE "Flashcard" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

UPDATE "Flashcard" AS f
SET "sourceId" = l."sourceId"
FROM "Lesson" AS l
WHERE f."lessonId" IS NOT NULL
  AND l.id = f."lessonId";

DELETE FROM "Flashcard" WHERE "sourceId" IS NULL;

ALTER TABLE "Flashcard" DROP CONSTRAINT IF EXISTS "Flashcard_lessonId_fkey";
ALTER TABLE "Flashcard" DROP COLUMN IF EXISTS "lessonId";

ALTER TABLE "Flashcard" ALTER COLUMN "sourceId" SET NOT NULL;

DO $f$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Flashcard_sourceId_fkey'
  ) THEN
    ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "Source"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $f$;

CREATE INDEX IF NOT EXISTS "Flashcard_sourceId_idx" ON "Flashcard"("sourceId");
