-- AlterTable
ALTER TABLE "User" ADD COLUMN "loginCode" TEXT;
ALTER TABLE "User" ADD COLUMN "loginCodeExpiresAt" DATETIME;
