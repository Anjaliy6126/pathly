-- CreateEnum
CREATE TYPE "OpportunityFitCategory" AS ENUM ('READY_NOW', 'STRETCH', 'FUTURE');

-- CreateTable
CREATE TABLE "StudentOpportunityEvaluation" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "opportunityId" INTEGER NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligibilityPassed" BOOLEAN NOT NULL,
    "requiredSkillsMatched" INTEGER NOT NULL DEFAULT 0,
    "requiredSkillsTotal" INTEGER NOT NULL DEFAULT 0,
    "preferredSkillsMatched" INTEGER NOT NULL DEFAULT 0,
    "preferredSkillsTotal" INTEGER NOT NULL DEFAULT 0,
    "fitCategory" "OpportunityFitCategory" NOT NULL,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentOpportunityEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentOpportunityEvaluation_studentId_idx" ON "StudentOpportunityEvaluation"("studentId");

-- CreateIndex
CREATE INDEX "StudentOpportunityEvaluation_opportunityId_idx" ON "StudentOpportunityEvaluation"("opportunityId");

-- CreateIndex
CREATE INDEX "StudentOpportunityEvaluation_fitCategory_idx" ON "StudentOpportunityEvaluation"("fitCategory");

-- CreateIndex
CREATE INDEX "StudentOpportunityEvaluation_evaluatedAt_idx" ON "StudentOpportunityEvaluation"("evaluatedAt");

-- AddForeignKey
ALTER TABLE "StudentOpportunityEvaluation" ADD CONSTRAINT "StudentOpportunityEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentOpportunityEvaluation" ADD CONSTRAINT "StudentOpportunityEvaluation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
