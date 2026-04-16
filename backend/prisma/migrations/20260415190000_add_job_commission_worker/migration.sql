-- AlterTable
ALTER TABLE "jobs"
ADD COLUMN "commissionWorkerId" INTEGER,
ADD COLUMN "commissionWorkerName" VARCHAR(120);

-- CreateIndex
CREATE INDEX "jobs_commissionWorkerId_idx" ON "jobs"("commissionWorkerId");
