-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'APPLIED', 'SHORTLISTED', 'REJECTED', 'SELECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "StudentOpportunityBookmark" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "opportunityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentOpportunityBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentOpportunityApplication" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "opportunityId" INTEGER NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "appliedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentOpportunityApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentOpportunityBookmark_opportunityId_idx" ON "StudentOpportunityBookmark"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentOpportunityBookmark_studentId_opportunityId_key" ON "StudentOpportunityBookmark"("studentId", "opportunityId");

-- CreateIndex
CREATE INDEX "StudentOpportunityApplication_opportunityId_idx" ON "StudentOpportunityApplication"("opportunityId");

-- CreateIndex
CREATE INDEX "StudentOpportunityApplication_status_idx" ON "StudentOpportunityApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentOpportunityApplication_studentId_opportunityId_key" ON "StudentOpportunityApplication"("studentId", "opportunityId");

-- AddForeignKey
ALTER TABLE "StudentOpportunityBookmark" ADD CONSTRAINT "StudentOpportunityBookmark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentOpportunityBookmark" ADD CONSTRAINT "StudentOpportunityBookmark_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentOpportunityApplication" ADD CONSTRAINT "StudentOpportunityApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentOpportunityApplication" ADD CONSTRAINT "StudentOpportunityApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
