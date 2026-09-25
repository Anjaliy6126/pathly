-- CreateEnum
CREATE TYPE "OpportunityCycleStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OpportunityCycleVerificationStatus" AS ENUM ('VERIFIED', 'FAILED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "OpportunityCycle" (
    "id" SERIAL NOT NULL,
    "opportunityId" INTEGER NOT NULL,
    "cycleLabel" TEXT NOT NULL,
    "applicationStart" DATE,
    "applicationDeadline" DATE,
    "startDate" DATE,
    "endDate" DATE,
    "status" "OpportunityCycleStatus" NOT NULL DEFAULT 'UNKNOWN',
    "applicationUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityCycleVerification" (
    "id" SERIAL NOT NULL,
    "opportunityCycleId" INTEGER NOT NULL,
    "status" "OpportunityCycleVerificationStatus" NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityCycleVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityCycle_opportunityId_idx" ON "OpportunityCycle"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityCycle_status_idx" ON "OpportunityCycle"("status");

-- CreateIndex
CREATE INDEX "OpportunityCycle_applicationDeadline_idx" ON "OpportunityCycle"("applicationDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityCycle_opportunityId_cycleLabel_key" ON "OpportunityCycle"("opportunityId", "cycleLabel");

-- CreateIndex
CREATE INDEX "OpportunityCycleVerification_opportunityCycleId_idx" ON "OpportunityCycleVerification"("opportunityCycleId");

-- CreateIndex
CREATE INDEX "OpportunityCycleVerification_status_idx" ON "OpportunityCycleVerification"("status");

-- CreateIndex
CREATE INDEX "OpportunityCycleVerification_verifiedAt_idx" ON "OpportunityCycleVerification"("verifiedAt");

-- AddForeignKey
ALTER TABLE "OpportunityCycle" ADD CONSTRAINT "OpportunityCycle_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityCycleVerification" ADD CONSTRAINT "OpportunityCycleVerification_opportunityCycleId_fkey" FOREIGN KEY ("opportunityCycleId") REFERENCES "OpportunityCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
