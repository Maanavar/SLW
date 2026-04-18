-- AlterTable
ALTER TABLE "commission_payments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "commission_workers" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "rmpHandler" VARCHAR(20);
