-- CreateEnum
CREATE TYPE "SkillEvidenceType" AS ENUM ('PROJECT', 'GITHUB_REPOSITORY', 'PORTFOLIO', 'INTERNSHIP', 'CERTIFICATION', 'COURSE', 'LEETCODE', 'LINKEDIN', 'OTHER');

-- CreateTable
CREATE TABLE "StudentSkillEvidence" (
    "id" SERIAL NOT NULL,
    "studentSkillId" INTEGER NOT NULL,
    "evidenceType" "SkillEvidenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "evidenceDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSkillEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentSkillEvidence_studentSkillId_idx" ON "StudentSkillEvidence"("studentSkillId");

-- AddForeignKey
ALTER TABLE "StudentSkillEvidence" ADD CONSTRAINT "StudentSkillEvidence_studentSkillId_fkey" FOREIGN KEY ("studentSkillId") REFERENCES "StudentSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
