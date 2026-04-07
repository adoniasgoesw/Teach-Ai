-- LessonNote -> SourceNote (agrega por fonte). Só roda se LessonNote existir.
-- npx prisma db execute --file scripts/migrate-lesson-note-to-sourcenote.sql

CREATE TABLE IF NOT EXISTS "SourceNote" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SourceNote_sourceId_key" ON "SourceNote"("sourceId");

DO $f$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SourceNote_sourceId_fkey'
  ) THEN
    ALTER TABLE "SourceNote" ADD CONSTRAINT "SourceNote_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "Source"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $f$;

DO $m$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'LessonNote'
  ) THEN
    INSERT INTO "SourceNote" ("id", "sourceId", "content", "createdAt", "updatedAt")
    SELECT
      'mig_' || replace(gen_random_uuid()::text, '-', ''),
      sub."sourceId",
      sub.merged_content,
      now(),
      now()
    FROM (
      SELECT
        l."sourceId",
        string_agg(ln."content", E'\n\n' ORDER BY ln."createdAt") AS merged_content
      FROM "LessonNote" ln
      JOIN "Lesson" l ON l.id = ln."lessonId"
      GROUP BY l."sourceId"
    ) AS sub
    ON CONFLICT ("sourceId") DO UPDATE SET
      "content" = "SourceNote"."content" || E'\n\n' || EXCLUDED."content",
      "updatedAt" = EXCLUDED."updatedAt";
  END IF;
END $m$;

DROP TABLE IF EXISTS "LessonNote";
