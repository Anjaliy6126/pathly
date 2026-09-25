-- CreateEnum
CREATE TYPE "OpportunitySourceType" AS ENUM ('COMPANY', 'GOVERNMENT', 'UNIVERSITY', 'HACKATHON_PLATFORM', 'NONPROFIT', 'ORGANIZATION', 'ADMIN', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityVerificationStatus" AS ENUM ('VERIFIED', 'FAILED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "OpportunitySource" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "sourceType" "OpportunitySourceType" NOT NULL DEFAULT 'OTHER',
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunitySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityVerification" (
    "id" SERIAL NOT NULL,
    "opportunityId" INTEGER NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "status" "OpportunityVerificationStatus" NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySource_name_key" ON "OpportunitySource"("name");

-- CreateIndex
CREATE INDEX "OpportunitySource_sourceType_idx" ON "OpportunitySource"("sourceType");

-- CreateIndex
CREATE INDEX "OpportunityVerification_opportunityId_verifiedAt_idx" ON "OpportunityVerification"("opportunityId", "verifiedAt");

-- CreateIndex
CREATE INDEX "OpportunityVerification_sourceId_idx" ON "OpportunityVerification"("sourceId");

-- CreateIndex
CREATE INDEX "OpportunityVerification_status_idx" ON "OpportunityVerification"("status");

-- AddForeignKey
ALTER TABLE "OpportunityVerification" ADD CONSTRAINT "OpportunityVerification_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityVerification" ADD CONSTRAINT "OpportunityVerification_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OpportunitySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
