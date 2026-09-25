-- CreateEnum
CREATE TYPE "OpportunityEligibilityType" AS ENUM ('DEGREE', 'BRANCH', 'MIN_YEAR', 'MAX_YEAR', 'MIN_CGPA', 'GRADUATION_YEAR', 'LOCATION', 'OTHER');

-- CreateTable
CREATE TABLE "OpportunityEligibility" (
    "id" SERIAL NOT NULL,
    "opportunityId" INTEGER NOT NULL,
    "type" "OpportunityEligibilityType" NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityEligibility_opportunityId_idx" ON "OpportunityEligibility"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityEligibility_type_idx" ON "OpportunityEligibility"("type");

-- AddForeignKey
ALTER TABLE "OpportunityEligibility" ADD CONSTRAINT "OpportunityEligibility_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
