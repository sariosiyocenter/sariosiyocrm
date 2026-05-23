-- Migration: add_exam_module
-- Run this manually when DB is accessible:
--   psql $DATABASE_URL -f this_file.sql
-- OR run: npx prisma migrate deploy

-- Question table
CREATE TABLE "Question" (
    "id"            SERIAL PRIMARY KEY,
    "text"          TEXT NOT NULL,
    "imageUrl"      TEXT,
    "optionA"       TEXT NOT NULL,
    "optionB"       TEXT NOT NULL,
    "optionC"       TEXT NOT NULL,
    "optionD"       TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "difficulty"    INTEGER NOT NULL DEFAULT 1,
    "subject"       TEXT NOT NULL,
    "topic"         TEXT NOT NULL,
    "schoolId"      INTEGER NOT NULL,
    CONSTRAINT "Question_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Question_schoolId_subject_topic_idx" ON "Question"("schoolId", "subject", "topic");

-- Exam table
CREATE TABLE "Exam" (
    "id"             SERIAL PRIMARY KEY,
    "name"           TEXT NOT NULL,
    "date"           TEXT NOT NULL,
    "duration"       INTEGER NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'Yaqinlashmoqda',
    "blocks"         JSONB NOT NULL,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "maxScore"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variants"       JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId"       INTEGER NOT NULL,
    CONSTRAINT "Exam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Exam_schoolId_idx" ON "Exam"("schoolId");

-- ExamAssignment table
CREATE TABLE "ExamAssignment" (
    "id"       SERIAL PRIMARY KEY,
    "examId"   INTEGER NOT NULL,
    "groupId"  INTEGER NOT NULL,
    "schoolId" INTEGER NOT NULL,
    CONSTRAINT "ExamAssignment_examId_fkey"   FOREIGN KEY ("examId")   REFERENCES "Exam"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamAssignment_groupId_fkey"  FOREIGN KEY ("groupId")  REFERENCES "Group"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamAssignment_examId_groupId_key" UNIQUE ("examId", "groupId")
);

-- ExamResult table
CREATE TABLE "ExamResult" (
    "id"          SERIAL PRIMARY KEY,
    "studentId"   INTEGER NOT NULL,
    "examId"      INTEGER NOT NULL,
    "variantCode" TEXT,
    "answers"     JSONB,
    "score"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentage"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockScores" JSONB,
    "scannedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId"    INTEGER NOT NULL,
    CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamResult_examId_fkey"   FOREIGN KEY ("examId")    REFERENCES "Exam"("id")    ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "ExamResult_schoolId_fkey" FOREIGN KEY ("schoolId")  REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamResult_studentId_examId_key" UNIQUE ("studentId", "examId")
);
CREATE INDEX "ExamResult_examId_schoolId_idx" ON "ExamResult"("examId", "schoolId");
