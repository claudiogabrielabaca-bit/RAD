-- CreateTable
CREATE TABLE "DayHighlightCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "image" TEXT,
    "articleUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DayHighlightCache_day_key" ON "DayHighlightCache"("day");
