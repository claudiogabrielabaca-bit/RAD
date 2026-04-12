-- CreateTable
CREATE TABLE "TodayHistoryPool" (
    "monthDay" TEXT NOT NULL PRIMARY KEY,
    "validDays" JSONB NOT NULL,
    "validCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
