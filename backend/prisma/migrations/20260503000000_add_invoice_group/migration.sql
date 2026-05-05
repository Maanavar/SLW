-- Add invoiceGroup column to customers table for explicit invoice grouping (rmp, ww, nm)
ALTER TABLE "customers" ADD COLUMN "invoiceGroup" VARCHAR(10);
